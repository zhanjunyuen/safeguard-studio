-- Rate-limit log for the literacy-ai Edge Function under its own name, so the function can run in a
-- Supabase project shared with another app (which may have its own ai_calls table).
-- Stores the task name and time only, never pupil text. Only the function (service role) uses it.
create table if not exists public.literacy_ai_calls (
  id bigserial primary key,
  task text not null,
  created_at timestamptz not null default now()
);
create index if not exists literacy_ai_calls_created_idx on public.literacy_ai_calls (created_at);
alter table public.literacy_ai_calls enable row level security;
