"""
Monthly cron scheduler — checks CDC/NEB for updated syllabus PDFs
and triggers re-ingestion when a new file is detected via SHA-256 comparison.

Run directly:  python scheduler.py
Or via GitHub Actions cron (see .github/workflows/syllabus-cron.yml).
"""

import asyncio
import hashlib
import os

import aiohttp

# Known CDC/NEB syllabus sources.
# Add or update entries as CDC publishes new documents.
SOURCES: list[dict] = [
    # Example entries — replace with verified CDC URLs when available.
    # {
    #     "url": "https://moecdc.gov.np/storage/gallery/grade9_mathematics.pdf",
    #     "grade": 9,
    #     "subject_id": "mathematics",
    #     "year_bs": 2083,
    # },
    # {
    #     "url": "https://moecdc.gov.np/storage/gallery/grade10_science.pdf",
    #     "grade": 10,
    #     "subject_id": "science",
    #     "year_bs": 2083,
    # },
]

PIPELINE_URL = os.environ.get("PIPELINE_SERVICE_URL", "http://localhost:8000")
PIPELINE_SECRET = os.environ.get("PIPELINE_SECRET_KEY", "")
HASH_STORE_PATH = os.path.join(os.path.dirname(__file__), ".pdf_hashes")


def _load_hashes() -> dict[str, str]:
    """Load previously seen PDF hashes from disk."""
    hashes: dict[str, str] = {}
    if os.path.exists(HASH_STORE_PATH):
        with open(HASH_STORE_PATH) as f:
            for line in f:
                line = line.strip()
                if "=" in line:
                    key, val = line.split("=", 1)
                    hashes[key.strip()] = val.strip()
    return hashes


def _save_hashes(hashes: dict[str, str]) -> None:
    with open(HASH_STORE_PATH, "w") as f:
        for key, val in hashes.items():
            f.write(f"{key}={val}\n")


def _source_key(source: dict) -> str:
    return f"{source['grade']}_{source['subject_id']}_{source['year_bs']}"


async def _fetch_and_hash(url: str, session: aiohttp.ClientSession) -> tuple[bytes, str]:
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as resp:
        resp.raise_for_status()
        content = await resp.read()
    return content, hashlib.sha256(content).hexdigest()


async def _trigger_ingest(source: dict, session: aiohttp.ClientSession) -> str:
    payload = {
        "grade": source["grade"],
        "subject_id": source["subject_id"],
        "year_bs": source["year_bs"],
        "source_url": source["url"],
    }
    headers = {
        "Content-Type": "application/json",
        "X-Pipeline-Secret": PIPELINE_SECRET,
    }
    async with session.post(
        f"{PIPELINE_URL}/ingest",
        json=payload,
        headers=headers,
        timeout=aiohttp.ClientTimeout(total=30),
    ) as resp:
        resp.raise_for_status()
        data = await resp.json()
        return data.get("job_id", "unknown")


async def run() -> None:
    if not SOURCES:
        print("No sources configured. Add entries to SOURCES in scheduler.py.")
        return

    known_hashes = _load_hashes()
    updated_hashes = dict(known_hashes)

    print(f"Checking {len(SOURCES)} CDC/NEB source(s) for updates...")

    async with aiohttp.ClientSession() as session:
        for source in SOURCES:
            key = _source_key(source)
            try:
                _, current_hash = await _fetch_and_hash(source["url"], session)
                prev_hash = known_hashes.get(key)

                if current_hash == prev_hash:
                    print(f"  [{key}] Unchanged — skipping.")
                    continue

                print(f"  [{key}] New or changed PDF detected — triggering ingestion.")
                job_id = await _trigger_ingest(source, session)
                print(f"  [{key}] Job started: {job_id}")
                updated_hashes[key] = current_hash

            except Exception as exc:
                print(f"  [{key}] Error: {exc}")

    _save_hashes(updated_hashes)
    print("Done.")


if __name__ == "__main__":
    asyncio.run(run())
