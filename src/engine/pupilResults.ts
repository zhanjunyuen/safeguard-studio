import { attackCases } from '../data/attackCases';
import { CHALLENGES, baseId, getChallenge, practiceTitle } from '../data/challenges';
import { THEMES } from '../data/themes';
import type { BreakAttempt, ChallengeProgress } from '../store/session';
import { judgeBuildResult } from './run';
import type { BlockQuality, Challenge, Outcome, Scores, TestCategory } from '../types';
import { blockCredits, evaluate, assignedDesks, challengeIdFor, type Mission } from './mission';
import { labelOf } from './scriptText';
import { jsonIn } from './marking';
import type { CustomAttack } from './customAttack';

export const resultQuestions = ['Explain my result', 'Compare my builds', 'Review my prediction', 'What should I practise next?'] as const;

interface RecordedCase { testId: string; outcome?: Outcome; exposed?: boolean }
export interface PupilRun {
  id: string;
  group: string;
  label: string;
  kind: 'build' | 'attack';
  challenge: Challenge;
  script: string[];
  cases: RecordedCase[];
  at: number;
  scores?: Scores;
  blockQuality?: BlockQuality;
  prediction?: string;
  custom?: CustomAttack;
  assessment?: { model: Mission['workloadModel'] };
}

// Reflections refer to the one-based index in the original, shared device history.
export function personalPractice(history: Record<string, ChallengeProgress>, attacks: Record<string, BreakAttempt[]>, owner: string | null) {
  const progress: Record<string, ChallengeProgress> = {};
  const breakProgress: Record<string, BreakAttempt[]> = {};
  for (const [task, p] of Object.entries(history)) {
    const numbers = new Map<number, number>();
    const attempts = p.attempts.filter((attempt, i) => {
      if ((attempt.owner ?? null) !== owner) return false;
      numbers.set(i + 1, numbers.size + 1);
      return true;
    });
    if (!attempts.length) continue;
    const reflections = p.reflections.flatMap(r => {
      const number = numbers.get(r.attempt);
      return number && (r.owner === undefined || r.owner === owner) ? [{ ...r, attempt: number }] : [];
    });
    progress[task] = { attempts, reflections, script: [], events: [], pendingReflection: null,
      seen: [...new Set(attempts.flatMap(a => a.results.map(r => r.testId)))] };
  }
  for (const [task, rows] of Object.entries(attacks)) {
    const own = rows.filter(r => (r.owner ?? null) === owner);
    if (own.length) breakProgress[task] = own;
  }
  return { progress, breakProgress };
}

export function pupilRuns(practice: Record<string, ChallengeProgress>, breaks: Record<string, BreakAttempt[]>,
  work: Record<string, ChallengeProgress>, mission?: Mission, owner: string | null = null): PupilRun[] {
  const runs: PupilRun[] = [];
  function builds(task: Challenge, progress?: ChallengeProgress, assessment?: PupilRun['assessment']) {
    const group = (assessment ? 'Assessment' : 'Practice') + ' · ' + practiceTitle(task.id);
    const prefix = (assessment ? 'assessment-' : 'practice-') + task.id;
    let number = 0;
    progress?.attempts.forEach((a, i) => {
      if (!assessment && (a.owner ?? null) !== owner) return;
      if (!a.results.length) return;
      number++;
      runs.push({ id: prefix + '-run-' + (i + 1), group, label: 'Run ' + number, kind: 'build',
        challenge: task, script: a.script, cases: a.results, scores: a.scores, blockQuality: a.blockQuality, at: a.at, assessment });
    });
    return { group, prefix };
  }
  for (const id of new Set([...Object.keys(practice), ...Object.keys(breaks)])) {
    const task = getChallenge(id);
    if (!task) continue;
    const { group, prefix } = builds(task, practice[id]);
    let attackNumber = 0;
    breaks[id]?.forEach((a, i) => {
      if ((a.owner ?? null) !== owner) return;
      attackNumber++;
      runs.push({ id: prefix + '-attack-' + (i + 1), group, label: 'Attack ' + attackNumber, kind: 'attack', challenge: task,
        script: task.breakTarget, cases: a.attacks.map(testId => ({ testId, exposed: a.broke.includes(testId) })), at: a.at, custom: a.custom });
    });
  }
  if (mission?.form === 4 && mission.phase !== 'brief') {
    for (const desk of assignedDesks(mission)) {
      const task = getChallenge(challengeIdFor(mission, desk.id))!;
      const { group, prefix } = builds(task, work[desk.id], { model: mission.workloadModel });
      const launch = mission.launches?.find(l => l.desk === desk.id);
      const frozen = mission.frozen?.[desk.id];
      if (launch && frozen) runs.push({ id: prefix + '-attack', group, label: 'Submitted attack', kind: 'attack', challenge: task,
        script: frozen.map(r => r.type), cases: launch.ids.map(testId => ({ testId })), prediction: launch.reason, custom: launch.custom,
        at: work[desk.id]?.attempts.at(-1)?.at ?? 0 });
    }
  }
  return runs.sort((a, b) => b.at - a.at);
}

// Only resolve cases actually recorded in this run. Never enumerate hidden tests into an AI request.
export function replayCases(run: PupilRun) {
  const bank = run.kind === 'attack' ? attackCases(run.challenge) : run.challenge.tests;
  const rules = run.script.map(type => ({ type, scope: baseId(run.challenge.id) }));
  return run.cases.flatMap(saved => {
    const test = bank.find(t => t.id === saved.testId);
    if (!test) return [];
    const replay = evaluate(rules, test.id, run.assessment?.model);
    if (run.blockQuality) replay.result = judgeBuildResult(test, replay.result);
    const outcome = saved.outcome ?? (saved.exposed === undefined ? replay.result.outcome : saved.exposed ? 'weakness exposed' : 'pass');
    const matches = saved.exposed === undefined ? outcome === replay.result.outcome : saved.exposed === (replay.result.outcome !== 'pass');
    return [{ title: test.title, skill: test.category, outcome, matches, replay }];
  });
}

export function runFacts(run: PupilRun) {
  const cases = replayCases(run);
  let credits: number | undefined;
  if (run.kind === 'build' && run.assessment && cases.length && cases.every(c => c.matches)) {
    credits = run.assessment.model ? Math.ceil(cases.reduce((n, c) => n + c.replay.credits, 0) / cases.length)
      : run.script.reduce((n, key) => n + blockCredits(key), 0) * cases[0].replay.volume;
  }
  return { id: run.id, task: run.group, run: run.label, blocks: run.script.map(labelOf).join(' → ').slice(0, 680),
    cases: cases.map(c => ({ id: c.replay.id, title: c.title, skill: c.skill, outcome: c.outcome, why: c.matches ? c.replay.result.explanation.slice(0, 165) : undefined })),
    blockQualityOutOf100: run.blockQuality?.score, skillScoresOutOf100: run.scores, projectedWorkloadCredits: credits, submittedPrediction: run.prediction?.slice(0, 600),
    aiJudgement: run.custom && { request: run.custom.question.slice(0, 500), outcome: run.custom.outcome, explanation: run.custom.explanation.slice(0, 500) } };
}

// Count distinct latest builds exhibiting each difficulty so repeatedly running one task cannot dominate.
export function practiceSuggestion(runs: PupilRun[]) {
  const latest = new Map<string, PupilRun>();
  for (const r of runs) if (r.kind === 'build' && !latest.has(r.group)) latest.set(r.group, r);
  const bySkill = new Map<TestCategory, PupilRun[]>();
  for (const r of latest.values()) {
    const missed = new Set(r.cases.filter(c => c.outcome !== 'pass').map(c => r.challenge.tests.find(t => t.id === c.testId)?.category));
    for (const skill of missed) if (skill) bySkill.set(skill, [...(bySkill.get(skill) ?? []), r]);
  }
  const common = [...bySkill.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const source = common?.[1] ?? runs.slice(0, 1);
  if (!source.length) return;
  const theme = THEMES.find(t => t.competency === common?.[0])?.id ?? source[0].challenge.themeId;
  const candidates = CHALLENGES.filter(c => c.themeId === theme);
  const task = candidates.find(c => !runs.some(r => baseId(r.challenge.id) === c.id)) ?? candidates[0];
  return { task, skill: common?.[0], sources: source };
}

export function parsePupilAnswer(raw: string | null, ids: string[]) {
  const answer = raw && jsonIn(raw);
  if (!answer || typeof answer.answer !== 'string' || !answer.answer.trim() || answer.answer.length > 1600 ||
    !Array.isArray(answer.sources) || !answer.sources.length || !answer.sources.every(id => typeof id === 'string' && ids.includes(id))) return null;
  return { text: answer.answer.trim(), sources: [...new Set<string>(answer.sources)] };
}

export function offlinePupilFeedback(question: string, facts: ReturnType<typeof runFacts>[], suggestion?: ReturnType<typeof practiceSuggestion>) {
  let text = 'Open a replay below to see the recorded outcome and the steps your helper took.';
  if (question === resultQuestions[1]) {
    const [before, after] = facts;
    const changes = after.cases.flatMap(c => {
      const prev = before.cases.find(t => t.title === c.title);
      return prev && prev.outcome !== c.outcome ? [c.title + ' (' + prev.outcome + ' → ' + c.outcome + ')'] : [];
    });
    text = changes.length ? 'Changed outcomes: ' + changes.join(', ') + '.' : 'The recorded outcomes stayed the same.';
    if (before.projectedWorkloadCredits !== undefined && after.projectedWorkloadCredits !== undefined)
      text += ' Projected workload went from ' + before.projectedWorkloadCredits + ' to ' + after.projectedWorkloadCredits + ' credits.';
  } else if (suggestion) {
    text = suggestion.skill ? 'Try ' + suggestion.task.title + '. The latest build in ' + suggestion.sources.length +
      ' task' + (suggestion.sources.length === 1 ? '' : 's') + ' still had a ' + suggestion.skill + ' test to work on.'
      : 'Try ' + suggestion.task.title + ' to practise the same theme in another run.';
  } else if (question === resultQuestions[2] || question === resultQuestions[0]) {
    const f = facts[0];
    const c = f.cases.find(t => t.outcome !== 'pass') ?? f.cases[0];
    text = [question === resultQuestions[2] && f.submittedPrediction && 'You predicted “' + f.submittedPrediction + '”.',
      c && c.title + ' · ' + c.outcome + '. ' + (c.why ?? ''),
      f.aiJudgement && 'AI judgement on your written request: ' + f.aiJudgement.explanation].filter(Boolean).join(' ');
  }
  return text;
}
