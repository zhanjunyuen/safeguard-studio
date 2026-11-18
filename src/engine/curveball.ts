import { CURVEBALLS } from '../data/curveballs';
import type { TestResult } from '../types';
import { runProgram } from './run';
import type { CurveballAnswer, Desk, Mission, Rule } from './mission';

/** Runs a challenge's unseen curveball against the pupil's frozen build. */
export function runCurveball(rules: Rule[], desk: Desk): TestResult {
  const script = rules.filter(r => r.scope === 'all' || r.scope === desk).map((r, i) => ({ uid: `cb-${i}`, type: r.type }));
  return runProgram(script, CURVEBALLS[desk].test);
}

/** Safe and still an answer is "handled"; a refusal is safe but is not counted as handling it well. */
export const curveballHandled = (r: TestResult) => r.outcome === 'pass';

/** Records a curveball prediction once the attack for that challenge has launched. Answers are final. */
export function submitCurveball(m: Mission, desk: Desk, answer: CurveballAnswer): Mission {
  const reason = answer.reason.trim();
  if (m.form !== 4 || !m.frozen?.[desk] || !m.launches?.some(l => l.desk === desk) || m.curveballs?.[desk]) return m;
  if (!reason || (answer.prediction !== 'handles' && answer.prediction !== 'struggles')) return m;
  return { ...m, curveballs: { ...m.curveballs, [desk]: { prediction: answer.prediction, reason } } };
}
