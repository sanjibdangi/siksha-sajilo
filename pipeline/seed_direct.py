"""
SikshaSajilo — Direct Syllabus Seeder
Parses CDC-aligned syllabus PDFs (pre-extracted to text), embeds with Voyage, stores in Supabase.
Run: python pipeline/seed_direct.py
"""

import asyncio
import json
import os
import re
import sys
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from supabase import create_client
import voyageai

# ── env ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / '.env.local')

ANTHROPIC_KEY = os.environ['ANTHROPIC_API_KEY']
SUPABASE_URL  = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY  = os.environ['SUPABASE_SERVICE_ROLE_KEY']
VOYAGE_KEY    = os.environ['VOYAGE_API_KEY']
YEAR_BS       = 2083

# ── parser prompt (from CLAUDE.md §20) ───────────────────────────────────────
PARSER_PROMPT = """You are a curriculum parser for Nepal's CDC (Curriculum Development Centre) syllabus documents.

You will receive raw syllabus text extracted from a CDC-aligned PDF for Nepal's Grade 9 or Grade 10 / SEE curriculum.
Your job is to extract the structured syllabus into the exact JSON schema below.

RULES:
- Consolidate terminal/mid-term breakdowns into ONE unified annual list — DEDUPLICATE topics that appear in multiple exam sections
- If marks_weight is unclear, estimate proportionally from the period counts
- Keep topics concise (max 10 words each). Max 6 topics per chapter. No bullet symbols.
- learning_objectives should be short action phrases (e.g. "Solve quadratic equations")
- Use English for all field values, even if the source has Nepali

OUTPUT SCHEMA (JSON array of units):
[{
  "unit_no": 1,
  "unit_title": "...",
  "marks_weight": 20,
  "chapters": [{
    "chapter_no": 1,
    "chapter_title": "...",
    "marks_weight": 8,
    "topics": ["topic 1", "topic 2"],
    "learning_objectives": ["..."],
    "exam_pattern": {
      "question_types": ["MCQ", "Short answer", "Long answer"],
      "difficulty": "medium"
    }
  }]
}]

Return ONLY the JSON array. No other text."""

# Prompt used when no PDF text is available — ask Claude to generate from training knowledge
# NOTE: no .format() call — use GENERATE_PROMPT_TPL.replace() to avoid escaping JSON braces
GENERATE_PROMPT_TPL = """You are a Nepal CDC curriculum expert.

Generate the official Grade GRADE_PLACEHOLDER SUBJECT_PLACEHOLDER syllabus structure following Nepal's CDC Secondary Education Curriculum 2078 (still in use for 2083 BS).

Produce a complete, accurate list of all units, chapters, and topics for this subject and grade.
Use the actual Nepal CDC syllabus content — this will be used to teach real students.

RULES:
- Divide into proper units as the CDC document does (typically 5-8 units)
- Include realistic marks weights that add up to 75 (written exam)
- Max 4 chapters per unit, max 5 topics per chapter — be concise
- Use English for all field values

OUTPUT SCHEMA (JSON array of units):
[{
  "unit_no": 1,
  "unit_title": "...",
  "marks_weight": 20,
  "chapters": [{
    "chapter_no": 1,
    "chapter_title": "...",
    "marks_weight": 8,
    "topics": ["topic 1", "topic 2"],
    "learning_objectives": ["..."],
    "exam_pattern": {
      "question_types": ["MCQ", "Short answer", "Long answer"],
      "difficulty": "medium"
    }
  }]
}]

Return ONLY the JSON array. No other text."""

SUBJECTS = {
    # Compulsory subjects
    'mathematics': 'Compulsory Mathematics',
    'science':     'Science and Technology',
    'english':     'English',
    'nepali':      'Nepali',
    'social':      'Social Studies and Population Education',
    'hpe':         'Health, Physical and Creative Education',
    # Optional subjects
    'optmath':     'Optional Mathematics',
    'computer':    'Computer Science and IT',
    'account':     'Account',
    'economics':   'Economics',
}


# ── helpers ───────────────────────────────────────────────────────────────────

def load_text(subject_id: str, grade: int) -> str | None:
    text_dir = Path(__file__).parent / 'seed_texts'
    aliases = {'mathematics': 'math', 'computer': 'ict', 'economics': 'econ', 'account': 'accounts'}
    alias = aliases.get(subject_id, subject_id)
    candidates = [
        text_dir / f'grade{grade}_{subject_id}.txt',
        text_dir / f'grade{grade}_{alias}.txt',
    ]
    for p in candidates:
        if p and p.exists():
            txt = p.read_text(encoding='utf-8', errors='replace').strip()
            if len(txt) < 200:
                continue
            # Reject Preeti/Kantipur-encoded Nepali (high non-ASCII ratio)
            ascii_ratio = sum(c.isascii() for c in txt) / len(txt)
            if ascii_ratio < 0.4:
                continue
            return txt
    return None


def parse_json(raw: str) -> list[dict]:
    raw = raw.strip()
    # Strip markdown fences
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    raw = raw.strip()
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return parsed
        # Claude sometimes returns {"units": [...]} or {"curriculum": [...]}
        for v in parsed.values():
            if isinstance(v, list):
                return v
    except json.JSONDecodeError:
        pass
    # Last resort: extract first [...] array from the string
    m = re.search(r'\[[\s\S]*\]', raw)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Cannot parse JSON. First 300 chars:\n{raw[:300]}")


def call_claude(system: str, user_msg: str) -> list[dict]:
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    resp = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=8192,
        system=system,
        messages=[{'role': 'user', 'content': user_msg}],
    )
    return parse_json(resp.content[0].text)


def embed_texts(texts: list[str], voyage_client) -> list[list[float]]:
    import time
    out = []
    batch_size = 32
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        for attempt in range(5):
            try:
                resp = voyage_client.embed(batch, model='voyage-multilingual-2')
                out.extend(resp.embeddings)
                break
            except Exception as e:
                wait = 25 * (attempt + 1)
                print(f"  Voyage rate limit — waiting {wait}s...")
                time.sleep(wait)
        else:
            raise RuntimeError(f"Embedding failed after 5 retries for batch {i}")
        # Respect 3 RPM free tier limit
        if i + batch_size < len(texts):
            time.sleep(21)
    return out


def flatten(units: list[dict], subject_id: str, grade: int) -> list[dict]:
    rows = []
    for unit in units:
        for ch in (unit.get('chapters') or []):
            for topic in (ch.get('topics') or []):
                rows.append({
                    'year_bs':             YEAR_BS,
                    'grade':               grade,
                    'subject_id':          subject_id,
                    'unit_no':             unit.get('unit_no'),
                    'unit_title':          unit.get('unit_title'),
                    'chapter_no':          ch.get('chapter_no'),
                    'chapter_title':       ch.get('chapter_title'),
                    'topic':               topic,
                    'learning_objectives': ch.get('learning_objectives') or [],
                    'marks_weight':        ch.get('marks_weight') or unit.get('marks_weight'),
                    'exam_pattern':        ch.get('exam_pattern'),
                    'status':              'active',
                })
    return rows


# ── core seeding logic ────────────────────────────────────────────────────────

def seed_subject(subject_id: str, grade: int, voyage_client, sb):
    subject_name = SUBJECTS[subject_id]
    label = f"Grade {grade} {subject_name}"

    raw_text = load_text(subject_id, grade)

    if raw_text:
        print(f"  Parsing {label} from PDF text ({len(raw_text):,} chars)...")
        user_msg = (
            f"Parse the following Nepal CDC Grade {grade} {subject_name} syllabus text "
            f"into the schema. Consolidate all terminal exam sections into one unified annual list.\n\n"
            f"{raw_text}"
        )
        units = call_claude(PARSER_PROMPT, user_msg)
    else:
        print(f"  Generating {label} from CDC training knowledge...")
        system = GENERATE_PROMPT_TPL.replace('GRADE_PLACEHOLDER', str(grade)).replace('SUBJECT_PLACEHOLDER', subject_name)
        units = call_claude(system, f"Generate the Grade {grade} {subject_name} syllabus.")

    rows = flatten(units, subject_id, grade)
    if not rows:
        print(f"  WARN: 0 rows extracted — skipping")
        return 0

    print(f"  Embedding {len(rows)} topic rows...")
    embed_texts_list = [
        f"{r['unit_title'] or ''} | {r['chapter_title'] or ''} | {r['topic']}"
        for r in rows
    ]
    embeddings = embed_texts(embed_texts_list, voyage_client)

    for row, emb in zip(rows, embeddings):
        row['embedding'] = emb

    # Delete existing rows for this subject/grade/year, then insert fresh
    sb.table('syllabus').delete().eq('year_bs', YEAR_BS).eq('grade', grade).eq('subject_id', subject_id).execute()

    for i in range(0, len(rows), 50):
        sb.table('syllabus').insert(rows[i:i + 50]).execute()

    print(f"  OK {len(rows)} rows -> Supabase")
    return len(rows)


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    # parse CLI args: optional filter like "mathematics:9" or "science"
    filter_subject = None
    filter_grade   = None
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if ':' in arg:
            filter_subject, g = arg.split(':', 1)
            filter_grade = int(g)
        else:
            filter_subject = arg

    print(f"SikshaSajilo Seeder  |  year_bs={YEAR_BS}")
    print("=" * 50)

    voyage_client = voyageai.Client(api_key=VOYAGE_KEY)
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    total = 0
    for subj_id in SUBJECTS:
        if filter_subject and subj_id != filter_subject:
            continue
        for grade in [9, 10]:
            if filter_grade and grade != filter_grade:
                continue
            print(f"\n-> {SUBJECTS[subj_id]} | Grade {grade}")
            try:
                n = seed_subject(subj_id, grade, voyage_client, sb)
                total += n
            except Exception as e:
                print(f"  ERROR: {e}")

    print(f"\n{'='*50}")
    print(f"Done. Total rows seeded: {total}")


if __name__ == '__main__':
    main()
