import type { Challenge, RunReport, ScriptBlock } from '../types';
import { runProgram, scoreResults } from './run';
import { keyToBlock } from './scriptText';

export const ATTACK_BUDGET = 3;

export const targetScript = (c: Challenge): ScriptBlock[] => c.breakTarget.map((key, i) => keyToBlock(key, `target-${i}`));

/** Tests the locked helper does not pass. Computed by the real engine, never hand-written. */
export function weakSpots(c: Challenge): string[] {
  const script = targetScript(c);
  return c.tests.filter((t) => runProgram(script, t).outcome !== 'pass').map((t) => t.id);
}

export interface LaunchReport extends RunReport {
  broke: string[];
  held: string[];
  weak: string[];
}

/** Runs the chosen attacks against the challenge's locked helper. */
export function launch(c: Challenge, attackIds: string[]): LaunchReport {
  const script = targetScript(c);
  const tests = attackIds.map((id) => c.tests.find((t) => t.id === id)!).filter(Boolean);
  const results = tests.map((t) => runProgram(script, t));
  const broke = results.filter((r) => r.outcome !== 'pass').map((r) => r.testId);
  return {
    results,
    scores: scoreResults(script, results),
    passed: results.length - broke.length,
    total: results.length,
    broke,
    held: results.filter((r) => r.outcome === 'pass').map((r) => r.testId),
    weak: weakSpots(c),
  };
}

/** Summary of all break attempts on one challenge. */
export function breakSummary(c: Challenge, attempts: { attacks: string[]; broke: string[] }[]) {
  if (!attempts.length) return null;
  const weak = weakSpots(c);
  const found = new Set(attempts.flatMap((a) => a.broke));
  const used = attempts.reduce((n, a) => n + a.attacks.length, 0);
  const hits = attempts.reduce((n, a) => n + a.broke.length, 0);
  return {
    found: found.size,
    total: weak.length,
    foundPct: weak.length ? Math.round((found.size / weak.length) * 100) : 0,
    precision: used ? Math.round((hits / used) * 100) : 0,
    attempts: attempts.length,
    firstTryPct: weak.length ? Math.round((new Set(attempts[0].broke).size / weak.length) * 100) : 0,
  };
}

/** Break-mode results summed across several challenges. */
export function breakSummaryAll(entries: { challenge: Challenge; attempts: { attacks: string[]; broke: string[] }[] }[]) {
  const used = entries.filter((e) => e.attempts.length);
  if (!used.length) return null;
  let found = 0, total = 0, attacks = 0, hits = 0, attempts = 0, firstFound = 0;
  for (const { challenge, attempts: a } of used) {
    const weak = weakSpots(challenge);
    found += new Set(a.flatMap((x) => x.broke)).size;
    firstFound += new Set(a[0].broke).size;
    total += weak.length;
    attacks += a.reduce((n, x) => n + x.attacks.length, 0);
    hits += a.reduce((n, x) => n + x.broke.length, 0);
    attempts += a.length;
  }
  return {
    found,
    total,
    foundPct: Math.round((found / total) * 100),
    precision: attacks ? Math.round((hits / attacks) * 100) : 0,
    attempts,
    firstTryPct: Math.round((firstFound / total) * 100),
  };
}
