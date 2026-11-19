import { attackCases } from '../data/attackCases';
import { BRIEF, SOURCE_PACK, TRANSFER } from '../data/mission';
import { getChallenge } from '../data/challenges';
import type { ChallengeProgress } from '../store/session';
import type { BlockType, ScriptBlock } from '../types';
import { assignedDesks, challengeIdFor, evaluate, handled, blockCredits, totalCost, type Desk, type Mission } from './mission';
import { idealScript } from './targets';
import { blockKey } from './scriptText';
import { CURVEBALLS } from '../data/curveballs';
import { curveballHandled, runCurveball } from './curveball';
import { markOffline, RUBRIC_VERSION, type Criterion, type MarkRequest } from './marking';

/** Runs a desk's saved block keys against that desk's tests (Level 2 adds its edge case). */
export function evaluateDesk(id: Desk, blocks: BlockType[], level: Mission['level'] = 1, model?: Mission['workloadModel']) {
  const rules = blocks.map(type => ({ type, scope: id }));
  return getChallenge(challengeIdFor({ level }, id))!.tests.map(t => evaluate(rules, t.id, model));
}

type WorkloadSettings = Pick<Mission, 'assigned' | 'level' | 'workloadModel'>;

function meanPathCost(cases: ReturnType<typeof evaluateDesk>) {
  return totalCost(cases) / cases.length;
}

function projectedCost(m: WorkloadSettings, id: Desk, script: ScriptBlock[], volume: number) {
  const keys = script.map(blockKey);
  if (m.workloadModel) {
    const cases = evaluateDesk(id, keys, m.level, m.workloadModel);
    const average = meanPathCost(cases);
    return { perRequest: average / volume, volume, credits: Math.ceil(average) };
  }
  const perRequest = keys.reduce((sum, key) => sum + blockCredits(key), 0);
  return { perRequest, volume, credits: perRequest * volume };
}

export function assessmentBudget(m: WorkloadSettings) {
  return assignedDesks(m).reduce((sum, desk) =>
    sum + projectedCost(m, desk.id, idealScript(challengeIdFor(m, desk.id)), desk.volume).credits, 0);
}

export function serviceWorkloads(m: WorkloadSettings, progress: Record<string, ChallengeProgress>) {
  // Every service starts with Ask AI, including services the pupil has yet to open.
  const starter: ScriptBlock[] = m.workloadModel === 'compute' ? [{ type: 'ask_ai', uid: 'starter' }] : [];
  return assignedDesks(m).map(({ id, title, volume }) => ({
    id, title, ...projectedCost(m, id, progress[id]?.script ?? starter, volume),
  }));
}

export function latestEffectiveness(progress?: ChallengeProgress) {
  const run = progress?.attempts.slice(-1)[0];
  return { passed: run?.results.filter(r => r.outcome === 'pass').length ?? 0, tested: run?.results.length ?? 0 };
}

export function challengeEvidence(m: Mission, progress: Record<string, ChallengeProgress>) {
  const budget = assessmentBudget(m);
  const challenges = serviceWorkloads(m, progress).map(d => {
    const p = progress[d.id];
    const challenge = getChallenge(challengeIdFor(m, d.id))!;
    const attempts = (p?.attempts ?? []).map(a => ({ ...a, cases: evaluateDesk(d.id, a.script, m.level, m.workloadModel) }));
    const target = m.frozen?.[d.id];
    const plan = m.launches?.find(l => l.desk === d.id);
    const revisionNote = m.completed?.includes(d.id) ? m.revisionNotes?.[d.id] : undefined;
    const requests = challengeMarkRequests(m, progress, d.id);
    return {
      id: d.id, challengeId: challenge.id, title: challenge.title, audience: challenge.audience, story: challenge.story, volume: d.volume,
      status: m.completed?.includes(d.id) ? 'completed' : p ? 'in progress' : 'unattempted',
      designNote: target ? m.designNotes?.[d.id] : undefined,
      revisionNote,
      effectiveness: latestEffectiveness(p), attempts, reflections: p?.reflections ?? [], creditsPerRequest: d.perRequest, workloadCredits: d.credits,
      attack: target && plan ? { rules: target, custom: plan.custom, ids: plan.ids, reason: plan.reason ?? null, cases: plan.ids.map(id => evaluate(target, id, m.workloadModel)) } : null,
      curveball: curveballEvidence(m, d.id),
      previewMarks: target && (plan?.reason || revisionNote) ? {
        testing: requests.testing ? markOffline(requests.testing) : undefined,
        revision: requests.revision ? markOffline(requests.revision) : undefined,
      } : undefined,
    };
  });
  const workloadCredits = challenges.reduce((sum, c) => sum + c.workloadCredits, 0);
  const meetsEfficiencyTarget = challenges.every(c => c.status === 'completed' && c.attempts.slice(-1)[0]?.cases.every(handled))
    && workloadCredits <= budget;
  return {
    level: m.level ?? 1, creditModel: m.workloadModel ?? 'projected-service-volume', rubricVersion: m.assigned ? 'school-community-5' : 'school-community-4', markingRubricVersion: RUBRIC_VERSION,
    markerNote: 'previewMarks come from the offline keyword marker; a trained model replaces it.', status: m.phase, brief: BRIEF, sources: SOURCE_PACK,
    timeLimitMinutes: m.minutes || null, activeSeconds: m.elapsed, completionOrder: m.completed ?? [],
    attackHints: m.attackHints ?? [], challenges, budget, finalResult: m.finalResult ?? null,
    workloadCredits, meetsEfficiencyTarget,
    transfer: { ...TRANSFER, decision: m.phase === 'complete' ? m.decision : null, rationale: m.phase === 'complete' ? m.rationale : null,
      previewMark: m.phase === 'complete' && m.rationale.trim() ? markOffline({ criterion: 'judgement', text: m.rationale, decision: m.decision }) : undefined },
  };
}

/** The marking requests for one challenge's written answers (attack prediction, revision note,
 *  curveball explanation), built from the simulator. Used for the preview marks and the AI marker. */
export function challengeMarkRequests(m: Mission, progress: Record<string, ChallengeProgress>, desk: Desk): Partial<Record<Criterion, MarkRequest>> {
  const challenge = getChallenge(challengeIdFor(m, desk))!;
  const target = m.frozen?.[desk];
  if (!target) return {};
  const evaluated = (progress[desk]?.attempts ?? []).slice(-1)[0];
  const plan = m.launches?.find(l => l.desk === desk);
  const revisionNote = m.completed?.includes(desk) ? m.revisionNotes?.[desk] : undefined;
  const answer = m.curveballs?.[desk];
  const planned = (id: string) => { const t = attackCases(challenge).find(x => x.id === id)!; return { id, label: t.attackLabel, title: t.title, category: t.category }; };
  const blocks = target.map(r => r.type);
  // The frozen (attacked) build run on every test: the "before" side of a revision.
  const frozenCases = evaluateDesk(desk, blocks, m.level, m.workloadModel);
  const out: Partial<Record<Criterion, MarkRequest>> = {};
  if (plan?.reason) out.testing = { criterion: 'testing', text: plan.reason, blocks, broke: plan.ids.filter(id => !handled(evaluate(target, id, m.workloadModel))), planned: plan.ids.map(planned), custom: plan.custom, challengeId: challenge.id };
  if (revisionNote && evaluated) {
    const after = evaluateDesk(desk, evaluated.script, m.level, m.workloadModel);
    out.revision = { criterion: 'revision', text: revisionNote, before: blocks, after: evaluated.script, failing: frozenCases.filter(r => !handled(r)).map(r => planned(r.id)),
      creditsBefore: m.workloadModel ? Math.ceil(meanPathCost(frozenCases)) : totalCost(frozenCases),
      creditsAfter: m.workloadModel ? Math.ceil(meanPathCost(after)) : totalCost(after), challengeId: challenge.id };
  }
  if (answer?.reason.trim() && CURVEBALLS[desk]) {
    out.anticipation = { criterion: 'anticipation', text: answer.reason, blocks, desk, prediction: answer.prediction, handled: curveballHandled(runCurveball(target, desk)), challengeId: challenge.id };
  }
  return out;
}

/** The latest answer for each of the four skills (later challenges in completion order win), for the skills summary. */
export function latestMarkRequests(m: Mission, progress: Record<string, ChallengeProgress>): MarkRequest[] {
  const latest: Partial<Record<Criterion, MarkRequest>> = {};
  const order = [...assignedDesks(m).map(d => d.id).filter(id => !m.completed?.includes(id)), ...(m.completed ?? [])];
  for (const desk of order) Object.assign(latest, challengeMarkRequests(m, progress, desk));
  if (m.phase === 'complete' && m.rationale.trim()) latest.judgement = { criterion: 'judgement', text: m.rationale, decision: m.decision };
  return (['testing', 'anticipation', 'judgement', 'revision'] as Criterion[]).flatMap(c => latest[c] ? [latest[c]!] : []);
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
    prediction: answer.prediction, confidence: answer.confidence, reason: answer.reason, outcome: result.outcome, handled: ok,
    predictionCorrect: (answer.prediction === 'handles') === ok, reply: result.reply, steps: result.steps,
    previewMark: markOffline({ criterion: 'anticipation', text: answer.reason, blocks: target.map(r => r.type), desk, prediction: answer.prediction, handled: ok }),
  };
}
