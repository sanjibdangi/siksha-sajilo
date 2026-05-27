-- RLS for daily_usage so students cannot read other students' usage counts
-- The increment_daily_usage function is SECURITY DEFINER so it bypasses RLS,
-- keeping the atomic upsert path working unchanged.

alter table daily_usage enable row level security;

create policy "users can read own usage"
  on daily_usage for select
  using (auth.uid() = user_id);

create policy "users can insert own usage"
  on daily_usage for insert
  with check (auth.uid() = user_id);

create policy "users can update own usage"
  on daily_usage for update
  using (auth.uid() = user_id);
