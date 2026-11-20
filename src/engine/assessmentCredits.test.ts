import { expect, it } from 'vitest';
import { getChallenge } from '../data/challenges';
import { taskFocus, testSkills } from '../data/testSkills';
import { freshProgress } from '../store/session';
import { assessmentBudget, challengeEvidence, serviceWorkloads } from './challengeEvidence';
import { attemptCredits, buildCredits } from './assessmentCredits';
import { evaluate, newAssessment } from './mission';
import { runChallenge } from './run';

const task = getChallenge('quiz')!;
const mission = { ...newAssessment(), assigned: ['quiz'] };
const work = () => {
  const progress = freshProgress();
  const report = runChallenge(progress.script, task);
  const creditsUsed = buildCredits(task, progress.script, report.results, true);
  const attempt = { at: 1, script: ['ask_ai'], results: report.results, scores: report.scores, blockQuality: report.blockQuality, creditsUsed };
  return { progress, attempt };
};

it('starts the quiz at zero, records both design requests and accumulates completed runs only', () => {
  const { progress, attempt } = work();
  const usage = () => serviceWorkloads(mission, { quiz: progress })[0].credits;
  expect(usage()).toBe(0);
  expect(attempt.creditsUsed).toBe(8);
  progress.attempts.push(attempt);
  progress.script = [{ uid: 'changed', type: 'ask_grownup' }];
  expect(usage()).toBe(8);
  expect(usage()).toBe(8);
  progress.attempts.push({ ...attempt, at: 2 });
  expect(usage()).toBe(16);
  expect(attemptCredits(task, { ...attempt, creditsUsed: undefined })).toBe(8);
  expect(attemptCredits(task, { ...attempt, creditsUsed: undefined, blockQuality: undefined })).toBe(6);
});

it('charges the submitted attack and curveball once against the frozen build', () => {
  const { progress, attempt } = work();
  progress.attempts.push(attempt);
  const frozen = { quiz: [{ type: 'ask_ai', scope: 'quiz' }] };
  const played = { ...mission, frozen, launches: [{ desk: 'quiz', ids: [task.tests[0].id] }],
    curveballs: { quiz: { prediction: 'handles' as const, reason: 'The rule covers it.' } } };
  const packet = challengeEvidence(played, { quiz: progress });
  expect(packet.challenges[0].spending).toEqual({ builds: 8, attacks: 1, curveball: 1, total: 10 });
  expect(packet.workloadCredits).toBe(10);
  expect(assessmentBudget(played)).toBeGreaterThan(20);
  const run = (blocks: string[]) => evaluate(blocks.map(type => ({ type, scope: 'quiz' })), task.tests[0].id, 'usage');
  expect(run(['ask_grownup', 'ask_ai']).credits).toBe(0.1);
  expect(run(['ask_ai', 'ask_grownup']).credits).toBe(1.1);
});

it('identifies the quiz focus and connects individual cases to teaching keywords', () => {
  expect(taskFocus(task).primary).toBe('Academic integrity');
  expect(taskFocus(task).keywords).toContain('Protecting personal details');
  expect(testSkills(task.tests.find(t => t.flags.oneSided)!)).toEqual(['Recognising bias']);
});
