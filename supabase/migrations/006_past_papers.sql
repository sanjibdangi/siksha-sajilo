-- Past papers: NEB-style questions per subject/year/grade
create table past_papers (
  id            uuid primary key default gen_random_uuid(),
  year_bs       int not null,
  grade         int not null,         -- 9 or 10
  subject_id    text not null,
  question_no   int not null,
  section       text not null,        -- 'mcq' | 'short' | 'long'
  question      text not null,
  options       jsonb,                -- ["A. ...", "B. ...", "C. ...", "D. ..."] for MCQ, null for others
  correct       int,                  -- 0-based index for MCQ, null for others
  marks         int not null,
  solution      text not null,        -- AI-generated step-by-step solution
  unit_title    text,                 -- CDC unit this question belongs to
  chapter_title text,
  topic         text,
  status        text default 'active',
  created_at    timestamptz default now()
);

create index on past_papers (year_bs, grade, subject_id);
create index on past_papers (subject_id, section);

-- Mock test attempts: track what the student answered
create table mock_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade,
  year_bs       int not null,
  grade         int not null,
  subject_id    text not null,
  started_at    timestamptz default now(),
  submitted_at  timestamptz,
  duration_s    int,                  -- actual time taken
  total_marks   int,
  scored_marks  int,
  answers       jsonb,                -- {question_id: selected_option_index}
  status        text default 'in_progress'  -- 'in_progress' | 'submitted'
);

create index on mock_attempts (user_id, subject_id);
