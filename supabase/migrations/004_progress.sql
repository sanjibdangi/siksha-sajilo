create table progress (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  subject_id  text not null,
  topic       text,
  mode        text not null,
  score       int,
  total       int,
  duration_s  int,
  session_at  timestamptz default now()
);

create index on progress (user_id, subject_id);
