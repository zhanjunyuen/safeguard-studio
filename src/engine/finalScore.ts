import type { ChallengeProgress } from '../store/session';
import { assessmentBudget, evaluateDesk, serviceWorkloads } from './challengeEvidence';
import { scoreOf, type Mark } from './marking';
import { assignedDesks, handled, type Mission } from './mission';
import { DIMS, type Dim } from './profile';

/**
 * The final assessment score out of 100, from fixed, published weights. Like levelFor, these are
 * rules, not model judgements: the AI explains the score but never sets it.
 *
 *   Written answers  50  the four skills marked from the pupil's answers (0–2 each, out of 8)
 *   Blocks           35  25 for how many tests the latest builds handle safely and usefully,
 *                        10 for keeping the projected workload within the budget
 *   Attempts         15  reaching a working build in few runs (1–2 runs is full marks)
 */
export const WEIGHTS = { answers: 50, tests: 25, workload: 10, attempts: 15 } as const;

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
  parts: { answers: number; tests: number; workload: number; attempts: number };
  skills: ReturnType<typeof scoreOf>;
  challenges: ChallengeScore[];
  workloadCredits: number; budget: number;
}

/** Points for one challenge's attempts: full for up to FREE_RUNS runs, then less per extra run. */
export const runFactor = (runs: number) => (runs === 0 ? 0 : Math.max(ATTEMPT_FLOOR, 1 - ATTEMPT_STEP * Math.max(0, runs - FREE_RUNS)));

const round1 = (n: number) => Math.round(n * 10) / 10;

export function finalScore(m: Mission, progress: Record<string, ChallengeProgress>, marks: Mark[]): FinalScore {
  const challenges: ChallengeScore[] = assignedDesks(m).map((d) => {
    const attempts = progress[d.id]?.attempts ?? [];
    const latest = attempts.slice(-1)[0];
    const cases = latest ? evaluateDesk(d.id, latest.script, m.level) : [];
    const passed = cases.filter(handled).length;
    const tests = cases.length ? passed / cases.length : 0;
    return { id: d.id, title: d.title, runs: attempts.length, passed, tested: cases.length, tests, attempts: runFactor(attempts.length) * tests };
  });
  const n = Math.max(1, challenges.length);
  const testShare = challenges.reduce((s, c) => s + c.tests, 0) / n;
  const budget = assessmentBudget(m);
  const workloadCredits = serviceWorkloads(m, progress).reduce((s, w) => s + w.credits, 0);
  // Cheap only counts when the builds work: an empty helper is cheap but useless.
  const withinBudget = workloadCredits <= budget ? 1 : budget / Math.max(1, workloadCredits);
  const skills = scoreOf(marks);
  const parts = {
    answers: round1(WEIGHTS.answers * skills.total / skills.outOf),
    tests: round1(WEIGHTS.tests * testShare),
    workload: round1(WEIGHTS.workload * withinBudget * testShare),
    attempts: round1(WEIGHTS.attempts * challenges.reduce((s, c) => s + c.attempts, 0) / n),
  };
  const total = Math.round(parts.answers + parts.tests + parts.workload + parts.attempts);
  return { total, outOf: 100, band: FINAL_BANDS.find((b) => total >= b.min)!.band, parts, skills, challenges, workloadCredits, budget };
}

/** The assessment's competency radar: the share of each kind of test handled, on the first and the latest build of each challenge. */
export function assessmentRadar(m: Mission, progress: Record<string, ChallengeProgress>) {
  const tally = (pick: 'first' | 'latest') => {
    const hit: Partial<Record<Dim, [number, number]>> = {};
    for (const d of assignedDesks(m)) {
      const attempts = progress[d.id]?.attempts ?? [];
      const run = pick === 'first' ? attempts[0] : attempts.slice(-1)[0];
      if (!run) continue;
      for (const c of evaluateDesk(d.id, run.script, m.level)) {
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

/** A plain verdict without AI, used when the AI is not connected or its reply fails the checks. */
export function offlineVerdict(f: FinalScore): string {
  const strongest = (Object.keys(f.parts) as (keyof FinalScore['parts'])[])
    .map((k) => [k, f.parts[k] / (k === 'answers' ? WEIGHTS.answers : WEIGHTS[k])] as const).sort((a, b) => b[1] - a[1]);
  const name = { answers: 'your written answers', tests: 'how well your builds handled the tests', workload: 'keeping the workload within budget', attempts: 'getting builds working in few runs' };
  return `Final score: ${f.total} out of 100 (${f.band}). Your strongest part was ${name[strongest[0][0]]}; the part with most room to grow is ${name[strongest[strongest.length - 1][0]]}.`;
}

/** Numbers stated as the final score in a verdict ("72 out of 100", "72/100"), for checking an AI verdict. */
export const claimedFinal = (text: string) => [...text.matchAll(/(\d{1,3})\s*(?:out of|\/)\s*100/gi)].map((x) => Number(x[1]));
