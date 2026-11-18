import { describe, expect, it } from 'vitest';
import type { ChallengeProgress } from '../store/session';
import { overallProfile } from './profile';

const scores = (v: number, u = 100) => ({ verification: v, privacy: v, integrity: v, bias: v, usefulness: u });
const prog = (o: Partial<ChallengeProgress>): ChallengeProgress => ({
  script: [], attempts: [], reflections: [], events: [], pendingReflection: null, seen: [], ...o,
});
const attempt = (v: number, testId = 'h_date', failureKey?: 'pii_too_late') => ({
  at: 0, script: ['ask_ai' as const], scores: scores(v), results: [{ testId, outcome: 'pass' as const, failureKey }],
});
const refl = (correct: boolean) => ({ attempt: 1, testId: 'h_date', expected: 'pii_sent' as const, chosen: 'pii_sent' as const, correct, text: '' });

describe('overallProfile', () => {
  it('averages latest and first scores across challenges', () => {
    const o = overallProfile({
      history: prog({ attempts: [attempt(0), attempt(100)] }),
      party: prog({ attempts: [attempt(0, 'p_games')] }),
    });
    expect(o.current?.verification).toBe(50);
    expect(o.anticipated?.verification).toBe(0);
    expect(o.attempts).toBe(3);
    expect(o.done).toEqual(['history', 'party']);
  });
  it('counts explanations from raw numbers, not averaged percentages', () => {
    const o = overallProfile({
      history: prog({ attempts: [attempt(0)], reflections: [refl(true)] }),
      party: prog({ attempts: [attempt(0, 'p_games')], reflections: [refl(false), refl(false), refl(false)] }),
    });
    expect(o.reflectionAccuracy).toBe(25);
  });
  it('merges misconceptions and handles a student with nothing yet', () => {
    const o = overallProfile({ history: prog({ attempts: [attempt(0, 'h_address', 'pii_too_late')] }), party: prog({ attempts: [attempt(0, 'p_allergy', 'pii_too_late')] }) });
    expect(o.misconceptions).toEqual(['Removes personal info after it has already reached the AI']);
    const empty = overallProfile({});
    expect(empty.current).toBeNull();
    expect(empty.done).toEqual([]);
  });
});
