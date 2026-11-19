import { practiceTitle } from '../data/challenges';
import type { breakSummary } from './breaker';
import { averageScores, DIMS, type ChallengeProfile } from './profile';

export interface PerformanceRow {
  profile: ChallengeProfile;
  spot: ReturnType<typeof breakSummary>;
  parts?: { profile: ChallengeProfile }[];
}

// Only computed results enter the packet. Names, written answers and run logs stay out.
export function teacherEvidence(rows: PerformanceRow[], scope: string, individual: boolean, sample: boolean) {
  const first = averageScores(rows.map(r => r.profile.anticipated));
  const latest = averageScores(rows.map(r => r.profile.current));
  const skills = DIMS.flatMap(skill => latest[skill] === null ? [] : [{
    skill, first: first[skill], latest: latest[skill]!,
    pupilsMeasured: rows.filter(r => typeof r.profile.current?.[skill] === 'number').length,
  }]);
  const mistakes = new Map<string, number>();
  const tasks = new Map<string, { pupils: number; latestTestsPassed: number; latestTestsAttempted: number }>();
  const reflections = rows.flatMap(r => r.profile.reflectionAccuracy ?? []);
  for (const row of rows) {
    for (const mistake of row.profile.misconceptions) mistakes.set(mistake, (mistakes.get(mistake) ?? 0) + 1);
    for (const { profile } of row.parts ?? [row]) {
      const last = profile.timeline.at(-1);
      if (!last) continue;
      const task = tasks.get(profile.challengeId) ?? { pupils: 0, latestTestsPassed: 0, latestTestsAttempted: 0 };
      task.pupils++;
      task.latestTestsPassed += last.passed;
      task.latestTestsAttempted += last.total;
      tasks.set(profile.challengeId, task);
    }
  }
  return {
    audience: individual ? 'selected pupil' : 'whole class', source: sample ? 'sample dashboard' : 'live dashboard', scope,
    pupilsWithActivity: rows.length, builds: rows.reduce((n, r) => n + r.profile.attempts, 0), skills,
    mistakesSeenAcrossRuns: [...mistakes].sort((a, b) => b[1] - a[1]).map(([mistake, pupils]) => ({ mistake, pupils })),
    reflections: { pupilsMeasured: reflections.length, meanAccuracyPercent: reflections.length ? Math.round(reflections.reduce((a, b) => a + b) / reflections.length) : null },
    attackPractice: { pupilsMeasured: rows.filter(r => r.spot).length, weakSpotsFound: rows.reduce((n, r) => n + (r.spot?.found ?? 0), 0), availableOnAttemptedChallenges: rows.reduce((n, r) => n + (r.spot?.total ?? 0), 0) },
    challenges: [...tasks].map(([id, stats]) => ({ title: practiceTitle(id), ...stats })),
  };
}

const lessonIdea = {
  verification: 'Give pupils a confident claim and two possible sources. Ask which source could actually verify the claim, then test their choice.',
  privacy: 'Trace a request containing a fictional address. Ask pupils to place the redaction block where it protects the address before the model sees it.',
  integrity: 'Compare a completed homework answer with a coaching prompt. Ask pupils to revise their helper so the learner still does the thinking.',
  bias: 'Run the same task with two different names. Ask which details should influence the decision and test the revised rule.',
  judgement: 'Compare a routine request with one that needs adult help. Ask pupils to predict when the helper should hand over.',
  manipulation: 'Give pupils a message claiming false authority. Ask them to identify the claim and test a check before the helper acts.',
  usefulness: 'Try a harmless request and a risky one. Ask pupils to keep the harmless one working while safeguarding the risky one.',
};

export function dashboardObservation(evidence: ReturnType<typeof teacherEvidence>, question: string) {
  const requested = evidence.skills.find(s => question.toLowerCase().includes(s.skill));
  const gains = evidence.skills.filter(s => s.first !== null && s.latest > s.first)
    .sort((a, b) => (b.latest - b.first!) - (a.latest - a.first!));
  const growth = /improv|progress|gain|growth/i.test(question);
  const skill = requested ?? (growth && gains.length ? gains[0] : [...evidence.skills].sort((a, b) => a.latest - b.latest)[0]);
  if (!skill) return `Attack practice found ${evidence.attackPractice.weakSpotsFound} of ${evidence.attackPractice.availableOnAttemptedChallenges} possible weak spots on attempted challenges. Ask pupils to predict which attack will work and explain the result.`;
  const scores = skill.first === null ? `latest score ${skill.latest}/100` : `first ${skill.first}/100, latest ${skill.latest}/100`;
  const issue = evidence.mistakesSeenAcrossRuns[0];
  return [
    `${skill.skill[0].toUpperCase() + skill.skill.slice(1)} (${skill.pupilsMeasured} measured): ${scores}.`,
    issue && `Observed across runs: “${issue.mistake}” (${issue.pupils} ${issue.pupils === 1 ? 'pupil' : 'pupils'}).`,
    lessonIdea[skill.skill],
  ].filter(Boolean).join('\n\n');
}
