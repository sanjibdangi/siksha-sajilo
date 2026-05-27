#!/usr/bin/env python3
"""
SikshaSajilo — YouTube Audio Ingest Pipeline
Works even when YouTube transcripts are DISABLED.

Pipeline:
  1. yt-dlp       — downloads audio as MP3 (free, bypasses transcript restrictions)
  2. Whisper API  — OpenAI speech-to-text (~$0.006/min, handles Nepali + English mix)
  3. Claude Haiku — cleans raw transcript: fixes math notation, removes fillers,
                    adds structure, normalises Nepali-English code-switching
  4. Voyage AI    — generates embedding for RAG similarity search
  5. Supabase     — upserts into knowledge_sources

Requirements:
  pip install -r scripts/requirements.txt
  System: ffmpeg must be installed
    Windows:  winget install ffmpeg
    Mac:      brew install ffmpeg

Env vars needed in .env.local:
  OPENAI_API_KEY          — for Whisper API transcription
  ANTHROPIC_API_KEY       — for Claude Haiku cleanup
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  VOYAGE_API_KEY          — for embedding (optional but recommended)

Usage:
  python scripts/youtube_ingest.py \\
    --input "https://youtu.be/XXXX" \\
    --grade "SEE Prep" \\
    --subject mathematics \\
    --title "SEE Maths Model Questions Solution 2082" \\
    --year 2082

  # Preview transcription without inserting to DB:
  python scripts/youtube_ingest.py --input "..." --grade 10 --subject science \\
    --title "Test" --dry-run

  # Keep the downloaded audio file after processing:
  python scripts/youtube_ingest.py --input "..." ... --keep-audio

Cost estimate per video:
  Whisper API:  $0.006 per minute  (10-min video = ~$0.06)
  Claude Haiku: ~$0.01 per video   (cleanup/structuring)
  Total:        ~$0.07 for a 10-min video
"""

import argparse
import os
import sys
import io
import tempfile
import shutil
from pathlib import Path

# Force UTF-8 output on Windows (handles Devanagari and other non-ASCII)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Load .env.local ────────────────────────────────────────────────────────────
script_dir = Path(__file__).parent
project_dir = script_dir.parent
env_file = project_dir / ".env.local"

try:
    from dotenv import load_dotenv
    if env_file.exists():
        load_dotenv(env_file)
        print(f"[env] Loaded {env_file}")
    else:
        print(f"[warn] No .env.local found — using system env vars")
except ImportError:
    print("[warn] python-dotenv not installed; using system env vars only")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY", "")

# Whisper API max file size is 25MB. We download at 96kbps mp3.
# At 96kbps: 30 min = ~21.6 MB (fine), 45 min = ~32.4 MB (needs chunking)
WHISPER_MAX_BYTES = 24 * 1024 * 1024   # 24 MB safe limit
AUDIO_BITRATE = "96k"
CHUNK_DURATION_MS = 20 * 60 * 1000     # 20-min chunks when splitting

VALID_GRADES = {"9", "10", "SEE Prep"}
VALID_SUBJECTS = {"mathematics", "science", "english", "nepali", "social", "optmath"}


# ── Step 1: Download audio ─────────────────────────────────────────────────────

def check_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        print("[error] ffmpeg is not installed or not in PATH.")
        print("        Install it with:")
        print("          Windows: winget install ffmpeg")
        print("          Mac:     brew install ffmpeg")
        sys.exit(1)


def download_audio(url: str, output_dir: str) -> tuple[str, str, float]:
    """
    Download audio from YouTube URL as MP3.
    Returns (file_path, video_title, duration_seconds).
    """
    try:
        import yt_dlp
    except ImportError:
        print("[error] yt-dlp not installed. Run: pip install yt-dlp")
        sys.exit(1)

    output_template = os.path.join(output_dir, "audio.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": AUDIO_BITRATE.rstrip("k"),
        }],
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
    }

    print(f"[yt-dlp] Downloading audio from: {url}")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title", "Unknown YouTube Video")
        duration = float(info.get("duration", 0))

    mp3_path = os.path.join(output_dir, "audio.mp3")
    if not os.path.exists(mp3_path):
        raise FileNotFoundError("yt-dlp did not produce audio.mp3 — is ffmpeg installed?")

    size_mb = os.path.getsize(mp3_path) / (1024 * 1024)
    duration_min = duration / 60
    print(f"[yt-dlp] Downloaded: '{title}'")
    print(f"         Duration: {duration_min:.1f} min | File: {size_mb:.1f} MB")

    return mp3_path, title, duration


# ── Step 2: Transcribe with OpenAI Whisper API ────────────────────────────────

def transcribe_audio(audio_path: str, language: str | None = None) -> str:
    """
    Transcribe audio using OpenAI Whisper API.
    Handles files > 24MB by splitting into chunks with pydub.
    Returns raw transcript text.
    """
    if not OPENAI_API_KEY:
        print("[error] OPENAI_API_KEY is not set in .env.local or environment.")
        sys.exit(1)

    try:
        from openai import OpenAI
    except ImportError:
        print("[error] openai package not installed. Run: pip install openai")
        sys.exit(1)

    client = OpenAI(api_key=OPENAI_API_KEY)
    file_size = os.path.getsize(audio_path)

    if file_size <= WHISPER_MAX_BYTES:
        # Single-chunk transcription
        return _transcribe_single(client, audio_path, language)
    else:
        # File too large — split into chunks
        size_mb = file_size / (1024 * 1024)
        print(f"[whisper] File is {size_mb:.1f} MB > 24 MB limit — splitting into chunks")
        return _transcribe_chunked(client, audio_path, language)


def _transcribe_single(client, audio_path: str, language: str | None) -> str:
    print(f"[whisper] Sending to Whisper API (language={'auto-detect' if not language else language})...")
    with open(audio_path, "rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language=language,      # None = auto-detect (best for Nepali+English mix)
            response_format="text",
        )
    text = result if isinstance(result, str) else result.text
    word_count = len(text.split())
    print(f"[whisper] Transcribed: ~{word_count} words")
    return text


def _transcribe_chunked(client, audio_path: str, language: str | None) -> str:
    try:
        from pydub import AudioSegment
    except ImportError:
        print("[error] pydub not installed. Run: pip install pydub")
        sys.exit(1)

    print("[whisper] Loading audio for chunking...")
    audio = AudioSegment.from_mp3(audio_path)
    total_ms = len(audio)
    chunks = []
    start = 0
    chunk_idx = 1

    while start < total_ms:
        end = min(start + CHUNK_DURATION_MS, total_ms)
        chunk = audio[start:end]
        chunk_mins = (end - start) / 60000
        print(f"[whisper] Chunk {chunk_idx}: {start//60000:.1f}–{end//60000:.1f} min ({chunk_mins:.1f} min)")

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            chunk.export(tmp.name, format="mp3", bitrate=AUDIO_BITRATE)
            chunk_text = _transcribe_single(client, tmp.name, language)
            chunks.append(chunk_text)
            os.unlink(tmp.name)

        start = end
        chunk_idx += 1

    return "\n\n".join(chunks)


# ── Step 3: Clean up with Claude Haiku ────────────────────────────────────────

CLEANUP_PROMPT = """\
You are processing a raw speech-to-text transcription from a Nepal educational YouTube video.

Video details:
- Subject: {subject}
- Grade: {grade}
- Title: {title}

The speaker teaches in Nepali, English, or a natural mix of both (very common in Nepal).

Raw transcription:
---
{raw_transcript}
---

Your task is to produce clean, structured markdown that a student can actually read and learn from.

RULES:
1. Fix grammar, punctuation, and sentence boundaries
2. Convert spoken math to proper notation:
   - "sin theta" -> sin θ, "cos theta" -> cos θ, "tan theta" -> tan θ
   - "x squared" -> x², "x cubed" -> x³, "square root of x" -> √x
   - "pi" -> π, "alpha" -> α, "beta" -> β
   - Fractions spoken as "a over b" -> a/b
   - "plus or minus" -> ±
3. Add clear structure with ## headers at topic transitions
4. Use **bold** for key terms when first introduced
5. Use numbered lists for steps, bullet points for key points
6. Remove filler words: um, uh, "right?", "okay so", "you know", "basically", "ni" (when filler), "hai"
7. Preserve Nepali explanations — do NOT translate them
8. If the speaker gives a worked example, present it clearly as a worked example block
9. Keep it educational and student-friendly — this goes into an AI tutor's knowledge base

Output clean markdown only. No preamble, no meta-commentary."""


def cleanup_transcript(raw: str, subject: str, grade: str, title: str) -> str:
    if not ANTHROPIC_API_KEY:
        print("[warn] ANTHROPIC_API_KEY not set — skipping cleanup, using raw transcript")
        return raw

    try:
        import anthropic
    except ImportError:
        print("[warn] anthropic package not installed — skipping cleanup")
        return raw

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Haiku has 200k context. We truncate raw transcript at ~80k chars (~20k tokens) to leave room for output
    truncated = raw[:80000]
    if len(raw) > 80000:
        print(f"[haiku] Transcript truncated from {len(raw)} to 80000 chars for context limit")

    prompt = CLEANUP_PROMPT.format(
        subject=subject,
        grade=grade,
        title=title,
        raw_transcript=truncated,
    )

    print("[haiku] Cleaning up transcript with Claude Haiku...")
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )

    cleaned = response.content[0].text.strip()
    print(f"[haiku] Cleanup done: {len(cleaned.split())} words in structured output")
    return cleaned


# ── Step 4: Generate embedding ────────────────────────────────────────────────

def generate_embedding(text: str) -> list[float] | None:
    if not VOYAGE_API_KEY:
        print("[warn] No VOYAGE_API_KEY — storing without embedding (RAG similarity won't work for this item)")
        return None
    try:
        import voyageai
        client = voyageai.Client(api_key=VOYAGE_API_KEY)
        result = client.embed([text[:8000]], model="voyage-multilingual-2", input_type="document")
        embedding = result.embeddings[0]
        print(f"[voyage] Generated {len(embedding)}-dim embedding")
        return embedding
    except Exception as e:
        print(f"[warn] Embedding failed ({e}) — storing without embedding")
        return None


# ── Step 5: Upsert to Supabase ────────────────────────────────────────────────

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
        print(f"[supabase] Upserted — id: {record.get('id')}")
    else:
        print("[supabase] Upsert completed")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="YouTube → Whisper API → Claude Haiku → Supabase knowledge pipeline"
    )
    parser.add_argument("--input", required=True, help="YouTube URL (youtube.com or youtu.be)")
    parser.add_argument("--grade", required=True, choices=list(VALID_GRADES), help="Grade level")
    parser.add_argument("--subject", required=True, choices=list(VALID_SUBJECTS), help="Subject ID")
    parser.add_argument("--title", required=True, help="Human-readable title for this video")
    parser.add_argument("--year", type=int, default=None, help="BS year (e.g. 2082)")
    parser.add_argument("--language", default=None,
                        help="Whisper language code (default: auto-detect). Use 'ne' for Nepali-only, 'en' for English-only")
    parser.add_argument("--dry-run", action="store_true",
                        help="Download and transcribe, print result, do NOT insert to DB")
    parser.add_argument("--keep-audio", action="store_true",
                        help="Keep the downloaded MP3 file after processing (saved to scripts/)")
    args = parser.parse_args()

    if "youtube" not in args.input.lower() and "youtu.be" not in args.input.lower():
        print("[warn] Input does not look like a YouTube URL. Proceeding anyway.")

    # Validate environment before starting
    missing = []
    if not OPENAI_API_KEY:   missing.append("OPENAI_API_KEY")
    if not ANTHROPIC_API_KEY: missing.append("ANTHROPIC_API_KEY (optional but recommended for cleanup)")
    if missing:
        for m in missing:
            if "optional" not in m:
                print(f"[error] Missing required env var: {m}")
                sys.exit(1)
            else:
                print(f"[warn] {m}")

    check_ffmpeg()

    # Work in a temp directory
    tmp_dir = tempfile.mkdtemp(prefix="siksha_yt_")
    try:
        # ── Step 1: Download ─────────────────────────────────────────────────
        audio_path, detected_title, duration_sec = download_audio(args.input, tmp_dir)
        display_title = args.title or detected_title

        # ── Step 2: Transcribe ───────────────────────────────────────────────
        raw_transcript = transcribe_audio(audio_path, language=args.language)

        if not raw_transcript or len(raw_transcript.split()) < 20:
            print("[error] Whisper returned an empty or near-empty transcript.")
            print("        The audio may be silent, music-only, or in an unsupported format.")
            sys.exit(1)

        # ── Step 3: Cleanup ──────────────────────────────────────────────────
        cleaned_text = cleanup_transcript(raw_transcript, args.subject, args.grade, display_title)

        if args.dry_run:
            print("\n" + "=" * 70)
            print(f"TITLE: {display_title}")
            print(f"GRADE: {args.grade} | SUBJECT: {args.subject}")
            print(f"DURATION: {duration_sec/60:.1f} min | WORDS: {len(cleaned_text.split())}")
            print("=" * 70)
            print("\n--- RAW TRANSCRIPT (first 500 chars) ---")
            print(raw_transcript[:500])
            print("\n--- CLEANED OUTPUT (first 2000 chars) ---")
            print(cleaned_text[:2000])
            if len(cleaned_text) > 2000:
                print(f"\n... [{len(cleaned_text)-2000} more chars not shown]")
            print("=" * 70)
            print("[dry-run] Not inserting to DB. Remove --dry-run to ingest.")
            return

        # ── Step 4: Embed ────────────────────────────────────────────────────
        embedding = generate_embedding(cleaned_text)

        # ── Step 5: Upsert ───────────────────────────────────────────────────
        payload = {
            "source_type": "youtube_transcript",
            "title": display_title,
            "source_url": args.input,
            "grade": args.grade,
            "subject_id": args.subject,
            "year_bs": args.year,
            "topic_tags": [args.subject, "youtube_transcript", "video"],
            "raw_content": cleaned_text,
            "word_count": len(cleaned_text.split()),
            "status": "active",
            "embedding": embedding,
        }
        upsert_to_supabase(payload)

        print(f"\n[done] '{display_title}' ingested into knowledge_sources.")
        print(f"       Grade: {args.grade} | Subject: {args.subject} | Duration: {duration_sec/60:.1f} min")
        print(f"       Words (cleaned): {len(cleaned_text.split())} | Embedding: {'yes' if embedding else 'no'}")

        # Keep audio if requested
        if args.keep_audio:
            dest = script_dir / f"{display_title[:60].replace('/', '_')}.mp3"
            shutil.copy(audio_path, dest)
            print(f"       Audio saved: {dest}")

    finally:
        # Always clean up temp dir
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
