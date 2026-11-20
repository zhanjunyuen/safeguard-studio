import type { ChallengeProgress } from '../store/session';
import { assessmentBudget, evaluateDesk, serviceWorkloads } from './challengeEvidence';
import { scoreOf, SKILL_ORDER, type Mark } from './marking';
import { optionalSkills } from './assessmentSettings';
import { assignedDesks, handled, roundCredits, type Mission } from './mission';
import { DIMS, type Dim } from './profile';
import { ATTACK_HINT_LIMIT } from './attackHints';

/**
 * The final assessment score out of 100. Each category gets its own score out of 100, and the final
 * score is their weighted average. Fixed, published rules, like levelFor: the AI explains the score
 * but never sets it.
 *
 *   Written answers     40%  the four skills marked from the pupil's answers (0–2 each)
 *   Blocks: tests       25%  share of tests the latest builds handle safely and usefully
 *   Blocks: workload    10%  keeping assessment spending within the budget, with working builds
 *   Attempts            15%  getting each build working in few runs (1–2 runs is full marks)
 *   Independence        10%  AI hints used: each of the 3 hints costs a third of this category
 */
export const WEIGHTS = { answers: 40, tests: 25, workload: 10, attempts: 15, independence: 10 } as const;
export type Category = keyof typeof WEIGHTS;
export const CATEGORIES = Object.keys(WEIGHTS) as Category[];

/** Runs that still earn full attempt points; each run after that costs ATTEMPT_STEP, down to ATTEMPT_FLOOR. */
export const FREE_RUNS = 2;
export const ATTEMPT_STEP = 0.1;
export const ATTEMPT_FLOOR = 0.4;

/** Final bands, highest first. */
export const FINAL_BANDS: { min: number; band: string }[] = [
  { min: 85, band: 'Outstanding' },
  { min: 65, band: 'Strong' },
  { min: 40, band: 'Developing' },
  { min: 0, band: 'Getting started' },
];

export interface ChallengeScore {
  id: string; title: string; runs: number; passed: number; tested: number;
  /** 0–1: share of tests the latest build handles */
  tests: number;
  /** 0–1: run efficiency (1 for 1–2 runs) times `tests` */
  attempts: number;
}

export interface FinalScore {
  total: number; outOf: 100; band: string;
  /** each category's score out of 100; null = not counted (every written question optional and skipped) */
  categories: Record<Category, number | null>;
  /** each category's contribution to the total, in points */
  parts: Record<Category, number>;
  skills: ReturnType<typeof scoreOf>;
  challenges: ChallengeScore[];
  workloadCredits: number; budget: number;
  hintsUsed: number;
}

/** Share of attempt points for one challenge: full for up to FREE_RUNS runs, then less per extra run. */
export const runFactor = (runs: number) => (runs === 0 ? 0 : Math.max(ATTEMPT_FLOOR, 1 - ATTEMPT_STEP * Math.max(0, runs - FREE_RUNS)));

const round1 = (n: number) => Math.round(n * 10) / 10;

export function finalScore(m: Mission, progress: Record<string, ChallengeProgress>, marks: Mark[]): FinalScore {
  const challenges: ChallengeScore[] = assignedDesks(m).map((d) => {
    const attempts = progress[d.id]?.attempts ?? [];
    const latest = attempts.slice(-1)[0];
    const cases = latest ? evaluateDesk(d.id, latest.script, m.level, m.workloadModel, !!latest.blockQuality) : [];
    const passed = cases.filter(handled).length;
    const tests = cases.length ? passed / cases.length : 0;
    return { id: d.id, title: d.title, runs: attempts.length, passed, tested: cases.length, tests, attempts: runFactor(attempts.length) * tests };
  });
  const n = Math.max(1, challenges.length);
  const testShare = challenges.reduce((s, c) => s + c.tests, 0) / n;
  const budget = assessmentBudget(m);
  const workloadCredits = roundCredits(serviceWorkloads(m, progress).reduce((s, w) => s + w.credits, 0));
  // Cheap only counts when the builds work: an empty helper is cheap but useless.
  const withinBudget = workloadCredits <= budget ? 1 : budget / Math.max(1, workloadCredits);
  const skills = scoreOf(marks);
  // Skills count unless their question was optional and left blank: skipping an optional question costs nothing.
  const optional = optionalSkills(m);
  const counted = SKILL_ORDER.filter((c) => !(optional.includes(c) && !marks.some((x) => x.criterion === c)));
  const hintsUsed = Math.min(ATTACK_HINT_LIMIT, m.attackHints?.length ?? 0);
  const categories: Record<Category, number | null> = {
    answers: counted.length ? round1(100 * counted.reduce((s, c) => s + (skills.scores[c] ?? 0), 0) / (2 * counted.length)) : null,
    tests: round1(100 * testShare),
    workload: round1(100 * withinBudget * testShare),
    attempts: round1(100 * challenges.reduce((s, c) => s + c.attempts, 0) / n),
    independence: round1(100 * (1 - hintsUsed / ATTACK_HINT_LIMIT)),
  };
  // Weighted average over the categories that count (a category that doesn't count gives its weight to the others).
  const live = CATEGORIES.filter((c) => categories[c] !== null);
  const weightSum = live.reduce((s, c) => s + WEIGHTS[c], 0);
  const parts = Object.fromEntries(CATEGORIES.map((c) => [c, categories[c] === null ? 0 : round1(categories[c]! * WEIGHTS[c] / weightSum)])) as Record<Category, number>;
  const total = Math.round(live.reduce((s, c) => s + categories[c]! * WEIGHTS[c], 0) / weightSum);
  return { total, outOf: 100, band: FINAL_BANDS.find((b) => total >= b.min)!.band, categories, parts, skills, challenges, workloadCredits, budget, hintsUsed };
}

/** The assessment's competency radar: the share of each kind of test handled, on the first and the latest build of each challenge. */
export function assessmentRadar(m: Mission, progress: Record<string, ChallengeProgress>) {
  const tally = (pick: 'first' | 'latest') => {
    const hit: Partial<Record<Dim, [number, number]>> = {};
    for (const d of assignedDesks(m)) {
      const attempts = progress[d.id]?.attempts ?? [];
      const run = pick === 'first' ? attempts[0] : attempts.slice(-1)[0];
      if (!run) continue;
      for (const c of evaluateDesk(d.id, run.script, m.level, m.workloadModel, !!run.blockQuality)) {
        const dim = c.result.category as Dim;
        const [h, t] = hit[dim] ?? [0, 0];
        hit[dim] = [h + (handled(c) ? 1 : 0), t + 1];
      }
    }
    return Object.fromEntries(DIMS.map((dim) => [dim, hit[dim] ? Math.round(100 * hit[dim]![0] / hit[dim]![1]) : null])) as Record<Dim, number | null>;
  };
  return { first: tally('first'), now: tally('latest') };
}

/** What is saved on the mission once the final score is worked out. */
export interface FinalResult {
  score: FinalScore;
  verdict: string;
  summary: string;
  /** true when the AI wrote the verdict and every mark came from the AI marker */
  ai: boolean;
  /** which marker marked each skill */
  markers: { criterion: Mark['criterion']; marker: string; level: Mark['level'] }[];
  at: string;
}

/** Plain names for the categories, used in verdicts and the result card. */
export const CATEGORY_NAME: Record<Category, string> = {
  answers: 'your written answers', tests: 'how well your builds handled the tests', workload: 'keeping the workload within budget',
  attempts: 'getting builds working in few runs', independence: 'working without AI hints',
};

/** A plain verdict without AI, used when the AI is not connected or its reply fails the checks. */
export function offlineVerdict(f: FinalScore): string {
  const ranked = CATEGORIES.filter((c) => f.categories[c] !== null).sort((a, b) => f.categories[b]! - f.categories[a]!);
  return `Final score: ${f.total} out of 100 (${f.band}). Your strongest part was ${CATEGORY_NAME[ranked[0]]} (${f.categories[ranked[0]]} of 100); the part with most room to grow is ${CATEGORY_NAME[ranked[ranked.length - 1]]} (${f.categories[ranked[ranked.length - 1]]} of 100).`;
}

/** Numbers stated as the final score in a verdict ("72 out of 100", "72/100"), for checking an AI verdict. */
export const claimedFinal = (text: string) => [...text.matchAll(/(?<![\d.])(\d{1,3}(?:\.\d)?)\s*(?:out of|\/)\s*100\b/gi)].map((x) => Number(x[1]));

/** True when a verdict states the final score, and every other "N out of 100" is one of the category scores. */
export const verdictMatches = (text: string, f: FinalScore) => {
  const stated = claimedFinal(text);
  return stated.includes(f.total) && stated.every((n) => n === f.total || Object.values(f.categories).includes(n));
};
