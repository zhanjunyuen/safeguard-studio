import { BRIEF, DESKS, SOURCE_PACK, TRANSFER } from '../data/mission';
import { getChallenge } from '../data/challenges';
import type { ChallengeProgress } from '../store/session';
import type { BlockType } from '../types';
import { evaluate, handled, totalCost, type Desk, type Mission } from './mission';

export function evaluateDesk(id: Desk, blocks: BlockType[]) {
  const rules = blocks.map(type => ({ type, scope: id }));
  return getChallenge(id)!.tests.map(t => evaluate(rules, t.id));
}

export const CHALLENGE_BUDGET = DESKS.reduce((sum, d) =>
  sum + totalCost(evaluateDesk(d.id, getChallenge(d.id)!.ideal)), 0);

export function challengeEvidence(m: Mission, progress: Record<string, ChallengeProgress>) {
  const challenges = DESKS.map(d => {
    const p = progress[d.id];
    const challenge = getChallenge(d.id)!;
    const attempts = (p?.attempts ?? []).map(a => ({ ...a, cases: evaluateDesk(d.id, a.script) }));
    const evaluated = attempts.slice(-1)[0];
    const target = m.frozen?.[d.id];
    const plan = m.launches?.find(l => l.desk === d.id);
    return {
      id: d.id, title: challenge.title, audience: challenge.audience, story: challenge.story, volume: d.volume,
      status: m.completed?.includes(d.id) ? 'completed' : p ? 'in progress' : 'unattempted',
      designNote: target ? m.designNotes?.[d.id] : undefined,
      revisionNote: m.completed?.includes(d.id) ? m.revisionNotes?.[d.id] : undefined,
      attempts, reflections: p?.reflections ?? [], workloadCredits: evaluated ? totalCost(evaluated.cases) : null,
      attack: target && plan ? { rules: target, ids: plan.ids, reason: plan.reason ?? null, cases: plan.ids.map(id => evaluate(target, id)) } : null,
    };
  });
  const workloadCredits = challenges.reduce((sum, c) => sum + (c.workloadCredits ?? 0), 0);
  const meetsEfficiencyTarget = challenges.every(c => c.status === 'completed' && c.attempts.slice(-1)[0]?.cases.every(handled))
    && workloadCredits <= CHALLENGE_BUDGET;
  return {
    rubricVersion: 'school-community-4', status: m.phase, brief: BRIEF, sources: SOURCE_PACK,
    timeLimitMinutes: m.minutes || null, activeSeconds: m.elapsed, completionOrder: m.completed ?? [],
    attackHints: m.attackHints ?? [], challenges, budget: CHALLENGE_BUDGET,
    workloadCredits, meetsEfficiencyTarget,
    transfer: { ...TRANSFER, decision: m.phase === 'complete' ? m.decision : null, rationale: m.phase === 'complete' ? m.rationale : null },
  };
}
