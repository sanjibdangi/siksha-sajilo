-- Pool of pre-generated MCQs. Served randomly so each student gets a
-- different 5-question set from the same pool — feels fresh every time.
create table quiz_cache (
  id          uuid primary key default gen_random_uuid(),
  subject_id  text not null,
  grade       int not null,
  topic       text not null,
  year_bs     int not null,
  questions   jsonb not null,  -- QuizQuestion[]
  created_at  timestamptz default now()
);

create index on quiz_cache (subject_id, grade, topic, year_bs, created_at);

-- Flashcard cache: one set per topic/grade, refreshed weekly.
create table flashcard_cache (
  id          uuid primary key default gen_random_uuid(),
  subject_id  text not null,
  grade       int not null,
  topic       text not null,
  year_bs     int not null,
  cards       jsonb not null,  -- Flashcard[]
  created_at  timestamptz default now()
);

create index on flashcard_cache (subject_id, grade, topic, year_bs, created_at);

-- Daily AI interaction counter per user.
-- Only counts expensive real-time modes: tutor, solve, write.
-- Quiz and flashcard are cached and not tracked here.
create table daily_usage (
  user_id   uuid references users(id) on delete cascade,
  date      date not null default current_date,
  count     int not null default 0,
  primary key (user_id, date)
);

-- Store the daily limit per tier in admin_config.
-- Allows changing limits without a code deploy.
insert into admin_config (key, value) values
  ('daily_limit_trial', '100')
on conflict (key) do nothing;

-- Atomically increment a user's daily usage counter and return the new count.
-- Returns null if user already exceeded the limit (so the caller can reject).
create or replace function increment_daily_usage(
  p_user_id uuid,
  p_date    date,
  p_limit   int
)
returns int
language plpgsql
security definer
as $$
declare
  new_count int;
begin
  insert into daily_usage (user_id, date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, date) do update
    set count = daily_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;
