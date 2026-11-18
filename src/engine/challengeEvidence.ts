import { BRIEF, SOURCE_PACK, TRANSFER } from '../data/mission';
import { getChallenge } from '../data/challenges';
import type { ChallengeProgress } from '../store/session';
import type { BlockType } from '../types';
import { assignedDesks, challengeIdFor, evaluate, handled, totalCost, type Desk, type Mission } from './mission';
import { idealScript } from './targets';
import { blockKey } from './scriptText';
import { CURVEBALLS } from '../data/curveballs';
import { curveballHandled, runCurveball } from './curveball';
import { markOffline, RUBRIC_VERSION } from './marking';

/** Runs a desk's saved block keys against that desk's tests (Level 2 adds its edge case). */
export function evaluateDesk(id: Desk, blocks: BlockType[], level: Mission['level'] = 1) {
  const rules = blocks.map(type => ({ type, scope: id }));
  return getChallenge(challengeIdFor({ level }, id))!.tests.map(t => evaluate(rules, t.id));
}

export function assessmentBudget(m: Mission) {
  return assignedDesks(m).reduce((sum, d) =>
    sum + totalCost(evaluateDesk(d.id, idealScript(challengeIdFor(m, d.id)).map(blockKey) as BlockType[], m.level)), 0);
}

export function latestEffectiveness(progress?: ChallengeProgress) {
  const run = progress?.attempts.slice(-1)[0];
  return { passed: run?.results.filter(r => r.outcome === 'pass').length ?? 0, tested: run?.results.length ?? 0 };
}

export function challengeEvidence(m: Mission, progress: Record<string, ChallengeProgress>) {
  const budget = assessmentBudget(m);
  const challenges = assignedDesks(m).map(d => {
    const p = progress[d.id];
    const challenge = getChallenge(challengeIdFor(m, d.id))!;
    const attempts = (p?.attempts ?? []).map(a => ({ ...a, cases: evaluateDesk(d.id, a.script, m.level) }));
    const evaluated = attempts.slice(-1)[0];
    const target = m.frozen?.[d.id];
    const plan = m.launches?.find(l => l.desk === d.id);
    return {
      id: d.id, challengeId: challenge.id, title: challenge.title, audience: challenge.audience, story: challenge.story, volume: d.volume,
      status: m.completed?.includes(d.id) ? 'completed' : p ? 'in progress' : 'unattempted',
      designNote: target ? m.designNotes?.[d.id] : undefined,
      revisionNote: m.completed?.includes(d.id) ? m.revisionNotes?.[d.id] : undefined,
      effectiveness: latestEffectiveness(p), attempts, reflections: p?.reflections ?? [], workloadCredits: evaluated ? totalCost(evaluated.cases) : null,
      attack: target && plan ? { rules: target, ids: plan.ids, reason: plan.reason ?? null, cases: plan.ids.map(id => evaluate(target, id)) } : null,
      curveball: curveballEvidence(m, d.id),
      previewMarks: target && plan?.reason ? {
        testing: markOffline({ criterion: 'testing', text: plan.reason, blocks: target.map(r => r.type), broke: plan.ids.filter(id => !handled(evaluate(target, id))),
          planned: plan.ids.map(id => { const t = challenge.tests.find(x => x.id === id)!; return { id, label: t.attackLabel, title: t.title, category: t.category }; }) }),
      } : undefined,
    };
  });
  const workloadCredits = challenges.reduce((sum, c) => sum + (c.workloadCredits ?? 0), 0);
  const meetsEfficiencyTarget = challenges.every(c => c.status === 'completed' && c.attempts.slice(-1)[0]?.cases.every(handled))
    && workloadCredits <= budget;
  return {
    level: m.level ?? 1, creditModel: 'safeguards-only', rubricVersion: m.assigned ? 'school-community-5' : 'school-community-4', markingRubricVersion: RUBRIC_VERSION,
    markerNote: 'previewMarks come from the offline keyword marker; a trained model replaces it.', status: m.phase, brief: BRIEF, sources: SOURCE_PACK,
    timeLimitMinutes: m.minutes || null, activeSeconds: m.elapsed, completionOrder: m.completed ?? [],
    attackHints: m.attackHints ?? [], challenges, budget,
    workloadCredits, meetsEfficiencyTarget,
    transfer: { ...TRANSFER, decision: m.phase === 'complete' ? m.decision : null, rationale: m.phase === 'complete' ? m.rationale : null,
      previewMark: m.phase === 'complete' && m.rationale.trim() ? markOffline({ criterion: 'judgement', text: m.rationale, decision: m.decision }) : undefined },
  };
}

function curveballEvidence(m: Mission, desk: Desk) {
  const answer = m.curveballs?.[desk];
  const target = m.frozen?.[desk];
  const cb = CURVEBALLS[desk];
  if (!answer || !target || !cb) return null;
  const result = runCurveball(target, desk);
  const ok = curveballHandled(result);
  return {
    id: cb.test.id, title: cb.test.title, risk: cb.risk, request: cb.test.question, context: cb.context ?? null,
    prediction: answer.prediction, reason: answer.reason, outcome: result.outcome, handled: ok,
    predictionCorrect: (answer.prediction === 'handles') === ok, reply: result.reply, steps: result.steps,
    previewMark: markOffline({ criterion: 'anticipation', text: answer.reason, blocks: target.map(r => r.type), desk, prediction: answer.prediction, handled: ok }),
  };
}
