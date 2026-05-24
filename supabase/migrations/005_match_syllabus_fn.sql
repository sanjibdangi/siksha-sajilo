-- RAG retrieval function — must be created in Supabase SQL editor
-- Navigate to: supabase.com → your project → SQL Editor → paste & run

create or replace function match_syllabus(
  query_embedding vector(1024),
  match_grade int,
  match_subject text,
  match_year_bs int,
  match_count int default 3
)
returns table (
  id uuid,
  unit_no int,
  unit_title text,
  chapter_no int,
  chapter_title text,
  topic text,
  learning_objectives text[],
  marks_weight int,
  similarity float
)
language sql stable
as $$
  select
    id, unit_no, unit_title, chapter_no, chapter_title,
    topic, learning_objectives, marks_weight,
    1 - (embedding <=> query_embedding) as similarity
  from syllabus
  where
    grade = match_grade
    and subject_id = match_subject
    and year_bs = match_year_bs
    and status = 'active'
  order by embedding <=> query_embedding
  limit match_count;
$$;
