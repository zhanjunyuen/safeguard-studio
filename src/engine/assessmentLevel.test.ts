import { describe, expect, it } from 'vitest';
import { getChallenge } from '../data/challenges';
import { DESKS } from '../data/mission';
import { LEVEL2, toScript } from '../data/level2';
import { freshProgress } from '../store/session';
import type { BlockType } from '../types';
import { assessmentBudget, challengeEvidence, evaluateDesk } from './challengeEvidence';
import { runCurveball } from './curveball';
import { blockCredits, handled, newAssessment, submitAttack, totalCost, type Rule } from './mission';
import { runChallenge } from './run';
import { blockKey, keyToBlock } from './scriptText';
import { usefulnessTarget } from './targets';

const keys = (id: string) => toScript(LEVEL2[id].ideal).map(blockKey) as BlockType[];

describe('Level 2 assessment', () => {
  it('keeps IF blocks when a build is saved and restored', () => {
    for (const b of toScript(LEVEL2.history.ideal)) {
      const back = keyToBlock(blockKey(b), 'x');
      expect(blockKey(back)).toBe(blockKey(b));
    }
    expect(keyToBlock('ifelse:opinion:both_sides:coach', 'u')).toMatchObject({ type: 'ifelse', cond: 'opinion', then: { type: 'both_sides' }, else: { type: 'coach' } });
  });

  it('runs saved Level 2 builds against seven tests, including the edge case', () => {
    for (const id of Object.keys(LEVEL2)) {
      const rows = evaluateDesk(id, keys(id), 2);
      expect(rows).toHaveLength(getChallenge(id + '@2')!.tests.length);
      expect(rows.every(handled)).toBe(true);
    }
    expect(evaluateDesk('history', keys('history'), 1)).toHaveLength(6);
  });

  it('is genuinely harder: the always-on Level 1 answer misses the Level 2 usefulness target', () => {
    for (const id of Object.keys(LEVEL2)) {
      const l1 = getChallenge(id)!.ideal.map((type, i) => ({ uid: `${i}`, type }));
      expect(runChallenge(l1, getChallenge(id + '@2')!).scores.usefulness).toBeLessThan(usefulnessTarget(id + '@2'));
    }
  });

  it('charges an IF block only for the branch that runs', () => {
    expect(blockCredits('if:numbers:remove_pii:' as BlockType)).toBe(blockCredits('remove_pii'));
    const rules: Rule[] = keys('history').map(type => ({ type, scope: 'history' }));
    const always: Rule[] = getChallenge('history')!.ideal.map(type => ({ type, scope: 'history' }));
    const l2Rows = evaluateDesk('history', rules.map(r => r.type), 2);
    const l1Rows = evaluateDesk('history', always.map(r => r.type), 2);
    expect(totalCost(l2Rows)).toBeLessThan(totalCost(l1Rows));
  });

  it('lets Level 2 attacks target the edge case, and Level 1 attacks cannot', () => {
    const edge = LEVEL2.history.edge.id;
    const rules: Rule[] = keys('history').map(type => ({ type, scope: 'history' }));
    const base = { ...newAssessment(), assigned: ['history', 'party', 'news', 'quiz', 'chat', 'options'], phase: 'attack' as const, focus: 'history' as const,
      first: rules, frozen: { history: rules }, attackPlans: { history: [edge] }, attackReasons: { history: 'The address has no name in it, so my IF might miss it.' } };
    expect(submitAttack({ ...base, level: 2 }).launches).toHaveLength(1);
    expect(submitAttack({ ...base, level: 1 }).launches).toHaveLength(0);
  });

  it('exports the level, uses Level 2 references for the budget, and runs curveballs through IF blocks', () => {
    const m = { ...newAssessment(), level: 2 as const, assigned: ['history', 'party', 'news', 'quiz', 'chat', 'options'] };
    const referenceBudget = DESKS.reduce((sum, d) => {
      const perRequest = keys(d.id).reduce((cost, key) => cost + blockCredits(key), 0);
      return sum + perRequest * d.volume;
    }, 0);
    expect(assessmentBudget(m)).toBe(referenceBudget);
    const p = freshProgress();
    const packet = challengeEvidence(m, { history: p });
    expect(packet.level).toBe(2);
    expect(packet.challenges.find(c => c.id === 'history')!.challengeId).toBe('history@2');
    const rules: Rule[] = keys('quiz').map(type => ({ type, scope: 'quiz' }));
    expect(runCurveball(rules, 'quiz').failureKey).toBe('judged_unfairly');
  });
});
