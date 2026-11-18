import { BLOCKS } from '../data/blocks';
import type { Challenge, RunReport, ScriptBlock } from '../types';

/** Safeguards that react to what a message says, so an IF condition can decide when they are needed. */
const CUEABLE = new Set(['strip_pii', 'consent', 'coach', 'balance', 'mitigate']);

const q = (s: string) => `“${s}”`;
const list = (xs: string[]) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export interface BlockUse {
  uid: string;
  label: string;
  /** messages it ran on (out of all tests) */
  ran: number;
  /** messages where it actually changed something */
  helped: number;
  /** titles of the tests it helped on */
  helpedOn: string[];
  /** usefulness points it costs: block cost × share of messages it ran on */
  points: number;
  /** inside an IF block */
  conditional: boolean;
  /** an IF could sensibly control it */
  cueable: boolean;
}

/** For every block in the helper (including ones inside IFs): where it ran, where it helped, what it cost. */
export function blockUsage(script: ScriptBlock[], report: RunReport, challenge: Challenge): BlockUse[] {
  const title = (id: string) => challenge.tests.find((t) => t.id === id)?.title ?? id;
  const blocks: { b: ScriptBlock; conditional: boolean }[] = [];
  for (const b of script) {
    if (b.type === 'if' || b.type === 'ifelse') {
      if (b.then) blocks.push({ b: b.then, conditional: true });
      if (b.else) blocks.push({ b: b.else, conditional: true });
    } else if (b.type !== 'ask_ai') blocks.push({ b, conditional: false });
  }
  const n = report.results.length || 1;
  return blocks.map(({ b, conditional }) => {
    const hits = report.results.map((r) => ({ r, s: r.steps.find((s) => s.uid === b.uid) })).filter((x) => x.s);
    const helpedOn = hits.filter((x) => x.s!.status === 'acted').map((x) => title(x.r.testId));
    const def = BLOCKS[b.type];
    return {
      uid: b.uid,
      label: def.label,
      ran: hits.length,
      helped: helpedOn.length,
      helpedOn,
      points: Math.round(((def.cost * hits.length) / n) * 10) / 10,
      conditional,
      cueable: CUEABLE.has(def.effect),
    };
  });
}

/** Specific advice when a helper passes its tests but isn't useful enough. */
export function usefulnessAdvice(script: ScriptBlock[], report: RunReport, level2: boolean, challenge?: Challenge): string {
  const ch = challenge ?? ({ tests: [] } as unknown as Challenge);
  const use = blockUsage(script, report, ch).filter((x) => x.ran > 0);
  const never = use.filter((x) => x.helped === 0);
  const sometimes = use.filter((x) => !x.conditional && x.cueable && x.helped > 0 && x.helped < x.ran).sort((a, b) => b.points - a.points);
  const neverText = never.length ? `${list(never.map((x) => q(x.label)))} never changed a single answer, so ${never.length === 1 ? 'it is' : 'they are'} only slowing things down.` : '';

  if (level2 && sometimes.length) {
    const top = sometimes[0];
    const where = top.helpedOn.length ? ` It only mattered for: ${list(top.helpedOn.map(q))}. What do ${top.helpedOn.length === 1 ? 'that message' : 'those messages'} have in common? Pick the IF condition that is true for ${top.helpedOn.length === 1 ? 'it' : 'all of them'}.` : '';
    return `${q(top.label)} runs on all ${top.ran} messages but only helped on ${top.helped}. Put it inside an IF … THEN.${where}${neverText ? ' ' + neverText : ''}`;
  }
  if (neverText) return `${neverText} Take out blocks that are not doing anything for this job.`;
  if (level2) return 'Every always-on safeguard slows every answer down. Wrap safeguards in IF blocks so they only run on the messages that need them.';
  return 'Every block slows every answer down. Check whether each one is really needed for this job.';
}
