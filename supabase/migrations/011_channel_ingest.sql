-- Add embedding column to knowledge_sources so they can be searched via RAG
alter table knowledge_sources add column if not exists embedding vector(1024);

create index if not exists knowledge_sources_embedding_idx
  on knowledge_sources using ivfflat (embedding vector_cosine_ops)
  with (lists = 50);

-- Vector similarity search for knowledge sources (called alongside match_syllabus in rag.ts)
create or replace function match_knowledge_sources(
  query_embedding vector(1024),
  match_grade     text,
  match_subject   text,
  match_year_bs   int,
  match_count     int default 2
)
returns table (
  id          uuid,
  title       text,
  source_type text,
  source_url  text,
  raw_content text,
  topic_tags  text[],
  similarity  float
)
language sql stable
as $$
  select
    id, title, source_type, source_url, raw_content, topic_tags,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_sources
  where
    grade       = match_grade
    and subject_id  = match_subject
    and year_bs     = match_year_bs
    and status      = 'active'
    and embedding   is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Channel batch ingestion job tracker
create table if not exists channel_ingest_jobs (
  id             uuid primary key default gen_random_uuid(),
  channel_url    text not null,
  channel_handle text,
  grade          text not null,
  subject_id     text not null,
  year_bs        int  not null,
  total_videos   int  default 0,
  status         text default 'pending',  -- pending | running | paused | completed | error
  error_msg      text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Individual video extraction tasks within a job
create table if not exists channel_ingest_videos (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references channel_ingest_jobs(id) on delete cascade,
  video_id            text not null,
  video_title         text,
  video_url           text not null,
  status              text default 'pending',  -- pending | done | skipped | error
  error_msg           text,
  knowledge_source_id uuid references knowledge_sources(id),
  created_at          timestamptz default now(),
  unique(job_id, video_id)
);

create index if not exists channel_ingest_videos_job_status_idx
  on channel_ingest_videos(job_id, status);
