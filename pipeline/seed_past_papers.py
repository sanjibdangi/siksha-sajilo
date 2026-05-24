"""
SikshaSajilo — Past Paper Seeder
Generates realistic NEB-style exam questions + solutions for each subject/grade/year.
Run: python pipeline/seed_past_papers.py [subject_id[:grade[:year]]]
"""

import json
import os
import re
import sys
import time
from pathlib import Path

# Force UTF-8 output so Devanagari in error messages doesn't crash on Windows cp1252
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import anthropic
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / '.env.local')

ANTHROPIC_KEY = os.environ['ANTHROPIC_API_KEY']
SUPABASE_URL  = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SUPABASE_KEY  = os.environ['SUPABASE_SERVICE_ROLE_KEY']

# NEB exam structure per subject (written exam = 75 marks)
# MCQ: 1 mark each | Short answer: 2-4 marks each | Long answer: 6-8 marks each
EXAM_STRUCTURE = {
    'mathematics': {
        'mcq':   {'count': 10, 'marks_each': 1},
        'short': {'count': 10, 'marks_each': 4},
        'long':  {'count':  3, 'marks_each': 8},
    },
    'science': {
        'mcq':   {'count': 15, 'marks_each': 1},
        'short': {'count':  8, 'marks_each': 4},
        'long':  {'count':  3, 'marks_each': 8},
    },
    'english': {
        'mcq':   {'count': 10, 'marks_each': 1},
        'short': {'count': 10, 'marks_each': 4},
        'long':  {'count':  3, 'marks_each': 8},
    },
    'nepali': {
        'mcq':   {'count': 10, 'marks_each': 1},
        'short': {'count': 10, 'marks_each': 4},
        'long':  {'count':  3, 'marks_each': 8},
    },
    'social': {
        'mcq':   {'count': 15, 'marks_each': 1},
        'short': {'count':  8, 'marks_each': 4},
        'long':  {'count':  3, 'marks_each': 8},
    },
    'optmath': {
        'mcq':   {'count': 10, 'marks_each': 1},
        'short': {'count': 10, 'marks_each': 4},
        'long':  {'count':  3, 'marks_each': 8},
    },
}

SUBJECT_NAMES = {
    'mathematics': 'Compulsory Mathematics',
    'science':     'Science and Technology',
    'english':     'English',
    'nepali':      'Nepali',
    'social':      'Social Studies',
    'optmath':     'Optional Mathematics',
}





def call_claude_section(subject_id: str, grade: int, year_bs: int, section: str) -> list:
    """Generate one section (mcq/short/long) at a time to avoid token truncation."""
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    struct = EXAM_STRUCTURE[subject_id][section]
    name = SUBJECT_NAMES[subject_id]

    section_labels = {'mcq': 'Multiple Choice (MCQ)', 'short': 'Short Answer', 'long': 'Long Answer'}
    mcq_count   = EXAM_STRUCTURE[subject_id]['mcq']['count']
    short_count = EXAM_STRUCTURE[subject_id]['short']['count']
    start_q = {'mcq': 1, 'short': mcq_count + 1, 'long': mcq_count + short_count + 1}

    options_line = '"options": ["A. ...", "B. ...", "C. ...", "D. ..."],' if section == 'mcq' else ''
    correct_line = '"correct": 0,' if section == 'mcq' else ''

    prompt = f"""You are an expert Nepal NEB exam paper setter for Grade {grade} {name}.

Generate the {section_labels[section]} section for the {year_bs} BS NEB exam.

Requirements:
- Exactly {struct['count']} questions
- Each question is {struct['marks_each']} mark(s)
- Question numbers start from {start_q[section]}
- Questions must be from the official CDC Grade {grade} {name} syllabus
- Distribute across different chapters — do not cluster in one topic
- Solutions must be accurate and complete (show all working for math/science)

Return ONLY a JSON array of question objects. No other text:
[
  {{
    "question_no": {start_q[section]},
    "question": "...",
    {options_line}
    {correct_line}
    "marks": {struct['marks_each']},
    "unit_title": "...",
    "chapter_title": "...",
    "topic": "...",
    "solution": "..."
  }}
]"""

    for attempt in range(3):
        try:
            resp = client.messages.create(
                model='claude-haiku-4-5-20251001',
                max_tokens=8192,
                messages=[{'role': 'user', 'content': prompt}],
            )
            raw = resp.content[0].text.strip()
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw).strip()
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
            raise ValueError("Response was not a JSON array")
        except Exception as e:
            if attempt < 2:
                time.sleep(3)
            else:
                raise RuntimeError(f"{section} section failed: {e}")
    return []


def seed_paper(subject_id: str, grade: int, year_bs: int, sb):
    name = SUBJECT_NAMES[subject_id]
    print(f"  Generating {year_bs} BS Grade {grade} {name}...")

    # Generate each section separately to avoid token truncation
    paper: dict[str, list] = {}
    for section in ('mcq', 'short', 'long'):
        paper[section] = call_claude_section(subject_id, grade, year_bs, section)
        time.sleep(1)

    rows = []
    for section in ('mcq', 'short', 'long'):
        for q in (paper.get(section) or []):
            rows.append({
                'year_bs':       year_bs,
                'grade':         grade,
                'subject_id':    subject_id,
                'question_no':   q.get('question_no'),
                'section':       section,
                'question':      q.get('question', ''),
                'options':       q.get('options'),   # None for short/long
                'correct':       q.get('correct'),   # None for short/long
                'marks':         q.get('marks', 1),
                'solution':      q.get('solution', ''),
                'unit_title':    q.get('unit_title'),
                'chapter_title': q.get('chapter_title'),
                'topic':         q.get('topic'),
                'status':        'active',
            })

    if not rows:
        print(f"  WARN: 0 rows — skipping")
        return 0

    # Delete existing, then insert fresh
    sb.table('past_papers').delete().eq('year_bs', year_bs).eq('grade', grade).eq('subject_id', subject_id).execute()
    for i in range(0, len(rows), 50):
        sb.table('past_papers').insert(rows[i:i + 50]).execute()

    print(f"  OK {len(rows)} questions -> Supabase")
    return len(rows)


def main():
    filter_subject = None
    filter_grade   = None
    filter_year    = None

    if len(sys.argv) > 1:
        parts = sys.argv[1].split(':')
        if parts[0]: filter_subject = parts[0]
        if len(parts) > 1 and parts[1]: filter_grade = int(parts[1])
        if len(parts) > 2 and parts[2]: filter_year = int(parts[2])

    # Default: generate 2 recent years for all subjects/grades
    years = [filter_year] if filter_year else [2082, 2081]
    grades = [filter_grade] if filter_grade else [9, 10]
    subjects = [filter_subject] if filter_subject else list(SUBJECT_NAMES.keys())

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    total = 0

    for year_bs in years:
        print(f"\nYear: {year_bs} BS")
        print("=" * 50)
        for subject_id in subjects:
            for grade in grades:
                print(f"\n-> {SUBJECT_NAMES[subject_id]} | Grade {grade}")
                try:
                    n = seed_paper(subject_id, grade, year_bs, sb)
                    total += n
                    time.sleep(2)  # brief pause between Claude calls
                except Exception as e:
                    print(f"  ERROR: {e}")

    print(f"\n{'='*50}")
    print(f"Done. Total questions seeded: {total}")


if __name__ == '__main__':
    main()
