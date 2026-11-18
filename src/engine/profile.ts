import { BLOCKS, COMPETENCY_META, FAILURE_TEXT } from '../data/blocks';
import { getChallenge } from '../data/challenges';
import type { ChallengeProgress } from '../store/session';
import type { BlockType, Competency, FailureKey, Scores } from '../types';

export type Dim = Competency | 'usefulness';
export const DIMS: Dim[] = ['verification', 'privacy', 'integrity', 'bias', 'usefulness'];

export interface TimelineItem {
  attempt: number;
  added: string[];
  removed: string[];
  reordered: boolean;
  passed: number;
  total: number;
  failed: string[];
  newlyFixed: string[];
  reflection?: { correct: boolean; chosen: string; expected: string; text: string };
}

export interface ChallengeProfile {
  challengeId: string;
  attempts: number;
  anticipated: Scores | null;
  current: Scores | null;
  reflectionAccuracy: number | null;
  misconceptions: string[];
  fixedFirst: string | null;
  neverNoticed: Dim[];
  timeline: TimelineItem[];
}

const MISCONCEPTION: Partial<Record<FailureKey, string>> = {
  pii_too_late: 'Removes personal info after it has already reached the AI',
  check_too_early: 'Checks sources before the AI has answered',
  coach_too_late: 'Gives the AI instructions after it has already written the work',
  over_blocked: 'Over-cautious: blocks normal, harmless questions',
  second_ai_agreed: 'Trusts other people or another AI agreeing as a fact-check',
  hedged_only: 'Treats the AI saying it is confident as a fact-check',
  wrong_check: "Uses a check that doesn't cover the kind of claim (quotes vs statistics)",
  disclosed_only: 'Thinks labelling AI-written work makes it fine to hand in',
};

export function profileChallenge(challengeId: string, p: ChallengeProgress): ChallengeProfile {
  const ch = getChallenge(challengeId)!;
  const title = (id: string) => ch.tests.find((t) => t.id === id)?.title ?? id;
  const catOf = (id: string) => ch.tests.find((t) => t.id === id)!.category;
  const a = p.attempts;

  const misc = new Set<string>();
  for (const at of a) for (const r of at.results) if (r.failureKey && MISCONCEPTION[r.failureKey]) misc.add(MISCONCEPTION[r.failureKey]!);
  // leaned on warnings rather than verification
  if (a.length && a[a.length - 1].results.some((r) => r.outcome === 'partial' && r.failureKey === 'hallucination_unchecked'))
    misc.add('Relies on "AI can be wrong" warnings instead of checking facts');

  let fixedFirst: string | null = null;
  const timeline: TimelineItem[] = a.map((at, i) => {
    const prev = i > 0 ? a[i - 1] : null;
    const prevTypes: BlockType[] = prev ? prev.script : ['ask_ai'];
    const added = at.script.filter((t) => !prevTypes.includes(t)).map((t) => BLOCKS[t].label);
    const removed = prevTypes.filter((t) => !at.script.includes(t)).map((t) => BLOCKS[t].label);
    const common = at.script.filter((t) => prevTypes.includes(t));
    const prevCommon = prevTypes.filter((t) => at.script.includes(t));
    const reordered = common.join() !== prevCommon.join();
    const newlyFixed = prev
      ? at.results.filter((r) => r.outcome === 'pass' && prev.results.find((x) => x.testId === r.testId)?.outcome !== 'pass').map((r) => title(r.testId))
      : [];
    if (!fixedFirst && newlyFixed.length) {
      const id = at.results.find((r) => title(r.testId) === newlyFixed[0])!.testId;
      fixedFirst = `${newlyFixed[0]} (${COMPETENCY_META[catOf(id)].label})`;
    }
    const refl = p.reflections.find((r) => r.attempt === i + 1);
    return {
      attempt: i + 1,
      added,
      removed,
      reordered,
      passed: at.results.filter((r) => r.outcome === 'pass').length,
      total: at.results.length,
      failed: at.results.filter((r) => r.outcome !== 'pass').map((r) => title(r.testId)),
      newlyFixed,
      reflection: refl && {
        correct: refl.correct,
        chosen: FAILURE_TEXT[refl.chosen],
        expected: FAILURE_TEXT[refl.expected],
        text: refl.text,
      },
    };
  });

  const neverNoticed: Dim[] = [];
  if (a.length) {
    for (const d of DIMS) {
      const tests = ch.tests.filter((t) => t.category === d);
      if (!tests.length) continue;
      const everPassed = a.some((at) => at.results.some((r) => catOf(r.testId) === d && r.outcome === 'pass'));
      if (!everPassed) neverNoticed.push(d);
    }
  }

  const refl = p.reflections;
  return {
    challengeId,
    attempts: a.length,
    anticipated: a[0]?.scores ?? null,
    current: a[a.length - 1]?.scores ?? null,
    reflectionAccuracy: refl.length ? Math.round((refl.filter((r) => r.correct).length / refl.length) * 100) : null,
    misconceptions: [...misc],
    fixedFirst,
    neverNoticed,
    timeline,
  };
}

/** Average a set of scores, ignoring nulls. */
export function averageScores(list: (Scores | null)[]): Record<Dim, number | null> {
  const out = {} as Record<Dim, number | null>;
  for (const d of DIMS) {
    const vals = list.map((s) => (s ? s[d] : null)).filter((v): v is number => v !== null);
    out[d] = vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : null;
  }
  return out;
}

export function feedbackFor(d: Dim, score: number | null, first: number | null): string {
  if (score === null) return 'Not tested yet. Try another challenge.';
  const grew = first !== null && score > first;
  const msg: Record<Dim, [string, string, string]> = {
    verification: [
      'Your helper passed on things that were not true. AI sounds just as sure when it is wrong, so answers need checking against a real source.',
      'Some made-up claims got caught. A warning note or a second AI is not the same as checking a real source.',
      'Made-up claims were caught and corrected before anyone saw them.',
    ],
    privacy: [
      "Someone's personal details reached the AI. Anything typed into a chatbot can be stored, so take names, addresses and health details out first.",
      'Partly there. Check where in the order the details get removed: before the AI sees them, or after?',
      "Other people's details were kept away from the AI.",
    ],
    integrity: [
      'Your helper did the work for them. They learn nothing, and it can count as cheating.',
      'Partly there. Get the AI to help them plan or give feedback, rather than produce the work.',
      'Your helper supported their work instead of replacing it.',
    ],
    bias: [
      'Your helper agreed with loaded questions. Chatbots often tell people what they want to hear.',
      'Some one-sided answers were caught. Ask yourself who would disagree.',
      'Opinion questions got more than one point of view.',
    ],
    usefulness: [
      'Very safe, but it hardly helps anyone. A tool that refuses normal questions just gets ignored.',
      'A bit cautious. Some of your blocks get in the way of normal questions.',
      'Normal questions still get quick, useful answers.',
    ],
  };
  const band = score >= 80 ? 2 : score >= 45 ? 1 : 0;
  return msg[d][band] + (grew ? ` Up from ${first} on your first run.` : '');
}

export type OverallProfile = ChallengeProfile & { done: string[]; parts: ChallengeProfile[] };

const toScores = (r: Record<Dim, number | null>): Scores => ({
  verification: r.verification,
  privacy: r.privacy,
  integrity: r.integrity,
  bias: r.bias,
  usefulness: r.usefulness ?? 0,
});

/** One student's profile combined across every challenge they've attempted (same maths as My results). */
export function overallProfile(progress: Record<string, ChallengeProgress | undefined>): OverallProfile {
  const parts = Object.entries(progress)
    .filter(([cid, p]) => p && p.attempts.length && getChallenge(cid))
    .map(([cid, p]) => profileChallenge(cid, p!));
  const reflections = Object.values(progress).flatMap((p) => p?.reflections ?? []);
  return {
    challengeId: 'all',
    attempts: parts.reduce((n, p) => n + p.attempts, 0),
    anticipated: parts.length ? toScores(averageScores(parts.map((p) => p.anticipated))) : null,
    current: parts.length ? toScores(averageScores(parts.map((p) => p.current))) : null,
    reflectionAccuracy: reflections.length ? Math.round((reflections.filter((r) => r.correct).length / reflections.length) * 100) : null,
    misconceptions: [...new Set(parts.flatMap((p) => p.misconceptions))],
    fixedFirst: null,
    neverNoticed: [],
    timeline: [],
    done: parts.map((p) => p.challengeId),
    parts,
  };
}
