import { describe, expect, it } from 'vitest';
import { BUDGET, evaluate, evaluateBuild, evidence, handled, submitAttack, newMission, totalCost, type Rule } from './mission';

import { ASSIGNED_CASES } from '../data/mission';
import { CHALLENGES } from '../data/challenges';

describe('school community assessment', () => {
  it('evaluates every existing case and executes the selected attack blocks against the frozen build', () => {
    expect(ASSIGNED_CASES).toEqual(CHALLENGES.filter(c => ['history', 'party', 'news', 'quiz', 'chat', 'options'].includes(c.id)).flatMap(c => c.tests.map(t => t.id)));
    const first: Rule[] = [{ type: 'ask_ai', scope: 'all' }];
    const m = { ...newMission(), first, focus: 'quiz' as const, phase: 'attack' as const,
      draft: [{ type: 'remove_pii', scope: 'all' } as Rule, ...first], attackPlans: { quiz: ['q_marks', 'q_photo'] } };
    const launched = submitAttack(m);
    const [round] = evidence(launched).attackRounds!;
    expect(round.runs.map(handled)).toEqual([false, true]);
    expect(submitAttack(launched)).toBe(launched);
    expect(submitAttack({ ...m, attackPlans: { quiz: ['n_phone'] } }).launches).toHaveLength(0);
    expect(submitAttack({ ...m, phase: 'evaluation' }).launches).toHaveLength(0);
  });

  it('preserves the scope and budget of earlier completed reports', () => {
    const packet = evidence({ ...newMission(), form: undefined, phase: 'complete', first: [], project: 'Earlier project' });
    expect(packet.firstBuild?.cases).toHaveLength(12);
    expect(packet.requiredPredictions).toBe(2);
    expect(packet.project).toBe('Earlier project');
    expect(packet.budget).toBeLessThan(BUDGET);
  });

  it('charges executed blocks at the service workload and excludes skipped or out-of-scope blocks', () => {
    const rules: Rule[] = [
      { type: 'check_booklet', scope: 'options' },
      { type: 'block_people', scope: 'all' },
      { type: 'ask_ai', scope: 'all' },
      { type: 'coach', scope: 'all' },
    ];
    const run = evaluate(rules, 'c_pe');
    expect(run.charges).toEqual([{ block: 'block_people', unit: 20 }]);
    expect(run.credits).toBe(160);
    expect(handled(run)).toBe(false);
  });

  it('allows a safe useful design within budget across every school service', () => {
    const rules: Rule[] = [
      { type: 'remove_pii', scope: 'all' }, { type: 'coach', scope: 'all' },
      { type: 'dont_just_agree', scope: 'all' }, { type: 'ask_ai', scope: 'all' },
      { type: 'check_source', scope: 'all' }, { type: 'check_booklet', scope: 'options' },
      { type: 'check_school_site', scope: 'chat' },
    ];
    const rows = evaluateBuild(rules);
    expect(rows).toHaveLength(36);
    expect(rows.every(handled)).toBe(true);
    expect(totalCost(rows)).toBeLessThanOrEqual(BUDGET);
  });

  it('marks predictions against the original snapshot after revision, including a correct prediction of success', () => {
    const first: Rule[] = [{ type: 'ask_ai', scope: 'all' }];
    const packet = evidence({
      ...newMission(), first, final: [{ type: 'remove_pii', scope: 'all' }, ...first],
      probes: [{ id: 'q_marks', prediction: 'struggles', reason: 'The names reach the AI.' },
        { id: 'p_games', prediction: 'handles', reason: 'No sensitive information is needed.' }],
    });
    expect(packet.probes.map(p => p.correct)).toEqual([true, true]);
    expect(packet.probes[0].run.result.failureKey).toBe('pii_sent');
  });

  it('keeps unfinished writing out of submitted evidence when time runs out', () => {
    const packet = evidence({ ...newMission(), phase: 'expired', anticipation: 'Unfinished draft', decision: 'Publish' });
    expect(packet.anticipation).toBeNull();
    expect(packet.transfer.decision).toBeNull();
    expect(packet.firstBuild).toBeNull();
  });
});
