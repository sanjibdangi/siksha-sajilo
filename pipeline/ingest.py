"""Supabase upsert — flattens parsed syllabus units into topic-level chunks and stores them."""

import os
from typing import Any

from supabase import Client, create_client

from embedder import embed_batch

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _supabase = create_client(url, key)
    return _supabase


async def ingest_syllabus(
    parsed_units: list[dict[str, Any]],
    grade: int,
    subject_id: str,
    year_bs: int,
    status: str = "draft",
) -> int:
    """
    Flatten parsed unit/chapter/topic tree into one row per topic,
    embed each row, and upsert into the syllabus table as 'draft'.

    Returns the number of chunks ingested.
    """
    rows: list[dict[str, Any]] = []
    embed_inputs: list[str] = []

    for unit in parsed_units:
        unit_no = unit.get("unit_no")
        unit_title = unit.get("unit_title") or ""
        unit_marks = unit.get("marks_weight")

        for chapter in unit.get("chapters") or []:
            chapter_no = chapter.get("chapter_no")
            chapter_title = chapter.get("chapter_title") or ""
            chapter_marks = chapter.get("marks_weight") or unit_marks
            learning_objectives = chapter.get("learning_objectives") or []
            exam_pattern = chapter.get("exam_pattern")
            topics: list[str] = chapter.get("topics") or []

            for topic in topics:
                if not topic:
                    continue
                # Combine context for better embedding quality
                embed_inputs.append(f"{unit_title} {chapter_title} {topic}".strip())
                rows.append(
                    {
                        "year_bs": year_bs,
                        "grade": grade,
                        "subject_id": subject_id,
                        "unit_no": unit_no,
                        "unit_title": unit_title or None,
                        "chapter_no": chapter_no,
                        "chapter_title": chapter_title or None,
                        "topic": topic,
                        "learning_objectives": learning_objectives,
                        "marks_weight": chapter_marks,
                        "exam_pattern": exam_pattern,
                        "status": status,
                    }
                )

    if not rows:
        return 0

    embeddings = await embed_batch(embed_inputs)
    for row, emb in zip(rows, embeddings):
        row["embedding"] = emb

    supabase = _get_supabase()
    supabase.table("syllabus").upsert(rows).execute()
    return len(rows)
