"""SikshaSajilo curriculum ingestion pipeline — FastAPI service."""

import os
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

PIPELINE_SECRET = os.environ.get("PIPELINE_SECRET_KEY", "")

# In-memory job store — replace with Redis for multi-worker deployments
_jobs: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="SikshaSajilo Pipeline",
    description="Curriculum ingestion service for Nepal CDC syllabus PDFs.",
    version="1.0.0",
    lifespan=lifespan,
)


def _check_auth(secret: str) -> None:
    if PIPELINE_SECRET and secret != PIPELINE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


class IngestRequest(BaseModel):
    grade: int          # 9 or 10
    subject_id: str
    year_bs: int = 2083
    source_url: Optional[str] = None


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "siksha-sajilo-pipeline"}


@app.post("/ingest")
async def trigger_ingest(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
    x_pipeline_secret: str = Header(...),
):
    """Trigger ingestion from a CDC URL. Runs OCR → parse → embed → draft in background."""
    _check_auth(x_pipeline_secret)
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "pending",
        "grade": request.grade,
        "subject_id": request.subject_id,
        "year_bs": request.year_bs,
    }
    background_tasks.add_task(_run_pipeline, job_id, request, None)
    return {"job_id": job_id, "status": "pending"}


@app.post("/ingest/upload")
async def ingest_upload(
    grade: int,
    subject_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    year_bs: int = 2083,
    x_pipeline_secret: str = Header(...),
):
    """Ingest from a directly uploaded PDF (for admin manual uploads)."""
    _check_auth(x_pipeline_secret)
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    pdf_content = await file.read()
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {
        "status": "pending",
        "grade": grade,
        "subject_id": subject_id,
        "year_bs": year_bs,
    }
    request = IngestRequest(grade=grade, subject_id=subject_id, year_bs=year_bs)
    background_tasks.add_task(_run_pipeline, job_id, request, pdf_content)
    return {"job_id": job_id, "status": "pending"}


@app.get("/status/{job_id}")
async def get_status(job_id: str, x_pipeline_secret: str = Header(...)):
    """Poll job status."""
    _check_auth(x_pipeline_secret)
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    return _jobs[job_id]


# ── Pipeline orchestration ────────────────────────────────────────────────────

async def _run_pipeline(
    job_id: str,
    request: IngestRequest,
    pdf_content: Optional[bytes],
) -> None:
    try:
        if pdf_content is None:
            _jobs[job_id]["status"] = "scraping"
            from scraper import scrape_pdf
            pdf_content, pdf_hash = await scrape_pdf(request.source_url)
            _jobs[job_id]["pdf_hash"] = pdf_hash

        _jobs[job_id]["status"] = "ocr"
        from ocr import extract_text
        raw_text = await extract_text(pdf_content)
        _jobs[job_id]["pages_processed"] = raw_text.count("--- PAGE BREAK ---") + 1

        _jobs[job_id]["status"] = "parsing"
        from parser import parse_syllabus
        parsed = await parse_syllabus(raw_text)
        _jobs[job_id]["units_found"] = len(parsed)

        _jobs[job_id]["status"] = "embedding"
        from ingest import ingest_syllabus
        count = await ingest_syllabus(
            parsed,
            grade=request.grade,
            subject_id=request.subject_id,
            year_bs=request.year_bs,
        )

        _jobs[job_id]["status"] = "complete"
        _jobs[job_id]["chunks_ingested"] = count
        _jobs[job_id]["message"] = (
            f"Draft created: {count} topic chunks ready for admin review. "
            "Approve via /api/syllabus/approve to make live."
        )

    except Exception as exc:
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = str(exc)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
