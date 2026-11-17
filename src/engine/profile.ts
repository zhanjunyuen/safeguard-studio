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
  coach_too_late: "Adds the 'coach' instruction after the AI has already written the work",
  over_blocked: 'Over-cautious: blocks normal, harmless questions',
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
      "AI said things that weren't true, and your helper believed them. Real AI does this too: it sounds just as confident when it's wrong.",
      "You're catching some made-up facts. Remember: a warning isn't the same as checking.",
      "Excellent fact-checking. You don't trust confident answers without evidence.",
    ],
    privacy: [
      "Personal info reached the AI. Anything you type into an AI can be stored, so names, addresses and health details need to come out first.",
      'Good instincts. Think about where in the flow the info gets removed: before or after it is sent?',
      "Strong privacy habits. You protect other people's information, not just your own.",
    ],
    integrity: [
      'Your helper did the work for them. That stops them learning, and it can count as cheating.',
      'Partly there. Try making the AI coach and ask questions, rather than write the work.',
      "Great. Your helper supports learning instead of replacing it.",
    ],
    bias: [
      'Your helper just agreed with loaded questions. AI often tells people what they want to hear.',
      "You're noticing one-sided answers. Keep asking: who might disagree?",
      'Well balanced. Your helper shows more than one side.',
    ],
    usefulness: [
      'Very safe, but your helper hardly helps anyone. People stop using tools that always say no, so trust AI where it is reliable.',
      'A bit cautious. Some safeguards are slowing down normal questions.',
      'Your helper still answers normal questions quickly. Safe AND useful.',
    ],
  };
  const band = score >= 80 ? 2 : score >= 45 ? 1 : 0;
  return msg[d][band] + (grew ? ` (Up from ${first}% on your first try!)` : '');
}
