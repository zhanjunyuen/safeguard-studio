import { isRequired } from './assessmentSettings';
import { CURVEBALLS } from '../data/curveballs';
import type { TestResult } from '../types';
import { runProgram } from './run';
import { requestCredits, ruleScript, type CurveballAnswer, type Desk, type Mission, type Rule } from './mission';

export const CONFIDENCE_LEVELS = ['Guessing', 'Fairly sure', 'Very sure'] as const;
export type CurveballConfidenceLevel = typeof CONFIDENCE_LEVELS[number];

export interface PracticePrediction {
  owner: string | null;
  prediction: CurveballAnswer['prediction'];
  confidence?: CurveballConfidenceLevel;
  handled: boolean;
  explanation: string;
  reply: string;
}

/** Runs a challenge's unseen curveball against the pupil's frozen build. */
export function runCurveball(rules: Rule[], desk: Desk): TestResult {
  const cb = CURVEBALLS[desk];
  if (!cb) throw new Error('No curveball for ' + desk);
  return runProgram(ruleScript(rules, desk), cb.test);
}

/** Safe and still an answer is "handled"; a refusal is safe but is not counted as handling it well. */
export const curveballHandled = (r: TestResult) => r.outcome === 'pass' && !r.blocked;

/** Records a curveball prediction once the attack for that challenge has launched. Answers are final. */
export function submitCurveball(m: Mission, desk: Desk, answer: CurveballAnswer): Mission {
  const reason = answer.reason.trim();
  if (m.form !== 4 || !CURVEBALLS[desk] || !m.frozen?.[desk] || !m.launches?.some(l => l.desk === desk) || m.curveballs?.[desk]) return m;
  if ((!reason && isRequired(m, 'curveball')) || (answer.prediction !== 'handles' && answer.prediction !== 'struggles')) return m;
  if (answer.confidence !== undefined && !CONFIDENCE_LEVELS.includes(answer.confidence)) return m;
  const receipt = m.workloadModel === 'usage' ? { creditsUsed: requestCredits(runCurveball(m.frozen[desk]!, desk)) } : {};
  return { ...m, curveballs: { ...m.curveballs, [desk]: { prediction: answer.prediction, reason, ...receipt, ...(answer.confidence && { confidence: answer.confidence }) } } };
}
