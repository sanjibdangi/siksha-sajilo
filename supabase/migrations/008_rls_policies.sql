-- Row-Level Security for user-owned tables.
-- API routes use the service-role key (bypasses RLS), so these policies protect
-- against any client that might call Supabase directly with the anon key.

-- ── progress ────────────────────────────────────────────────────────────────
alter table progress enable row level security;

create policy "progress: users read own"
  on progress for select
  using (auth.uid() = user_id);

create policy "progress: users insert own"
  on progress for insert
  with check (auth.uid() = user_id);

create policy "progress: users delete own"
  on progress for delete
  using (auth.uid() = user_id);

-- ── mock_attempts ────────────────────────────────────────────────────────────
alter table mock_attempts enable row level security;

create policy "mock_attempts: users read own"
  on mock_attempts for select
  using (auth.uid() = user_id);

create policy "mock_attempts: users insert own"
  on mock_attempts for insert
  with check (auth.uid() = user_id);

create policy "mock_attempts: users update own"
  on mock_attempts for update
  using (auth.uid() = user_id);

-- ── users (profile) ──────────────────────────────────────────────────────────
alter table users enable row level security;

create policy "users: read own profile"
  on users for select
  using (auth.uid() = id);

create policy "users: update own profile"
  on users for update
  using (auth.uid() = id);

-- The handle_new_user() trigger inserts via SECURITY DEFINER, so no insert
-- policy is needed here — the trigger runs as the function owner, not the user.
