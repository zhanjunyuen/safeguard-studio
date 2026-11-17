import type { Attempt, BreakAttempt, ChallengeProgress, Reflection } from '../store/session';
import type { BlockType, FailureKey, Scores } from '../types';

/** One row from the class_runs() database function. */
export interface RunRow {
  student_id: string;
  display_name: string;
  challenge_id: string;
  mode: 'build' | 'break' | 'reflect';
  script: string[];
  results: { testId: string; outcome: Attempt['results'][number]['outcome']; failureKey?: FailureKey }[] | string[];
  scores: Scores | null;
  reflection: { testId: string; expected: FailureKey; chosen: FailureKey; correct: boolean; text: string } | null;
  created_at: string;
}

export interface ClassStudent {
  id: string;
  name: string;
  progress: Record<string, ChallengeProgress>;
  breaks: Record<string, BreakAttempt[]>;
}

const empty = (): ChallengeProgress => ({ script: [], attempts: [], reflections: [], events: [], pendingReflection: null, seen: [] });

/** Turns database rows into the same shapes the app already uses locally. Pure, so it is unit tested. */
export function groupClassRows(rows: RunRow[]): ClassStudent[] {
  const by = new Map<string, ClassStudent>();
  for (const r of rows) {
    let s = by.get(r.student_id);
    if (!s) by.set(r.student_id, (s = { id: r.student_id, name: r.display_name, progress: {}, breaks: {} }));
    const at = Date.parse(r.created_at);
    if (r.mode === 'break') {
      (s.breaks[r.challenge_id] ??= []).push({ at, attacks: r.script, broke: r.results as string[] });
      continue;
    }
    const p = (s.progress[r.challenge_id] ??= empty());
    if (r.mode === 'build') {
      p.attempts.push({ at, script: r.script as BlockType[], results: r.results as Attempt['results'], scores: r.scores! });
    } else if (r.reflection) {
      const refl: Reflection = { attempt: p.attempts.length, ...r.reflection };
      p.reflections.push(refl);
    }
  }
  return [...by.values()];
}
