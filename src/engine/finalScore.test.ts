import { describe, expect, it } from 'vitest';
import { getChallenge } from '../data/challenges';
import { drawAssignment } from '../data/mission';
import { freshProgress, type ChallengeProgress } from '../store/session';
import { assessmentRadar, claimedFinal, finalScore, offlineVerdict, runFactor, verdictMatches, WEIGHTS } from './finalScore';
import type { Criterion, Level, Mark } from './marking';
import { newAssessment } from './mission';
import { idealScript } from './targets';

const mark = (criterion: Criterion, level: Level): Mark => ({ criterion, level, rubricVersion: 'x', marker: 'm', concepts: [], feedback: '', nextStep: '', reviewFlag: false });
const assigned = drawAssignment(() => 0.5);
const m = { ...newAssessment(), assigned, deployed: Object.fromEntries(assigned.map(id => [id, getChallenge(id)!.ideal])) };

/** Progress where every assigned challenge was built `runs` times, the last run being `keys(id)`. */
function progressWith(runs: number, keys: (id: string) => string[]) {
  return Object.fromEntries(m.assigned!.map((id) => [id, {
    ...freshProgress(), script: keys(id).map((type, i) => ({ uid: `${type}-${i}`, type })) as never,
    attempts: Array.from({ length: runs }, () => ({ at: 0, script: keys(id) as never, results: [], scores: {} as never })),
  }])) as Record<string, ChallengeProgress>;
}
const ideal = (id: string) => idealScript(id).map((b) => b.type as string);

describe('final score', () => {
  it('gives full marks for reference builds in one run and level 2 on every skill', () => {
    const f = finalScore(m, progressWith(1, ideal), ['testing', 'anticipation', 'judgement', 'revision'].map((c) => mark(c as Criterion, 2)));
    expect(f.total).toBe(100);
    expect(f.band).toBe('Outstanding');
    expect(f.parts).toEqual(WEIGHTS);
  });

  it('weighs attempts, blocks and answers separately', () => {
    const marks = [mark('testing', 1), mark('anticipation', 1)];
    const quick = finalScore(m, progressWith(1, ideal), marks);
    const slow = finalScore(m, progressWith(6, ideal), marks);
    expect(quick.categories.answers).toBe(25);
    expect(quick.parts.answers).toBe(WEIGHTS.answers * 2 / 8);
    expect(slow.parts.attempts).toBeLessThan(quick.parts.attempts);
    expect(slow.parts.tests).toBe(quick.parts.tests);
    // A bare helper is cheap but useless: no workload points without working builds.
    const bare = finalScore({ ...m, deployed: Object.fromEntries(assigned.map(id => [id, ['ask_ai']])) }, progressWith(1, () => ['ask_ai']), marks);
    expect(bare.parts.tests).toBeLessThan(WEIGHTS.tests);
    expect(bare.parts.workload).toBeLessThan(WEIGHTS.workload);
    // With nothing done, only independence (no hints used) scores.
    expect(finalScore({ ...m, deployed: {} }, {}, []).total).toBe(WEIGHTS.independence);
  });

  it('counts runs with a floor', () => {
    expect([0, 1, 2, 3, 12].map(runFactor)).toEqual([0, 1, 1, 0.9, 0.4]);
  });

  it('builds a radar from the first and latest builds', () => {
    const p = progressWith(1, () => ['ask_ai']);
    for (const id of m.assigned!) p[id].attempts.push({ at: 0, script: ideal(id) as never, results: [], scores: {} as never });
    const r = assessmentRadar(m, p);
    expect(r.now.usefulness).toBe(100);
    expect(Object.values(r.first).some((v) => v !== null && v < 100)).toBe(true);
    expect(getChallenge(m.assigned![0])).toBeTruthy();
  });

  it('the offline verdict states the score, and AI verdicts are checked against it', () => {
    const f = finalScore(m, progressWith(2, ideal), [mark('testing', 2)]);
    expect(claimedFinal(offlineVerdict(f))).toEqual([f.total]);
    expect(claimedFinal('You scored 72/100, and 72 out of 100 is Strong.')).toEqual([72, 72]);
  });

  it('is the weighted average of the category scores, and each hint lowers independence', () => {
    const all = ['testing', 'anticipation', 'judgement', 'revision'].map((c) => mark(c as Criterion, 2));
    expect(WEIGHTS.answers).toBe(40);
    expect(WEIGHTS.tests + WEIGHTS.workload).toBe(35);
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    const hints = (n: number) => ({ ...m, attackHints: Array.from({ length: n }, () => ({ desk: m.assigned![0], text: 'hint' })) });
    const scores = [0, 1, 2, 3].map((n) => finalScore(hints(n), progressWith(1, ideal), all));
    expect(scores.map((f) => f.categories.independence)).toEqual([100, 66.7, 33.3, 0]);
    expect(scores.map((f) => f.total)).toEqual([100, 97, 93, 90]);
    const f = scores[1];
    const avg = Object.entries(f.categories).reduce((s, [k, v]) => s + (v ?? 0) * WEIGHTS[k as keyof typeof WEIGHTS], 0) / 100;
    expect(f.total).toBe(Math.round(avg));
  });

  it('accepts a verdict that quotes category scores but not one with a different final score', () => {
    const f = finalScore(m, progressWith(2, ideal), [mark('testing', 2)]);
    expect(verdictMatches(`You scored ${f.total} out of 100. Tests: ${f.categories.tests} out of 100.`, f)).toBe(true);
    expect(verdictMatches(`You scored ${f.total + 1} out of 100.`, f)).toBe(false);
    expect(verdictMatches('Well done!', f)).toBe(false);
    expect(claimedFinal('Independence 66.7 out of 100')).toEqual([66.7]);
  });
});
