create table syllabus (
  id              uuid primary key default gen_random_uuid(),
  year_bs         int not null,
  grade           int not null,
  subject_id      text not null,
  unit_no         int,
  unit_title      text,
  chapter_no      int,
  chapter_title   text,
  topic           text not null,
  learning_objectives text[],
  marks_weight    int,
  exam_pattern    jsonb,
  embedding       vector(1024),
  status          text default 'active',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on syllabus using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index on syllabus (year_bs, grade, subject_id);

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
