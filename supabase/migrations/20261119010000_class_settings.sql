-- Teacher assessment settings per class (chosen challenges, required/optional questions, level, time).
-- Pupils read them with the class code; only someone with the class's teacher code can change them.
-- The teacher code is never returned by any function.
alter table public.classes add column if not exists settings jsonb;
alter table public.classes add column if not exists teacher_code text;

-- The settings for a class, or null (the app then uses its defaults).
create or replace function public.class_settings(p_code text)
returns jsonb language sql security definer set search_path = public stable as $$
  select settings from classes where code = upper(p_code);
$$;

-- Save settings. Returns true when the class exists and the teacher code matches.
create or replace function public.set_class_settings(p_code text, p_teacher_code text, p_settings jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_teacher_code is null or length(p_teacher_code) < 4 or pg_column_size(p_settings) > 4000 then return false; end if;
  update classes set settings = p_settings where code = upper(p_code) and teacher_code = p_teacher_code;
  return found;
end $$;

-- Create a class with a random six-character code; returns the code.
create or replace function public.create_class(p_name text, p_teacher_code text)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if p_teacher_code is null or length(p_teacher_code) < 4 or char_length(trim(p_name)) not between 1 and 40 then return null; end if;
  loop
    -- md5 of random input: hex digits only, minus 0 and 1 so codes are never confused with O and I.
    c := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 6));
    exit when length(c) = 6 and not exists (select 1 from classes where code = c);
  end loop;
  insert into classes (code, name, teacher_code) values (c, trim(p_name), p_teacher_code);
  return c;
end $$;

grant execute on function public.class_settings(text), public.set_class_settings(text, text, jsonb), public.create_class(text, text) to anon, authenticated;

-- The demo class gets a known teacher code for the hackathon demo.
update public.classes set teacher_code = 'TEACH8B' where code = 'DEMO8B' and teacher_code is null;
