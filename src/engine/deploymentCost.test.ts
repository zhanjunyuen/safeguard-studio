import { expect, it } from 'vitest';
import { getChallenge } from '../data/challenges';
import { freshProgress } from '../store/session';
import { assessmentBudget, challengeEvidence, serviceWorkloads, deployedEffectiveness } from './challengeEvidence';
import { savedDeploymentCost } from './deploymentCost';
import { newAssessment } from './mission';
import { finalScore } from './finalScore';

const mission = { ...newAssessment(), assigned: ['quiz'] };
const cost = savedDeploymentCost;

it('prices the deployed stack once, independently of edits, test runs, attacks and curveballs', () => {
  const progress = freshProgress();
  const activity = { ...mission, frozen: { quiz: [{ scope: 'quiz', type: 'ask_ai' }] },
    launches: [{ desk: 'quiz', ids: ['q_marks'], creditsUsed: 12 }], curveballs: { quiz: { prediction: 'handles' as const, reason: '' } } };
  const attempt = { at: 1, script: ['ask_ai'], creditsUsed: 8, results: [],
    scores: { privacy: null, verification: null, bias: null, integrity: null, usefulness: 100 } };
  progress.attempts.push(attempt, attempt);
  const work = { quiz: progress };
  expect(serviceWorkloads(activity, work)[0].credits).toBe(0);
  const live = { ...activity, deployed: { quiz: ['ask_ai'] } };
  expect(challengeEvidence(live, work).workloadCredits).toBe(1);
  progress.script.push({ uid: 'check', type: 'check_textbook' });
  expect(finalScore(live, work, []).workloadCredits).toBe(1);
  const revised = { ...live, deployed: { quiz: ['ask_ai', 'check_textbook'] } };
  expect(challengeEvidence(revised, work).workloadCredits).toBe(1.4);
  expect(assessmentBudget(mission)).toBe(cost(getChallenge('quiz')!.ideal));
});

it('prices reachable branches and stops before downstream model calls', () => {
  expect(cost(['ask_grownup', 'ask_ai'])).toBe(0.1);
  expect(cost(['ask_ai', 'ask_grownup'])).toBe(1.1);
  expect(cost(['ifelse:person:ask_grownup:remove_pii', 'ask_ai'])).toBe(1.2);
  expect(cost(['if:person:remove_pii:', 'ifelse:person::remove_pii', 'ask_ai'])).toBe(1.2);
  expect(cost(['check_source', 'ask_ai'])).toBe(1);
});

it('awards deployment efficiency for a useful and safe deployed helper', () => {
  expect(deployedEffectiveness(mission, 'quiz')).toBe(0);
  expect(deployedEffectiveness({ ...mission, deployed: { quiz: ['ask_grownup', 'ask_ai'] } }, 'quiz')).toBe(0);
  expect(deployedEffectiveness({ ...mission, deployed: { quiz: getChallenge('quiz')!.ideal } }, 'quiz')).toBe(1);
});
