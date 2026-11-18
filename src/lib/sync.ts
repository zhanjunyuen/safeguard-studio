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

export async function joinClass(code: string, name: string): Promise<{ id: string; className: string } | { error: string }> {
  if (!supabase) return { error: 'Classes are not set up on this site.' };
  const { data: className, error: lookupErr } = await supabase.rpc('class_exists', { p_code: code });
  if (lookupErr) {
    console.error('class_exists failed', lookupErr);
    return { error: `Couldn't reach the class database (${lookupErr.code ?? ''} ${lookupErr.message}).` };
  }
  if (!className) return { error: `No class with the code ${code}. Check it with your teacher (the letter O and the number 0 look alike).` };
  const { data, error } = await supabase.rpc('join_class', { p_code: code, p_name: name });
  if (error || !data) {
    if (error) console.error('join_class failed', error);
    return { error: `Could not join right now${error ? ` (${error.message})` : ''}. Try again in a moment.` };
  }
  return { id: data as string, className: className as string };
}

export async function fetchClass(code: string): Promise<{ name: string; students: ClassStudent[] } | null> {
  if (!supabase) return null;
  const { data: name, error: lookupErr } = await supabase.rpc('class_exists', { p_code: code });
  if (lookupErr) console.error('class_exists failed', lookupErr);
  if (!name) return null;
  const { data, error } = await supabase.rpc('class_runs', { p_code: code });
  if (error) return null;
  return { name: name as string, students: groupClassRows((data ?? []) as RunRow[]) };
}
