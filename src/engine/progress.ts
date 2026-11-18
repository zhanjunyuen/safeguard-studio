import type { BreakAttempt, ChallengeProgress } from '../store/session';
import type { Challenge } from '../types';
import { breakSummary } from './breaker';

export type Status = 'todo' | 'started' | 'done';

/** Build and Break progress for one challenge. A challenge is complete when both are done. */
export function challengeStatus(c: Challenge, p: ChallengeProgress | undefined, breaks: BreakAttempt[] | undefined) {
  const best = p?.attempts.length ? Math.max(...p.attempts.map((a) => a.results.filter((r) => r.outcome === 'pass').length)) : null;
  const brk = breakSummary(c, breaks ?? []);
  const buildState: Status = best === null ? 'todo' : best === c.tests.length ? 'done' : 'started';
  const breakState: Status = !brk ? 'todo' : brk.found === brk.total ? 'done' : 'started';
  return { best, brk, buildState, breakState, allDone: buildState === 'done' && breakState === 'done' };
}
