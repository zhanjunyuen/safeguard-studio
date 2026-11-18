import type { BreakAttempt, ChallengeProgress } from '../store/session';
import type { Challenge } from '../types';
import { breakSummary } from './breaker';
import { usefulnessTarget } from './targets';

export type Status = 'todo' | 'started' | 'done';
export type Level2Status = Status | 'locked';

/** A run counts as solved only if every test passed AND the helper is still useful enough. */
export function buildStatus(id: string, total: number, p: ChallengeProgress | undefined) {
  const attempts = p?.attempts ?? [];
  const target = usefulnessTarget(id);
  const best = attempts.length ? Math.max(...attempts.map((a) => a.results.filter((r) => r.outcome === 'pass').length)) : null;
  const allPassRuns = attempts.filter((a) => a.results.every((r) => r.outcome === 'pass'));
  const bestUseful = allPassRuns.length ? Math.max(...allPassRuns.map((a) => a.scores.usefulness)) : null;
  const solved = bestUseful !== null && bestUseful >= target;
  const state: Status = !attempts.length ? 'todo' : solved ? 'done' : 'started';
  return { state, best, total, target, bestUseful, solved };
}

/** Build, Break and Level 2 progress for one challenge. "Complete" means Build and Break are done. */
export function challengeStatus(
  c: Challenge,
  p: ChallengeProgress | undefined,
  breaks: BreakAttempt[] | undefined,
  p2?: ChallengeProgress | undefined,
) {
  const build = buildStatus(c.id, c.tests.length, p);
  const brk = breakSummary(c, breaks ?? []);
  const breakState: Status = !brk ? 'todo' : brk.found === brk.total ? 'done' : 'started';
  const level2 = buildStatus(`${c.id}@2`, c.tests.length + 1, p2);
  const level2State: Level2Status = build.state !== 'done' ? 'locked' : level2.state;
  return {
    best: build.best,
    build,
    brk,
    buildState: build.state,
    breakState,
    level2,
    level2State,
    allDone: build.state === 'done' && breakState === 'done',
  };
}
