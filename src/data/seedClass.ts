import { runChallenge } from '../engine/run';
import type { Attempt, ChallengeProgress, Reflection } from '../store/session';
import type { BlockType, FailureKey } from '../types';
import { getChallenge } from './challenges';

/**
 * A fake class for the teacher view. Each student is a sequence of attempts
 * written as roles ("privacy block", "fact check", ...). Each challenge maps
 * those roles onto its own blocks, then the real engine scores them, so the
 * dashboard numbers are computed rather than typed in.
 */
type Role = 'ai' | 'privacy' | 'verify' | 'integrity' | 'bias' | 'weak' | 'flag' | 'trap1' | 'trap2';

const ROLE_BLOCKS: Record<string, Record<Role, BlockType[]>> = {
  history: {
    ai: ['ask_ai'], privacy: ['remove_pii'], verify: ['check_source'], integrity: ['coach'], bias: ['both_sides'],
    weak: ['warn_note'], flag: [], trap1: ['ask_grownup'], trap2: ['block_people'],
  },
  party: {
    ai: ['ask_ai'], privacy: ['ask_permission'], verify: ['check_label'], integrity: ['no_impersonation'], bias: ['dont_just_agree'],
    weak: ['second_ai'], flag: ['flag_teacher'], trap1: ['refuse_food'], trap2: [],
  },
  news: {
    ai: ['ask_ai'], privacy: ['official_contacts'], verify: ['ask_the_source', 'check_stats'], integrity: ['feedback_only'], bias: ['neutral_wording'],
    weak: ['disclose_ai'], flag: [], trap1: ['block_people'], trap2: [],
  },
};

interface SeedStudent {
  name: string;
  attempts: Role[][];
  reflections: boolean[];
}

const R = (...r: Role[]) => r;

export const SEED_STUDENTS: SeedStudent[] = [
  { name: 'Amara O.', attempts: [R('privacy', 'ai', 'verify'), R('privacy', 'integrity', 'ai', 'verify', 'bias')], reflections: [true] },
  { name: 'Ben T.', attempts: [R('ai'), R('ai', 'weak'), R('ai', 'verify', 'weak'), R('privacy', 'ai', 'verify')], reflections: [false, true, true] },
  { name: 'Chloe W.', attempts: [R('trap1', 'ai'), R('trap2', 'ai', 'verify'), R('privacy', 'ai', 'verify', 'bias')], reflections: [true, true] },
  { name: 'Dev P.', attempts: [R('ai', 'privacy', 'verify'), R('ai', 'privacy', 'verify', 'integrity'), R('privacy', 'integrity', 'ai', 'verify')], reflections: [false, true] },
  { name: 'Ella M.', attempts: [R('privacy', 'integrity', 'bias', 'ai', 'verify')], reflections: [] },
  { name: 'Finn R.', attempts: [R('ai', 'flag'), R('ai', 'flag', 'weak')], reflections: [false] },
  { name: 'Grace L.', attempts: [R('verify', 'ai'), R('ai', 'verify'), R('privacy', 'ai', 'verify', 'bias')], reflections: [true, true] },
  { name: 'Hamza A.', attempts: [R('ai'), R('privacy', 'ai'), R('privacy', 'ai', 'verify'), R('privacy', 'integrity', 'ai', 'verify'), R('privacy', 'integrity', 'ai', 'verify', 'bias')], reflections: [true, true, true, true] },
  { name: 'Isla K.', attempts: [R('trap2', 'trap1', 'ai'), R('trap2', 'trap1', 'ai', 'verify')], reflections: [false] },
  { name: 'Jacob S.', attempts: [R('ai', 'verify', 'bias'), R('integrity', 'ai', 'verify', 'bias', 'privacy')], reflections: [true] },
  { name: 'Keira N.', attempts: [R('privacy', 'ai', 'weak'), R('privacy', 'ai', 'verify', 'weak')], reflections: [true] },
  { name: 'Leo D.', attempts: [R('ai'), R('ai', 'integrity'), R('integrity', 'ai'), R('integrity', 'ai', 'verify')], reflections: [false, false, true] },
];

const DAY = 86_400_000;

export function simulateStudent(st: SeedStudent, challengeId: string, idx: number): ChallengeProgress {
  const ch = getChallenge(challengeId)!;
  const map = ROLE_BLOCKS[challengeId];
  const t0 = Date.now() - DAY * 2 - idx * 3_600_000;
  const attempts: Attempt[] = [];
  const reflections: Reflection[] = [];
  const alt: FailureKey[] = ['one_sided', 'pii_sent', 'essay_written', 'hallucination_unchecked'];
  st.attempts.forEach((roles, i) => {
    const types = [...new Set(roles.flatMap((r) => map[r]))];
    if (!types.includes('ask_ai')) types.push('ask_ai');
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
