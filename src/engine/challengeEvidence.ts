import { BRIEF, DESKS, SOURCE_PACK, TRANSFER } from '../data/mission';
import { getChallenge } from '../data/challenges';
import type { ChallengeProgress } from '../store/session';
import type { BlockType } from '../types';
import { evaluate, handled, totalCost, type Desk, type Mission } from './mission';

export const referenceBuilds: Record<Desk, BlockType[]> = {
  history: ['remove_pii', 'coach', 'ask_ai', 'check_source', 'both_sides'],
  party: ['ask_permission', 'no_impersonation', 'dont_just_agree', 'ask_ai', 'check_label'],
  news: ['official_contacts', 'feedback_only', 'ask_ai', 'ask_the_source', 'check_stats', 'neutral_wording'],
  quiz: ['private_marks', 'practice_not_answers', 'ask_ai', 'check_textbook', 'mix_examples'],
  chat: ['hide_location', 'own_words', 'ask_ai', 'check_school_site', 'no_ganging_up'],
  options: ['needs_no_names', 'plan_not_write', 'ask_ai', 'check_booklet', 'challenge_stereotypes'],
};

export function evaluateDesk(id: Desk, blocks: BlockType[]) {
  const rules = blocks.map(type => ({ type, scope: id }));
  return getChallenge(id)!.tests.map(t => evaluate(rules, t.id));
}

export const CHALLENGE_BUDGET = DESKS.reduce((sum, d) =>
  sum + totalCost(evaluateDesk(d.id, referenceBuilds[d.id])), 0);

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
      attack: target && plan ? { rules: target, ids: plan.ids, cases: plan.ids.map(id => evaluate(target, id)) } : null,
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
