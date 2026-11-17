import { runChallenge } from '../engine/run';
import type { Attempt, ChallengeProgress, Reflection } from '../store/session';
import type { BlockType, FailureKey } from '../types';
import { getChallenge } from './challenges';

/**
 * A fake class for the teacher view. Each student is a sequence of scripts
 * (their attempts) plus whether each reflection was right. We run the real
 * engine over them, so the dashboard numbers are genuine, not hand-typed.
 */
interface SeedStudent {
  name: string;
  attempts: BlockType[][];
  reflections: boolean[];
}

const S = (...t: BlockType[]) => t;

export const SEED_STUDENTS: SeedStudent[] = [
  { name: 'Amara O.', attempts: [S('remove_pii', 'ask_ai', 'check_source'), S('remove_pii', 'coach', 'ask_ai', 'check_source', 'both_sides')], reflections: [true] },
  { name: 'Ben T.', attempts: [S('ask_ai'), S('ask_ai', 'warn_note'), S('ask_ai', 'check_source', 'warn_note'), S('remove_pii', 'ask_ai', 'check_source')], reflections: [false, true, true] },
  { name: 'Chloe W.', attempts: [S('ask_grownup', 'ask_ai'), S('block_people', 'ask_ai', 'check_source'), S('remove_pii', 'ask_ai', 'check_source', 'both_sides')], reflections: [true, true] },
  { name: 'Dev P.', attempts: [S('ask_ai', 'remove_pii', 'check_source'), S('ask_ai', 'remove_pii', 'check_source', 'coach'), S('remove_pii', 'coach', 'ask_ai', 'check_source')], reflections: [false, true] },
  { name: 'Ella M.', attempts: [S('remove_pii', 'coach', 'both_sides', 'ask_ai', 'check_source')], reflections: [] },
  { name: 'Finn R.', attempts: [S('ask_ai', 'flag_teacher'), S('ask_ai', 'flag_teacher', 'warn_note')], reflections: [false] },
  { name: 'Grace L.', attempts: [S('check_source', 'ask_ai'), S('ask_ai', 'check_source'), S('remove_pii', 'ask_ai', 'check_source', 'both_sides')], reflections: [true, true] },
  { name: 'Hamza A.', attempts: [S('ask_ai'), S('remove_pii', 'ask_ai'), S('remove_pii', 'ask_ai', 'check_source'), S('remove_pii', 'coach', 'ask_ai', 'check_source'), S('remove_pii', 'coach', 'ask_ai', 'check_source', 'both_sides')], reflections: [true, true, true, true] },
  { name: 'Isla K.', attempts: [S('block_people', 'ask_grownup', 'ask_ai'), S('block_people', 'ask_grownup', 'ask_ai', 'check_source')], reflections: [false] },
  { name: 'Jacob S.', attempts: [S('ask_ai', 'check_source', 'both_sides'), S('coach', 'ask_ai', 'check_source', 'both_sides', 'remove_pii')], reflections: [true] },
  { name: 'Keira N.', attempts: [S('remove_pii', 'ask_ai', 'warn_note'), S('remove_pii', 'ask_ai', 'check_source', 'warn_note')], reflections: [true] },
  { name: 'Leo D.', attempts: [S('ask_ai'), S('ask_ai', 'coach'), S('coach', 'ask_ai'), S('coach', 'ask_ai', 'check_source')], reflections: [false, false, true] },
];

const DAY = 86_400_000;

export function simulateStudent(st: SeedStudent, challengeId: string, idx: number): ChallengeProgress {
  const ch = getChallenge(challengeId)!;
  const t0 = Date.now() - DAY * 2 - idx * 3_600_000;
  const attempts: Attempt[] = [];
  const reflections: Reflection[] = [];
  const alt: FailureKey[] = ['one_sided', 'pii_sent', 'essay_written', 'hallucination_unchecked'];
  st.attempts.forEach((types, i) => {
    const script = types.map((type, j) => ({ uid: `${type}-${j}`, type }));
    const rep = runChallenge(script, ch);
    attempts.push({
      at: t0 + i * 240_000,
      script: types,
      results: rep.results.map(({ testId, outcome, failureKey }) => ({ testId, outcome, failureKey })),
      scores: rep.scores,
    });
    const fail = rep.results.find((r) => r.outcome !== 'pass' && r.failureKey);
    if (fail && i < st.attempts.length - 1 && st.reflections[i] !== undefined) {
      const correct = st.reflections[i];
      const chosen = correct ? fail.failureKey! : alt.find((k) => k !== fail.failureKey)!;
      reflections.push({ attempt: i + 1, testId: fail.testId, expected: fail.failureKey!, chosen, correct, text: '' });
    }
  });
  return { script: [], attempts, reflections, events: [], pendingReflection: null, seen: [] };
}
