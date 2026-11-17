-- Safeguard Studio: classes, students and their runs.
-- The browser only ever uses the anon key, so tables have RLS on and NO direct
-- policies. All access goes through the SECURITY DEFINER functions below,
-- which require a class code. We store a first name and class code only.

create table if not exists public.classes (
  code text primary key check (code ~ '^[A-Z0-9]{4,12}$'),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_code text not null references public.classes(code) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  challenge_id text not null,
  mode text not null check (mode in ('build', 'break', 'reflect')),
  script text[] not null default '{}',
  results jsonb not null default '[]',
  scores jsonb,
  reflection jsonb,
  created_at timestamptz not null default now()
);
create index if not exists runs_student_idx on public.runs (student_id, created_at);

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.runs enable row level security;

-- Join a class: returns the new student's id, or null if the code doesn't exist.
create or replace function public.join_class(p_code text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not exists (select 1 from classes where code = upper(p_code)) then return null; end if;
  insert into students (class_code, display_name) values (upper(p_code), left(trim(p_name), 30)) returning id into sid;
  return sid;
end $$;

-- Save one run for a student.
create or replace function public.add_run(
  p_student uuid, p_challenge text, p_mode text, p_script text[], p_results jsonb, p_scores jsonb, p_reflection jsonb
) returns void language sql security definer set search_path = public as $$
  insert into runs (student_id, challenge_id, mode, script, results, scores, reflection)
  select p_student, p_challenge, p_mode, coalesce(p_script, '{}'), coalesce(p_results, '[]'), p_scores, p_reflection
  where exists (select 1 from students where id = p_student);
$$;

-- Everything for one class, oldest first. Needs the class code.
create or replace function public.class_runs(p_code text)
returns table (student_id uuid, display_name text, challenge_id text, mode text, script text[], results jsonb, scores jsonb, reflection jsonb, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select s.id, s.display_name, r.challenge_id, r.mode, r.script, r.results, r.scores, r.reflection, r.created_at
  from students s join runs r on r.student_id = s.id
  where s.class_code = upper(p_code)
  order by r.created_at;
$$;

create or replace function public.class_exists(p_code text)
returns text language sql security definer set search_path = public stable as $$
  select name from classes where code = upper(p_code);
$$;

grant execute on function public.join_class(text, text), public.add_run(uuid, text, text, text[], jsonb, jsonb, jsonb),
  public.class_runs(text), public.class_exists(text) to anon, authenticated;

insert into public.classes (code, name) values ('DEMO8B', '8B Computing') on conflict do nothing;
