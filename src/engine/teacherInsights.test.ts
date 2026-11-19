import { expect, it } from 'vitest';
import { dashboardObservation, teacherEvidence } from './teacherInsights';
import { profileChallenge } from './profile';
import { freshProgress } from '../store/session';
import { getChallenge } from '../data/challenges';
import { runChallenge } from './run';

it('uses measured pupils as denominators and keeps names, identifiers and written work out of the evidence', () => {
  const progress = freshProgress();
  const challenge = getChallenge('history')!;
  const run = runChallenge(progress.script, challenge);
  const attempt = { at: 1, script: ['ask_ai'], scores: run.scores, results: run.results };
  progress.attempts = [attempt, attempt];
  progress.reflections = [{ attempt: 1, testId: 'unused', chosen: 'wrong_check', expected: 'wrong_check', correct: true, text: 'private reflection' }];
  const built = { name: 'private pupil', id: 'private id', profile: profileChallenge('history', progress), spot: null };
  const onlyAttacks = { profile: profileChallenge('history', freshProgress()), spot: { attempts: 1, found: 1, total: 2, foundPct: 50, firstTryPct: 50, precision: 100 } };
  const evidence = teacherEvidence([built, onlyAttacks], 'History', false, false);
  expect(evidence).toMatchObject({ audience: 'whole class', source: 'live dashboard', pupilsWithActivity: 2, builds: 2,
    reflections: { pupilsMeasured: 1, meanAccuracyPercent: 100 }, attackPractice: { pupilsMeasured: 1, weakSpotsFound: 1 } });
  expect(evidence.skills.every(s => s.pupilsMeasured === 1)).toBe(true);
  expect(evidence.challenges[0]).toMatchObject({ pupils: 1, latestTestsAttempted: challenge.tests.length });
  expect(dashboardObservation(evidence, 'How should I teach privacy?')).toContain('redaction');
  expect(JSON.stringify(evidence)).not.toMatch(/private|student_id|script|timeline/);
  const pupil = teacherEvidence([onlyAttacks], 'History', true, true);
  expect(pupil).toMatchObject({ audience: 'selected pupil', source: 'sample dashboard', skills: [], builds: 0 });
});
