import { supabase } from './supabase';
import { groupClassRows, type ClassStudent, type RunRow } from './classData';

export interface RunPayload {
  challenge: string;
  mode: 'build' | 'break' | 'reflect';
  script: string[];
  results: unknown;
  scores?: unknown;
  reflection?: unknown;
}

const QUEUE_KEY = 'safeguard-sync-queue';

function readQueue(): { student: string; run: RunPayload }[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeQueue(q: { student: string; run: RunPayload }[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200)));
  } catch {
    /* storage unavailable: drop silently, local progress is unaffected */
  }
}

async function send(student: string, run: RunPayload) {
  const { error } = await supabase!.rpc('add_run', {
    p_student: student,
    p_challenge: run.challenge,
    p_mode: run.mode,
    p_script: run.script,
    p_results: run.results,
    p_scores: run.scores ?? null,
    p_reflection: run.reflection ?? null,
  });
  if (error) throw error;
}

/** Fire-and-forget. Runs that fail (e.g. offline) are queued and retried on the next push. */
export function pushRun(student: string | null, run: RunPayload) {
  if (!supabase || !student) return;
  const queue = [...readQueue(), { student, run }];
  writeQueue([]);
  (async () => {
    const failed: typeof queue = [];
    for (const item of queue) {
      try {
        await send(item.student, item.run);
      } catch {
        failed.push(item);
      }
    }
    if (failed.length) writeQueue([...readQueue(), ...failed]);
  })();
}

/** Class codes are easy to mistype: try the code as typed, then with zero and letter O swapped. */
async function resolveCode(code: string): Promise<{ code: string; name: string } | { error: unknown } | null> {
  const tries = [...new Set([code, code.replace(/0/g, 'O'), code.replace(/O/g, '0')])];
  for (const c of tries) {
    const { data, error } = await supabase!.rpc('class_exists', { p_code: c });
    if (error) return { error };
    if (data) return { code: c, name: data as string };
  }
  return null;
}

export async function joinClass(code: string, name: string): Promise<{ id: string; className: string; code: string } | { error: string }> {
  if (!supabase) return { error: 'Classes are not set up on this site.' };
  const found = await resolveCode(code);
  if (found && 'error' in found) {
    const e = found.error as { code?: string; message?: string };
    console.error('class_exists failed', e);
    return { error: `Couldn't reach the class database (${e.code ?? ''} ${e.message ?? ''}).` };
  }
  if (!found) return { error: `No class with the code ${code}. Check it with your teacher.` };
  code = found.code;
  const className = found.name;
  const { data, error } = await supabase.rpc('join_class', { p_code: code, p_name: name });
  if (error || !data) {
    if (error) console.error('join_class failed', error);
    return { error: `Could not join right now${error ? ` (${error.message})` : ''}. Try again in a moment.` };
  }
  return { id: data as string, className, code };
}

export async function fetchClass(input: string): Promise<{ name: string; students: ClassStudent[] } | null> {
  if (!supabase) return null;
  const found = await resolveCode(input);
  if (!found || 'error' in found) return null;
  const { code, name } = found;
  const { data, error } = await supabase.rpc('class_runs', { p_code: code });
  if (error) return null;
  return { name: name as string, students: groupClassRows((data ?? []) as RunRow[]) };
}

/** A class found by its code, with the teacher's assessment settings (null = none saved). */
export async function findClass(input: string): Promise<{ code: string; name: string; settings: unknown } | { error: string }> {
  if (!supabase) return { error: 'Class codes need the online version of Safeguard Studio.' };
  const found = await resolveCode(input.trim().toUpperCase());
  if (!found) return { error: `No class with the code ${input.trim().toUpperCase()}. Check it with your teacher.` };
  if ('error' in found) return { error: "Couldn't reach the class database. Try again, or start without a code." };
  const { data } = await supabase.rpc('class_settings', { p_code: found.code });
  return { code: found.code, name: found.name, settings: data ?? null };
}

/** Saves a class's assessment settings. Needs the class's teacher code. */
export async function saveClassSettings(code: string, teacherCode: string, settings: unknown): Promise<string | null> {
  if (!supabase) return 'Classes are not set up on this site.';
  const { data, error } = await supabase.rpc('set_class_settings', { p_code: code.trim().toUpperCase(), p_teacher_code: teacherCode, p_settings: settings });
  if (error) return `Could not save (${error.message}).`;
  return data ? null : 'The class code and teacher code do not match.';
}

/** Creates a class and returns its new code. */
export async function createClass(name: string, teacherCode: string): Promise<{ code: string } | { error: string }> {
  if (!supabase) return { error: 'Classes are not set up on this site.' };
  const { data, error } = await supabase.rpc('create_class', { p_name: name, p_teacher_code: teacherCode });
  if (error || !data) return { error: `Could not create the class${error ? ` (${error.message})` : ''}. Teacher codes need at least 4 characters.` };
  return { code: data as string };
}
