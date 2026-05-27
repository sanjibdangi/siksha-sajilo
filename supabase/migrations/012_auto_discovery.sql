-- Auto-discovery queue: content found by the weekly crawler
create table if not exists auto_discovery_queue (
  id               uuid primary key default gen_random_uuid(),
  source_url       text not null,
  source_site      text,                    -- e.g. "NEB Education", "School Info Nepal"
  detected_title   text,
  detected_grade   text,                    -- '9' | '10' | 'SEE Prep' | null
  detected_subject text,                    -- subject_id or null
  detected_year_bs int,
  content_type     text,                    -- 'past_paper' | 'model_question' | 'notes' | 'textbook' | 'article'
  raw_content      text,
  word_count       int,
  quality_score    int,                     -- 1-10, Claude's assessment
  quality_notes    text,                    -- Claude's reasoning
  status           text default 'pending',  -- pending | approved | rejected | ingested | error
  error_msg        text,
  discovered_at    timestamptz default now(),
  reviewed_at      timestamptz,
  knowledge_source_id uuid references knowledge_sources(id),
  unique(source_url)
);

create index if not exists auto_discovery_queue_status_idx
  on auto_discovery_queue(status, discovered_at desc);

-- Discovery run log: one row per cron execution
create table if not exists discovery_runs (
  id             uuid primary key default gen_random_uuid(),
  ran_at         timestamptz default now(),
  sources_checked int default 0,
  new_found      int default 0,
  errors         int default 0,
  summary        text
);
