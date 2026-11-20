import { launch, weakSpots } from '../engine/breaker';
import { runChallenge } from '../engine/run';
import type { Attempt, BreakAttempt, ChallengeProgress, Reflection } from '../store/session';
import type { BlockType, FailureKey } from '../types';
import { BLOCKS } from './blocks';
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
  quiz: {
    ai: ['ask_ai'], privacy: ['private_marks'], verify: ['check_textbook'], integrity: ['practice_not_answers'], bias: ['mix_examples'],
    weak: ['ask_confidence'], flag: [], trap1: ['refuse_tests'], trap2: [],
  },
  chat: {
    ai: ['ask_ai'], privacy: ['hide_location'], verify: ['check_school_site'], integrity: ['own_words'], bias: ['no_ganging_up'],
    weak: ['forward_check'], flag: ['flag_teacher'], trap1: ['block_people'], trap2: [],
  },
  options: {
    ai: ['ask_ai'], privacy: ['needs_no_names'], verify: ['check_booklet'], integrity: ['plan_not_write'], bias: ['challenge_stereotypes'],
    weak: ['teacher_confirm'], flag: [], trap1: ['teacher_approves_all'], trap2: [],
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

/** For challenges without a hand-tuned mapping: take the roles from the challenge's ideal helper and palette. */
function deriveRoles(challengeId: string): Record<Role, BlockType[]> {
  const ch = getChallenge(challengeId)!;
  const fixes = ch.ideal.filter((t) => t !== 'ask_ai');
  const extras = ch.palette.filter((t) => !ch.ideal.includes(t));
  const traps = extras.filter((t) => BLOCKS[t].cost >= 20);
  const weak = extras.filter((t) => BLOCKS[t].cost < 20 && t !== 'flag_teacher');
  return {
    ai: ['ask_ai'],
    privacy: fixes.slice(0, 1),
    verify: fixes.slice(1, 2),
    integrity: fixes.slice(2, 3),
    bias: fixes.slice(3),
    weak: weak.slice(0, 1),
    flag: ch.palette.includes('flag_teacher') ? ['flag_teacher'] : [],
    trap1: traps.slice(0, 1),
    trap2: traps.slice(1, 2),
  };
}

export function simulateStudent(st: SeedStudent, challengeId: string, idx: number): ChallengeProgress {
  const ch = getChallenge(challengeId)!;
  const map = ROLE_BLOCKS[challengeId] ?? deriveRoles(challengeId);
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
      blockQuality: rep.blockQuality,
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

/** How many weak spots each seeded student spots on their first Break attempt (same order as SEED_STUDENTS). */
const BREAK_SKILL = [2, 1, 0, 1, 3, 0, 2, 3, 0, 1, 2, 1];

/** Deterministic Break-mode attempts for a seeded student, scored by the real engine. */
export function simulateBreak(idx: number, challengeId: string): BreakAttempt[] {
  const c = getChallenge(challengeId)!;
  const weak = weakSpots(c);
  const held = c.tests.map((t) => t.id).filter((id) => !weak.includes(id));
  const skill = BREAK_SKILL[idx % BREAK_SKILL.length];
  const out: BreakAttempt[] = [];
  let found: string[] = [];
  let guess = 0;
  for (let n = 0; n < 3 && found.length < weak.length; n++) {
    const right = weak.filter((w) => !found.includes(w)).slice(0, Math.max(1, n === 0 ? skill : 1));
    const plan = [...right];
    while (plan.length < 3 && held.length) plan.push(held[(idx + guess++) % held.length]);
    const uniq = [...new Set(plan)];
    const rep = launch(c, uniq);
    found = [...new Set([...found, ...rep.broke])];
    out.push({ at: Date.now() - 86_400_000 - n * 60_000, attacks: uniq, broke: rep.broke });
    if (skill === 0 && n === 1) break;
  }
  return out;
}
