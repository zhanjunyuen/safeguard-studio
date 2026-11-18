import { ASSIGNMENT, ASSIGNED_CASES, BRIEF, DESKS, missionCase, SOURCE_PACK, TRANSFER } from '../data/mission';
import { BLOCKS } from '../data/blocks';
import { runProgram } from './run';
import type { BlockType } from '../types';

export type Desk = typeof DESKS[number]['id'];
export type Rule = { type: BlockType; scope: Desk | 'all' };
export type Phase = 'brief' | 'build' | 'attack' | 'revise' | 'release' | 'complete' | 'expired';
export interface Probe {
  id: string;
  prediction: 'handles' | 'struggles';
  reason: string;
}
export interface Mission {
  phase: Phase;
  minutes: number;
  elapsed: number;
  form?: 2;
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
  phase: 'brief', minutes: 0, elapsed: 0, form: 2, anticipation: '',
  draft: [{ type: 'ask_ai', scope: 'all' }], first: null, final: null,
  probes: [], revision: '', decision: '', rationale: '',
});

// Mission credits represent work. The practice engine's cost field represents friction.
export function blockCredits(type: BlockType) {
  if (type === 'ask_ai') return 2;
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
  const script = rules.filter(r => r.scope === 'all' || r.scope === desk.id)
    .map((r, i) => ({ uid: String(i), type: r.type }));
  const result = runProgram(script, test);
  const charges = result.steps.flatMap(step => {
    if (step.blockType === 'trigger' || step.blockType === 'reply' || step.status === 'skip') return [];
    return [{ block: step.blockType, unit: blockCredits(step.blockType) }];
  });
  const credits = desk.volume * charges.reduce((sum, item) => sum + item.unit, 0);
  return { id, desk: desk.name, volume: desk.volume, charges, credits, result };
}

export function nextAssignedCase(probes: Probe[]) {
  const submitted = new Set(probes.map(p => p.id));
  return ASSIGNED_CASES.find(id => !submitted.has(id));
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
  const legacy = m.form !== 2;
  const build = (rules: Rule[] | null) => rules && { rules, cases: evaluateBuild(rules, legacy) };
  return {
    rubricVersion: legacy ? 'school-community-1' : 'school-community-2', status: m.phase,
    brief: BRIEF, project: legacy ? m.project : ASSIGNMENT,
    assignedCases: legacy ? undefined : ASSIGNED_CASES,
    requiredPredictions: legacy ? 2 : ASSIGNED_CASES.length,
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
