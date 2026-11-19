-- AI calls log for the literacy-ai Edge Function's hourly rate limit.
-- Only the function (service role) reads and writes it: RLS on, no policies.
-- Stores the task name and time only, never pupil text.
create table if not exists public.ai_calls (
  id bigserial primary key,
  task text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_calls_created_idx on public.ai_calls (created_at);
alter table public.ai_calls enable row level security;
