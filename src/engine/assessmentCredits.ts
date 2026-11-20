import { attackCases } from '../data/attackCases';
import { baseId, getChallenge } from '../data/challenges';
import { designCheck } from '../data/designChecks';
import { CURVEBALLS } from '../data/curveballs';
import type { Attempt } from '../store/session';
import type { Challenge, ScriptBlock, TestResult } from '../types';
import { ATTACK_BUDGET } from './breaker';
import { attackCredits, challengeIdFor, requestCredits, roundCredits, ruleScript, type Desk, type Mission } from './mission';
import { runProgram } from './run';
import { idealScript } from './targets';
import { keyToBlock } from './scriptText';

/** A submitted build runs its recorded test cases and, on newer builds, two design-check requests. */
export function buildCredits(task: Challenge, script: ScriptBlock[], results: TestResult[], design: boolean) {
  let spent = results.reduce((sum, result) => sum + requestCredits(result), 0);
  if (design) {
    const { variant, control } = designCheck(task);
    spent += requestCredits(runProgram(script, variant)) + requestCredits(runProgram(script, control));
  }
  return roundCredits(spent);
}

export function attemptCredits(task: Challenge, attempt: Attempt) {
  if (attempt.creditsUsed !== undefined) return attempt.creditsUsed;
  const script = attempt.script.map((key, i) => keyToBlock(key, String(i)));
  const results = attempt.results.flatMap(saved => {
    const test = task.tests.find(t => t.id === saved.testId);
    return test ? [runProgram(script, test)] : [];
  });
  return buildCredits(task, script, results, !!attempt.blockQuality);
}

type SpendingMission = Pick<Mission, 'level' | 'frozen' | 'launches' | 'curveballs'>;

export function taskSpending(m: SpendingMission, desk: Desk, attempts: Attempt[]) {
  const task = getChallenge(challengeIdFor(m, desk))!;
  const builds = roundCredits(attempts.reduce((sum, attempt) => sum + attemptCredits(task, attempt), 0));
  const rules = m.frozen?.[desk];
  const launch = m.launches?.find(l => l.desk === desk);
  const attacks = rules && launch ? launch.creditsUsed ?? attackCredits(rules, launch.ids, launch.custom) : 0;
  const prediction = m.curveballs?.[desk];
  const curveball = prediction && rules
    ? prediction.creditsUsed ?? requestCredits(runProgram(ruleScript(rules, desk), CURVEBALLS[desk]!.test)) : 0;
  return { builds, attacks, curveball, total: roundCredits(builds + attacks + curveball) };
}

const budgets = new Map<string, number>();

export function taskBudget(id: string) {
  const saved = budgets.get(id);
  if (saved !== undefined) return saved;
  const task = getChallenge(id)!;
  const script = idealScript(id);
  const build = buildCredits(task, script, task.tests.map(t => runProgram(script, t)), true);
  const attacks = attackCases(task).map(t => requestCredits(runProgram(script, t)));
  attacks.push(1); // A submitted custom request uses one AI judgement.
  const fullAttack = attacks.sort((a, b) => b - a).slice(0, ATTACK_BUDGET).reduce((sum, cost) => sum + cost, 0);
  const curveball = requestCredits(runProgram(script, CURVEBALLS[baseId(id)]!.test));
  const budget = Math.ceil(2 * build + fullAttack + curveball);
  budgets.set(id, budget);
  return budget;
}
