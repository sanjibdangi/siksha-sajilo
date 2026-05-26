create table knowledge_sources (
  id           uuid primary key default gen_random_uuid(),
  source_type  text not null,   -- 'youtube' | 'pdf' | 'docx' | 'text'
  title        text,
  source_url   text,            -- YouTube URL
  file_name    text,            -- original upload filename
  grade        text not null,
  subject_id   text not null,
  topic_tags   text[],
  year_bs      int  default 2082,
  raw_content  text not null,
  word_count   int,
  status       text default 'active',  -- 'active' | 'archived'
  created_at   timestamptz default now()
);

create index on knowledge_sources (subject_id, grade);
create index on knowledge_sources (status);
