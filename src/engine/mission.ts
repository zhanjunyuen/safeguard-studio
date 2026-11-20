import { ASSIGNMENT, ASSIGNED_CASES, BRIEF, catalogue, DESKS, missionCase, SOURCE_PACK, TRANSFER } from '../data/mission';
import type { AttackHint } from './attackHints';
import { attackCases } from '../data/attackCases';
import type { CustomAttack } from './customAttack';
import { ATTACK_BUDGET } from './breaker';
import { BLOCKS } from '../data/blocks';
import { runProgram } from './run';
import type { BlockType, Effect, TestResult } from '../types';
import { getChallenge } from '../data/challenges';
import { keyToBlock } from './scriptText';

export type Desk = typeof catalogue[number]['id'];
export interface CurveballAnswer {
  creditsUsed?: number;
  prediction: 'handles' | 'struggles';
  reason: string;
  confidence?: import('./curveball').CurveballConfidenceLevel;
}
/** `type` is a block key: a plain block type, or an IF block saved by blockKey (e.g. "if:person:remove_pii:"). */
export type Rule = { type: BlockType; scope: Desk | 'all' };
export type AssessmentLevel = 1 | 2;
export type Phase = 'brief' | 'menu' | 'build' | 'evaluation' | 'attack' | 'revise' | 'release' | 'complete' | 'expired';
export interface Probe {
  id: string;
  prediction: 'handles' | 'struggles';
  reason: string;
}
export interface Mission {
  phase: Phase;
  minutes: number;
  elapsed: number;
  form?: 2 | 3 | 4;
  assigned?: Desk[];
  workloadModel?: 'case-average' | 'compute' | 'usage' | 'deployment';
  deployed?: Partial<Record<Desk, BlockType[]>>;
  /** Form 4: Level 2 uses each challenge's IF-block version (an extra edge case and a higher usefulness target). */
  level?: AssessmentLevel;
  frozen?: Partial<Record<Desk, Rule[]>>;
  completed?: Desk[];
  revising?: Partial<Record<Desk, boolean>>;
  designNotes?: Partial<Record<Desk, string>>;
  revisionNotes?: Partial<Record<Desk, string>>;
  focus?: Desk;
  attackHints?: AttackHint[];
  /** the final score and the AI's verdict, saved when the assessment report is first shown */
  finalResult?: import('./finalScore').FinalResult;
  /** the teacher's settings, copied when the attempt starts */
  settings?: import('./assessmentSettings').AssessmentSettings;
  /** the class this attempt belongs to, if the pupil joined one */
  classCode?: string;
  owner?: string | null;
  attackPlans?: Partial<Record<Desk, string[]>>;
  /** Form 4: the pupil's written prediction for each attack plan, required before launch. */
  attackReasons?: Partial<Record<Desk, string>>;
  customDrafts?: Partial<Record<Desk, string>>;
  launches?: { desk: Desk; ids: string[]; creditsUsed?: number; reason?: string; custom?: CustomAttack }[];
  /** Form 4: the pupil's prediction for each challenge's unseen curveball case. */
  curveballs?: Partial<Record<Desk, CurveballAnswer>>;
  project?: string; // Earlier, pupil-authored briefs in saved reports.
  anticipation: string;
  draft: Rule[];
  first: Rule[] | null;
  final: Rule[] | null;
  probes: Probe[];
  authoredProbe?: string;
  auditSubmitted?: boolean;
  revision: string;
  decision: string;
  rationale: string;
}
export const newMission = (): Mission => ({
  phase: 'brief', minutes: 0, elapsed: 0, form: 3, attackHints: [], launches: [], attackPlans: {}, anticipation: '',
  draft: [{ type: 'ask_ai', scope: 'all' }], first: null, final: null,
  probes: [], revision: '', decision: '', rationale: '',
});

export const newAssessment = (): Mission => ({
  ...newMission(), form: 4, workloadModel: 'deployment', deployed: {}, frozen: {}, completed: [],
});

/** The challenge a pupil works on for a desk: "history" at Level 1, "history@2" at Level 2. */
export const challengeIdFor = (m: Pick<Mission, 'level'>, desk: Desk) => (m.level === 2 ? `${desk}@2` : desk);
export const casesFor = (m: Pick<Mission, 'level'>, desk: Desk) => attackCases(getChallenge(challengeIdFor(m, desk))!).map(t => t.id);

/** The runnable script for one desk from scoped rules, keeping IF blocks. */
export const ruleScript = (rules: Rule[], desk: Desk) =>
  rules.filter(r => r.scope === 'all' || r.scope === desk).map((r, i) => keyToBlock(r.type, `r${i}`));

export function assignedDesks(m: Pick<Mission, 'assigned'>) {
  return m.assigned ? catalogue.filter(d => m.assigned!.includes(d.id)) : DESKS;
}

export function allChallengesComplete(m: Mission) {
  const desks = assignedDesks(m);
  return desks.length > 0 && desks.length === (m.assigned?.length ?? DESKS.length) && desks.every(d => m.completed?.includes(d.id));
}

// Mission credits represent work. The practice engine's cost field represents friction.
export function blockCredits(type: BlockType): number {
  if (type.startsWith('if:') || type.startsWith('ifelse:')) {
    // An IF block costs nothing itself; at most one of its branches runs.
    const [, , then, els] = type.split(':');
    return Math.max(then ? blockCredits(then as BlockType) : 0, els ? blockCredits(els as BlockType) : 0);
  }
  if (type === 'warn_note') return 1;
  return BLOCKS[type].cost;
}

// Original case-average rates, retained for saved results.
const executionRates: Record<Effect, number> = {
  ai: 0, control: 0,
  block_people: 1, block_topic: 1, warn: 1, disclose: 1, mask_input_email: 1,
  mask_reply_email: 1, link_scheme: 1, scan_reply: 1, reference_year: 1, cite_correction: 1,
  coach: 2, balance: 2, consent: 2, flag: 2, mitigate: 2, hedge: 2,
  strip_pii: 3, verify: 4, second_opinion: 5, block_all: 8,
};

// Relative compute per operation on short classroom messages. Human waiting time
// affects usefulness separately. Rates are teaching estimates, not provider prices.
const computeRates: Record<Effect, number> = {
  ai: 12, second_opinion: 12, hedge: 12,
  verify: 4, strip_pii: 2,
  control: 0, block_people: 1, block_topic: 1, block_all: 1,
  warn: 1, disclose: 1, mask_input_email: 1, mask_reply_email: 1, link_scheme: 1,
  scan_reply: 1, reference_year: 1, cite_correction: 1, coach: 1, balance: 1,
  consent: 1, flag: 1, mitigate: 1,
};
const computeByBlock: Partial<Record<BlockType, number>> = {
  // These blocks send a message to a person.
  teacher_confirm: 1, ask_the_source: 1, forward_check: 1,
  // Running code and searching by image involve more work than a text lookup.
  run_the_code: 8, reverse_image: 8,
};

export function safeguardRate(type: BlockType, model: Mission['workloadModel']) {
  if (model === 'compute' || model === 'usage' || model === 'deployment') {
    const units = computeByBlock[type] ?? computeRates[BLOCKS[type].effect];
    if (model === 'compute') return units;
    const deploymentPoints = units === 12 ? 10 : units;
    return model === 'usage' ? deploymentPoints / 10 : deploymentPoints;
  }
  if (!model) return blockCredits(type);
  if (type === 'teacher_confirm') return 8;
  return executionRates[BLOCKS[type].effect];
}

export function estimateCost(rules: Rule[]) {
  return DESKS.reduce((total, desk) => {
    const unit = rules.filter(r => r.scope === 'all' || r.scope === desk.id)
      .reduce((sum, r) => sum + blockCredits(r.type), 0);
    return total + unit * desk.volume * desk.cases.length;
  }, 0);
}

export const roundCredits = (amount: number) => Math.round(amount * 10) / 10;

export function executionCharges(result: TestResult, model: Mission['workloadModel']) {
  let hasAnswer = false;
  return result.steps.flatMap(step => {
    if (step.blockType === 'trigger' || step.blockType === 'reply' || step.status === 'skip') return [];
    const block = BLOCKS[step.blockType];
    if ((model === 'usage' || model === 'compute') && block.position === 'after' && !hasAnswer) return [];
    if (block.effect === 'ai') hasAnswer = true;
    const unit = safeguardRate(step.blockType, model);
    return unit === 0 ? [] : [{ block: step.blockType, unit }];
  });
}

export function requestCredits(result: TestResult) {
  return roundCredits(executionCharges(result, 'usage').reduce((sum, charge) => sum + charge.unit, 0));
}

export function evaluate(rules: Rule[], id: string, model?: Mission['workloadModel']) {
  const { desk, test } = missionCase(id);
  const result = runProgram(ruleScript(rules, desk.id), test);
  const charges = model === 'deployment' ? [] : executionCharges(result, model);
  const volume = model === 'usage' || model === 'deployment' ? 1 : desk.volume;
  const credits = roundCredits(volume * charges.reduce((sum, item) => sum + item.unit, 0));
  return { id, desk: desk.name, volume, charges, credits, result, usage: model === 'usage', deployment: model === 'deployment' };
}

export function attackCredits(rules: Rule[], ids: string[], custom?: CustomAttack) {
  return roundCredits(ids.reduce((sum, id) => sum + evaluate(rules, id, 'usage').credits, custom ? 1 : 0));
}

export function submitAttack(m: Mission, custom?: CustomAttack): Mission {
  const desk = assignedDesks(m).find(d => d.id === m.focus);
  if (m.phase !== 'attack' || !m.first || !desk || m.launches?.some(l => l.desk === desk.id)) return m;
  const ids = m.attackPlans?.[desk.id] ?? [];
  const cases = m.form === 4 ? casesFor(m, desk.id) : desk.cases;
  if (custom && (m.form !== 4 || !custom.question || custom.question !== m.customDrafts?.[desk.id]?.trim())) return m;
  const count = ids.length + (custom ? 1 : 0);
  if (!count || count > ATTACK_BUDGET || new Set(ids).size !== ids.length || !ids.every(id => cases.includes(id))) return m;
  const reason = m.attackReasons?.[desk.id]?.trim() ?? '';
  if (m.form === 4 && !reason && (m.settings?.questions.attack ?? 'required') === 'required') return m;
  const receipt = m.workloadModel === 'usage' ? { creditsUsed: attackCredits(m.first, ids, custom) } : {};
  const round = m.form === 4 ? { desk: desk.id, ids: [...ids], reason, ...receipt, ...(custom && { custom }) } : { desk: desk.id, ids: [...ids] };
  return { ...m, launches: [...(m.launches ?? []), round] };
}

export const evaluateBuild = (rules: Rule[], legacy = false) =>
  DESKS.flatMap(d => (legacy ? d.legacyCases : d.cases).map(id => evaluate(rules, id)));
export const handled = (row: ReturnType<typeof evaluate>) => row.result.outcome === 'pass' && !row.result.blocked;
export const totalCost = (rows: ReturnType<typeof evaluate>[]) => rows.reduce((sum, row) => sum + row.credits, 0);
// A feasible reference design that passes every common case, with safeguards routed by desk.
const reference: Rule[] = [
  { type: 'remove_pii', scope: 'all' }, { type: 'coach', scope: 'all' },
  { type: 'dont_just_agree', scope: 'all' }, { type: 'ask_ai', scope: 'all' },
  { type: 'check_source', scope: 'all' }, { type: 'check_school_site', scope: 'chat' },
  { type: 'check_booklet', scope: 'options' },
];
export const LEGACY_BUDGET = totalCost(evaluateBuild(reference, true));
export const BUDGET = totalCost(evaluateBuild(reference));

export function evidence(m: Mission) {
  const legacy = !m.form;
  const build = (rules: Rule[] | null) => rules && { rules, cases: evaluateBuild(rules, legacy) };
  return {
    creditModel: 'safeguards-only', rubricVersion: 'school-community-' + (m.form ?? 1), status: m.phase,
    brief: BRIEF, project: legacy ? m.project : ASSIGNMENT,
    assignedCases: legacy ? undefined : ASSIGNED_CASES,
    requiredPredictions: m.form === 3 ? 0 : legacy ? 2 : ASSIGNED_CASES.length,
    attackHints: m.attackHints,
    attackRounds: m.form === 3 ? (m.launches ?? []).map(l => ({
      desk: l.desk, ids: l.ids, runs: l.ids.map(id => evaluate(m.first!, id)),
    })) : undefined,
    sources: SOURCE_PACK, timeLimitMinutes: m.minutes || null, activeSeconds: m.elapsed,
    anticipation: m.first ? m.anticipation : null, firstBuild: build(m.first),
    probes: m.probes.map(p => {
      const run = evaluate(m.first!, p.id);
      return { ...p, run, correct: (p.prediction === 'handles') === handled(run) };
    }),
    authoredProbe: legacy ? (m.auditSubmitted ? m.authoredProbe : null) : undefined,
    revision: m.final ? m.revision : null, revisedBuild: build(m.final), budget: legacy ? LEGACY_BUDGET : BUDGET,
    transfer: { ...TRANSFER, decision: m.phase === 'complete' ? m.decision : null, rationale: m.phase === 'complete' ? m.rationale : null },
  };
}
