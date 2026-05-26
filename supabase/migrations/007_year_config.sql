-- Single source of truth for the active academic year.
-- Admin updates this when the syllabus year rolls over — no code redeploy needed.
create table admin_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

insert into admin_config (key, value) values ('current_year_bs', '2082');

-- Track which academic year each piece of feedback belongs to
alter table feedback
  add column year_bs int not null default 2082;

create index on feedback (year_bs, subject_id, grade, topic);

-- AI-generated teaching improvements waiting for admin approval
create table pending_improvements (
  id               uuid primary key default gen_random_uuid(),
  year_bs          int  not null,
  subject_id       text not null,
  grade            text not null,
  topic            text not null,
  diagnosis        text not null,   -- what Claude found wrong
  teaching_note    text not null,   -- the generated content to add
  failure_count    int  not null,
  satisfaction_pct int,
  status           text not null default 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at       timestamptz default now(),
  reviewed_at      timestamptz
);

create index on pending_improvements (status, year_bs);
create index on pending_improvements (subject_id, grade, topic, year_bs);
