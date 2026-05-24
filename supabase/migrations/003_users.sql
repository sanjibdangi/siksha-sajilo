create table users (
  id          uuid references auth.users primary key,
  name        text,
  grade       text,
  school      text,
  district    text,
  medium      text,
  created_at  timestamptz default now()
);
