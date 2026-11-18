import { ASSIGNMENT, ASSIGNED_CASES, BRIEF, catalogue, DESKS, missionCase, SOURCE_PACK, TRANSFER } from '../data/mission';
import type { AttackHint } from './attackHints';
import { ATTACK_BUDGET } from './breaker';
import { BLOCKS } from '../data/blocks';
import { runProgram } from './run';
import type { BlockType } from '../types';
import { getChallenge } from '../data/challenges';
import { keyToBlock } from './scriptText';

export type Desk = typeof catalogue[number]['id'];
export interface CurveballAnswer { prediction: 'handles' | 'struggles'; reason: string }
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
  /** Form 4: Level 2 uses each challenge's IF-block version (an extra edge case and a higher usefulness target). */
  level?: AssessmentLevel;
  frozen?: Partial<Record<Desk, Rule[]>>;
  completed?: Desk[];
  revising?: Partial<Record<Desk, boolean>>;
  designNotes?: Partial<Record<Desk, string>>;
  revisionNotes?: Partial<Record<Desk, string>>;
  focus?: Desk;
  attackHints?: AttackHint[];
  attackPlans?: Partial<Record<Desk, string[]>>;
  /** Form 4: the pupil's written prediction for each attack plan, required before launch. */
  attackReasons?: Partial<Record<Desk, string>>;
  launches?: { desk: Desk; ids: string[]; reason?: string }[];
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
  ...newMission(), form: 4, frozen: {}, completed: [],
});

/** The challenge a pupil works on for a desk: "history" at Level 1, "history@2" at Level 2. */
export const challengeIdFor = (m: Pick<Mission, 'level'>, desk: Desk) => (m.level === 2 ? `${desk}@2` : desk);
export const casesFor = (m: Pick<Mission, 'level'>, desk: Desk) => getChallenge(challengeIdFor(m, desk))!.tests.map(t => t.id);

/** The runnable script for one desk from scoped rules, keeping IF blocks. */
export const ruleScript = (rules: Rule[], desk: Desk) =>
  rules.filter(r => r.scope === 'all' || r.scope === desk).map((r, i) => keyToBlock(r.type, `r${i}`));

export function assignedDesks(m: Pick<Mission, 'assigned'>) {
  return m.assigned ? catalogue.filter(d => m.assigned!.includes(d.id)) : DESKS;
}

export function allChallengesComplete(m: Mission) {
  const desks = assignedDesks(m);
  return desks.length === 6 && desks.every(d => m.completed?.includes(d.id));
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

export function estimateCost(rules: Rule[]) {
  return DESKS.reduce((total, desk) => {
    const unit = rules.filter(r => r.scope === 'all' || r.scope === desk.id)
      .reduce((sum, r) => sum + blockCredits(r.type), 0);
    return total + unit * desk.volume * desk.cases.length;
  }, 0);
}

export function evaluate(rules: Rule[], id: string) {
  const { desk, test } = missionCase(id);
  const result = runProgram(ruleScript(rules, desk.id), test);
  const charges = result.steps.flatMap(step => {
    if (step.blockType === 'trigger' || step.blockType === 'reply' || step.status === 'skip') return [];
    const unit = blockCredits(step.blockType);
    return unit === 0 ? [] : [{ block: step.blockType, unit }];
  });
  const credits = desk.volume * charges.reduce((sum, item) => sum + item.unit, 0);
  return { id, desk: desk.name, volume: desk.volume, charges, credits, result };
}

export function submitAttack(m: Mission): Mission {
  const desk = assignedDesks(m).find(d => d.id === m.focus);
  if (m.phase !== 'attack' || !m.first || !desk || m.launches?.some(l => l.desk === desk.id)) return m;
  const ids = m.attackPlans?.[desk.id] ?? [];
  const cases = m.form === 4 ? casesFor(m, desk.id) : desk.cases;
  if (!ids.length || ids.length > ATTACK_BUDGET || new Set(ids).size !== ids.length || !ids.every(id => cases.includes(id))) return m;
  const reason = m.attackReasons?.[desk.id]?.trim() ?? '';
  if (m.form === 4 && !reason) return m;
  const round = m.form === 4 ? { desk: desk.id, ids: [...ids], reason } : { desk: desk.id, ids: [...ids] };
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
