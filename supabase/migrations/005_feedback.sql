create table feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  subject_id  text not null,
  grade       text not null,
  topic       text,
  mode        text not null,   -- 'tutor' | 'solve'
  rating      int  not null,   -- 1 = helpful, -1 = not helpful
  created_at  timestamptz default now()
);

create index on feedback (subject_id, grade, topic);
create index on feedback (created_at desc);
