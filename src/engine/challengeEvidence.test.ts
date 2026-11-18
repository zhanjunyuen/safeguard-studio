import { describe, expect, it } from 'vitest';
import { DESKS } from '../data/mission';
import { allChallengesComplete, newAssessment } from './mission';
import { challengeEvidence } from './challengeEvidence';
import { freshProgress } from '../store/session';

describe('six required challenges', () => {
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
});
