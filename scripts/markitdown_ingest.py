#!/usr/bin/env python3
"""
SikshaSajilo — MarkItDown Local Ingest
Converts files/URLs to markdown and upserts into knowledge_sources with embedding.

Supports (all free, no Anthropic key needed):
  - YouTube URLs  → transcript extracted
  - PDF files     → text extracted
  - DOCX/PPTX/XLSX → full document text
  - Images        → EXIF metadata + visible text
  - HTML/web URLs → page content
  - ZIP archives  → all contained files

Setup (run once):
  pip install -r scripts/requirements.txt

Usage:
  python scripts/markitdown_ingest.py \\
    --input "https://www.youtube.com/watch?v=XXXX" \\
    --grade 10 \\
    --subject mathematics \\
    --type notes \\
    --title "Class 10 Maths — Trigonometry Explained"

  python scripts/markitdown_ingest.py \\
    --input "/path/to/see-2079-math.pdf" \\
    --grade "SEE Prep" \\
    --subject mathematics \\
    --type past_paper \\
    --year 2079 \\
    --title "SEE 2079 Mathematics Past Paper"

Flags:
  --input    URL or local file path (required)
  --grade    9 | 10 | SEE Prep  (required)
  --subject  mathematics | science | english | nepali | social | hpe | optmath | computer | account | economics  (required)
  --type     notes | past_paper | model_question | textbook | article  (required)
  --title    Human-readable title (required)
  --year     BS year integer, e.g. 2079  (optional)
  --tags     Comma-separated extra tags  (optional)
  --dry-run  Print extracted markdown, do not insert  (optional)
"""

import argparse
import os
import sys
import io
from pathlib import Path
from datetime import datetime

# Force UTF-8 output on Windows (handles Devanagari and other non-ASCII)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Load env vars from .env.local ──────────────────────────────────────────────
script_dir = Path(__file__).parent
project_dir = script_dir.parent
env_file = project_dir / ".env.local"

try:
    from dotenv import load_dotenv
    if env_file.exists():
        load_dotenv(env_file)
        print(f"[env] Loaded {env_file}")
    else:
        print(f"[warn] No .env.local found at {env_file} — using system env vars")
except ImportError:
    print("[warn] python-dotenv not installed; using system env vars only")


SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY", "")

VALID_GRADES = {"9", "10", "SEE Prep"}
VALID_SUBJECTS = {
    # Compulsory
    "mathematics", "science", "english", "nepali", "social", "hpe",
    # Optional
    "optmath", "computer", "account", "economics",
}
VALID_TYPES = {"notes", "past_paper", "model_question", "textbook", "article", "youtube_transcript", "local_pdf", "local_docx"}


def detect_input_type(input_str: str) -> str:
    lower = input_str.lower()
    if "youtube.com" in lower or "youtu.be" in lower:
        return "youtube_transcript"
    if lower.endswith(".pdf"):
        return "local_pdf"
    if lower.endswith(".docx") or lower.endswith(".doc"):
        return "local_docx"
    if lower.endswith((".pptx", ".ppt")):
        return "local_pptx"
    if lower.endswith((".xlsx", ".xls", ".csv")):
        return "local_spreadsheet"
    if lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
        return "local_image"
    return "article"


def convert_with_markitdown(input_path: str) -> str:
    try:
        from markitdown import MarkItDown
    except ImportError:
        print("[error] MarkItDown not installed. Run: pip install 'markitdown[all]'")
        sys.exit(1)

    print(f"[markitdown] Converting: {input_path}")
    md = MarkItDown()
    result = md.convert(input_path)
    text = result.text_content or ""
    if not text.strip():
        print("[error] MarkItDown returned empty content")
        sys.exit(1)

    word_count = len(text.split())
    print(f"[markitdown] Extracted {len(text)} chars / ~{word_count} words")

    # Detect YouTube footer-only extraction (transcript was disabled)
    if word_count < 80 and ("youtube.com/about" in text or "Google LLC" in text):
        print("[error] YouTube transcript is DISABLED for this video.")
        print("        MarkItDown only extracted the page footer — no actual content.")
        print("        Options: find a video with captions enabled, or use AI Knowledge Generator instead.")
        sys.exit(1)

    if word_count < 30:
        print(f"[warn] Very short content ({word_count} words) — may not be useful. Continuing anyway.")

    return text


def generate_embedding(text: str) -> list[float] | None:
    if not VOYAGE_API_KEY:
        print("[warn] No VOYAGE_API_KEY — storing without embedding (RAG similarity search won't work for this item)")
        return None
    try:
        import voyageai
        client = voyageai.Client(api_key=VOYAGE_API_KEY)
        # Voyage accepts up to ~120k tokens; we slice to ~8000 chars (~2000 tokens) to match existing pattern
        result = client.embed([text[:8000]], model="voyage-multilingual-2", input_type="document")
        embedding = result.embeddings[0]
        print(f"[voyage] Generated {len(embedding)}-dim embedding")
        return embedding
    except Exception as e:
        print(f"[warn] Embedding failed ({e}) — storing without embedding")
        return None


def upsert_to_supabase(payload: dict) -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("[error] SUPABASE URL or SERVICE_ROLE_KEY missing from environment")
        sys.exit(1)
    try:
        from supabase import create_client
    except ImportError:
        print("[error] supabase-py not installed. Run: pip install supabase")
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    resp = (
        client.table("knowledge_sources")
        .upsert(payload, on_conflict="source_url")
        .execute()
    )
    if resp.data:
        record = resp.data[0]
        print(f"[supabase] Upserted — id: {record.get('id')} | title: {record.get('title','?')[:60]}")
    else:
        print(f"[supabase] Upsert completed (no data returned)")


def main():
    parser = argparse.ArgumentParser(description="MarkItDown → SikshaSajilo knowledge_sources ingestion")
    parser.add_argument("--input", required=True, help="URL or local file path to convert")
    parser.add_argument("--grade", required=True, choices=list(VALID_GRADES), help="Grade level")
    parser.add_argument("--subject", required=True, choices=list(VALID_SUBJECTS), help="Subject ID")
    parser.add_argument("--type", dest="content_type", required=True, help="Content type")
    parser.add_argument("--title", required=True, help="Human-readable title for this content")
    parser.add_argument("--year", type=int, default=None, help="BS year (e.g. 2079)")
    parser.add_argument("--tags", default="", help="Comma-separated additional topic tags")
    parser.add_argument("--dry-run", action="store_true", help="Print markdown, do not insert to DB")
    args = parser.parse_args()

    # ── Convert ─────────────────────────────────────────────────────────────────
    markdown_text = convert_with_markitdown(args.input)

    if args.dry_run:
        print("\n" + "-" * 60)
        print(markdown_text[:3000])
        if len(markdown_text) > 3000:
            print(f"\n... [{len(markdown_text) - 3000} more chars truncated]")
        print("-" * 60)
        print("[dry-run] Not inserting to DB. Remove --dry-run to ingest.")
        return

    # ── Embedding ────────────────────────────────────────────────────────────────
    embedding = generate_embedding(markdown_text)

    # ── Build payload ────────────────────────────────────────────────────────────
    detected_type = detect_input_type(args.input)
    source_type = args.content_type if args.content_type in VALID_TYPES else detected_type

    extra_tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    topic_tags = list({args.subject, source_type, detected_type, *extra_tags} - {""})

    # Use input as source_url (for local files, store filename)
    source_url = args.input if args.input.startswith("http") else Path(args.input).name

    payload = {
        "source_type": source_type,
        "title": args.title,
        "source_url": source_url,
        "grade": args.grade,
        "subject_id": args.subject,
        "year_bs": args.year,
        "topic_tags": topic_tags,
        "raw_content": markdown_text,
        "word_count": len(markdown_text.split()),
        "status": "active",
        "embedding": embedding,
    }

    # ── Upsert ───────────────────────────────────────────────────────────────────
    upsert_to_supabase(payload)
    print(f"\n[done] '{args.title}' ingested into knowledge_sources.")
    print(f"       Grade: {args.grade} | Subject: {args.subject} | Type: {source_type}")
    print(f"       Words: {payload['word_count']} | Embedding: {'yes' if embedding else 'no'}")


if __name__ == "__main__":
    main()
