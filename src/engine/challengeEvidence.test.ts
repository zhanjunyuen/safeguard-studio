import { describe, expect, it } from 'vitest';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { themeOf } from '../data/themes';
import { catalogue, DESKS, drawAssignment } from '../data/mission';
import { allChallengesComplete, newAssessment, submitAttack } from './mission';
import { challengeEvidence } from './challengeEvidence';
import { freshProgress } from '../store/session';

describe('six required challenges', () => {
  it('draws one task per theme and can assign every catalogue entry', () => {
    const reached = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const ids = drawAssignment(() => i / 100);
      expect(new Set(ids.map(id => themeOf(id)!.id)).size).toBe(6);
      ids.forEach(id => reached.add(id));
    }
    expect(reached).toEqual(new Set(CHALLENGES.map(c => c.id)));
  });

  it('uses the assigned tasks for launches, completion, costs and exported evidence', () => {
    const assigned = drawAssignment(() => 0.99);
    const m = { ...newAssessment(), assigned };
    const first = m.draft;
    for (const d of catalogue) {
      const attack = { ...m, first, phase: 'attack' as const, focus: d.id, attackPlans: { [d.id]: [d.cases[0]] }, attackReasons: { [d.id]: 'I expect the first case to get through.' } };
      expect(submitAttack(attack).launches?.length).toBe(assigned.includes(d.id) ? 1 : 0);
    }
    expect(allChallengesComplete({ ...m, completed: assigned })).toBe(true);
    expect(allChallengesComplete({ ...m, completed: DESKS.map(d => d.id) })).toBe(false);
    const packet = challengeEvidence(m, {});
    expect(packet.challenges.map(c => c.id).sort()).toEqual([...assigned].sort());
    expect(packet.budget).toBeGreaterThan(0);
    const id = assigned[0];
    const p = freshProgress();
    const results = getChallenge(id)!.tests.map(t => ({ testId: t.id, outcome: 'pass' as const }));
    const scores = { privacy: 100, verification: 100, integrity: 100, bias: 100, usefulness: 100 };
    p.attempts.push({ at: 1, script: ['ask_ai'], results, scores }, { at: 2, script: ['ask_ai'], results: results.map(r => ({ ...r, outcome: 'fail' })), scores });
    expect(challengeEvidence(m, { [id]: p }).challenges.find(c => c.id === id)?.effectiveness).toEqual({ passed: 0, tested: 6 });
  });

  it('unlocks the release decision in any order only after every distinct challenge is complete', () => {
    const ids = DESKS.map(d => d.id).reverse();
    const mission = newAssessment();
    expect(allChallengesComplete({ ...mission, completed: ids })).toBe(true);
    expect(allChallengesComplete({ ...mission, completed: [...ids.slice(1), ids[1]] })).toBe(false);
  });

  it('exports an interrupted challenge and its original attack target independently of other challenges', () => {
    const mission = newAssessment();
    const packet = challengeEvidence({
      ...mission, phase: 'expired', frozen: { party: [{ type: 'ask_ai', scope: 'party' }] },
      launches: [{ desk: 'party', ids: ['p_allergy'] }],
    }, { party: freshProgress() });
    const party = packet.challenges.find(c => c.id === 'party')!;
    expect(party.attack?.cases.map(c => c.id)).toEqual(['p_allergy']);
    expect(party.status).toBe('in progress');
    expect(packet.challenges.filter(c => c.status === 'unattempted')).toHaveLength(5);
    expect(packet.meetsEfficiencyTarget).toBe(false);
    expect(packet.transfer.decision).toBeNull();
  });

  it('requires a written prediction before an attack launches, and exports it with the attack', () => {
    const target = [{ type: 'ask_ai' as const, scope: 'party' as const }];
    const ready = { ...newAssessment(), phase: 'attack' as const, focus: 'party' as const, first: target,
      frozen: { party: target }, attackPlans: { party: ['p_allergy'] } };
    expect(submitAttack(ready)).toBe(ready);
    expect(submitAttack({ ...ready, attackReasons: { party: '   ' } })).toEqual({ ...ready, attackReasons: { party: '   ' } });
    const launched = submitAttack({ ...ready, attackReasons: { party: '  No allergy check after Ask AI, so the label claim gets through. ' } });
    expect(launched.launches).toEqual([{ desk: 'party', ids: ['p_allergy'], reason: 'No allergy check after Ask AI, so the label claim gets through.' }]);
    const party = challengeEvidence(launched, { party: freshProgress() }).challenges.find(c => c.id === 'party')!;
    expect(party.attack?.reason).toBe('No allergy check after Ask AI, so the label claim gets through.');
  });
});
