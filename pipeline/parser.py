"""Claude-assisted CDC syllabus parser — converts raw OCR text to structured JSON."""

import json
import re
from typing import Any

import anthropic

# Exact prompt from CLAUDE.md §20
PARSER_PROMPT = """You are a curriculum parser for Nepal's CDC (Curriculum Development Centre) syllabus documents.

You will receive raw OCR text extracted from an official CDC PDF. Your job is to extract the structured syllabus into the exact JSON schema below.

RULES:
- If a field is unclear or missing, set it to null — do not guess
- Extract every topic listed, even if formatting is inconsistent
- marks_weight should be extracted from any marks allocation table
- learning_objectives should be extracted from "learning outcomes" or "objectives" sections

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
      "question_types": ["MCQ", "Short answer"],
      "difficulty": "medium"
    }
  }]
}]

Return ONLY the JSON array. No other text."""


async def parse_syllabus(raw_text: str) -> list[dict[str, Any]]:
    """
    Send raw OCR text to Claude for structured extraction.
    Returns a list of unit dicts matching the schema above.
    """
    client = anthropic.Anthropic()

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system=PARSER_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Parse the following CDC syllabus text:\n\n{raw_text}",
            }
        ],
    )

    raw = response.content[0].text.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Strip accidental markdown fences if Claude added them
        match = re.search(r"\[[\s\S]*\]", raw)
        if match:
            return json.loads(match.group(0))
        raise ValueError(
            f"Claude response could not be parsed as JSON.\n"
            f"First 300 chars: {raw[:300]}"
        )
