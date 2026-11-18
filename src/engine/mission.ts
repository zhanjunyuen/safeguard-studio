import { ASSIGNMENT, ASSIGNED_CASES, BRIEF, DESKS, missionCase, SOURCE_PACK, TRANSFER } from '../data/mission';
import { ATTACK_BUDGET } from './breaker';
import { BLOCKS } from '../data/blocks';
import { runProgram } from './run';
import type { BlockType } from '../types';

export type Desk = typeof DESKS[number]['id'];
export type Rule = { type: BlockType; scope: Desk | 'all' };
export type Phase = 'brief' | 'build' | 'evaluation' | 'attack' | 'revise' | 'release' | 'complete' | 'expired';
export interface Probe {
  id: string;
  prediction: 'handles' | 'struggles';
  reason: string;
}
export interface Mission {
  phase: Phase;
  minutes: number;
  elapsed: number;
  form?: 2 | 3;
  focus?: Desk;
  attackPlans?: Partial<Record<Desk, string[]>>;
  launches?: { desk: Desk; ids: string[] }[];
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
  phase: 'brief', minutes: 0, elapsed: 0, form: 3, launches: [], attackPlans: {}, anticipation: '',
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

export function submitAttack(m: Mission): Mission {
  const desk = DESKS.find(d => d.id === m.focus);
  if (m.phase !== 'attack' || !m.first || !desk || m.launches?.some(l => l.desk === desk.id)) return m;
  const ids = m.attackPlans?.[desk.id] ?? [];
  if (!ids.length || ids.length > ATTACK_BUDGET || new Set(ids).size !== ids.length || !ids.every(id => desk.cases.includes(id))) return m;
  return { ...m, launches: [...(m.launches ?? []), { desk: desk.id, ids: [...ids] }] };
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
    rubricVersion: 'school-community-' + (m.form ?? 1), status: m.phase,
    brief: BRIEF, project: legacy ? m.project : ASSIGNMENT,
    assignedCases: legacy ? undefined : ASSIGNED_CASES,
    requiredPredictions: m.form === 3 ? 0 : legacy ? 2 : ASSIGNED_CASES.length,
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
