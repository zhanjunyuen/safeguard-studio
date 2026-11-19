import { themeOf } from '../data/themes';
import type { BlockType } from '../types';
import type { Desk, Mission } from './mission';

export const ATTACK_HINT_LIMIT = 3;

export interface AttackHint {
  desk: Desk;
  text: string;
  /** when the hint was asked for (older attempts: attack) */
  stage?: HintStage;
}

/** Hints can be asked for while building a helper or while planning attacks on it. */
export type HintStage = 'build' | 'attack';

export interface AttackHintContext {
  desk: Desk;
  blocks: BlockType[];
  previousHints: string[];
  /** e.g. "party@2" at Level 2; lets the AI companion see the right challenge */
  challengeId?: string;
  stage?: HintStage;
  /** the latest test run of this build, in plain words (what the pupil has already seen) */
  latestResults?: { test: string; outcome: string }[];
  /** attacks the pupil has picked so far (attack stage) */
  plannedAttacks?: string[];
}

export type AttackHintProvider = (context: AttackHintContext, signal: AbortSignal) => Promise<string>;

const openingHints: Record<Desk, string> = {
  history: 'A history answer can sound convincing even when a detail is wrong. What evidence would you look for in the replay?',
  party: 'Think about what the organiser needs to know and which details about a pupil can stay private.',
  news: 'Imagine your editor asks where a claim came from. What would count as good evidence before printing it?',
  quiz: 'What is the difference between helping someone practise and doing the assessed work for them?',
  chat: 'A message repeated by several classmates can still be a rumour. What would make it worth passing on?',
  options: 'Consider two pupils with the same interests. What would make the advice they receive fair?',
};

/** Offline hints while building: about who the helper serves and where blocks sit. */
const buildHints = [
  'Who will use this helper, and what could go wrong for them if the AI gets something wrong?',
  'Follow one request through your blocks. Does each check happen before or after Ask AI, and does that matter?',
  'Would your helper still answer an ordinary, harmless question well? Blocking too much costs usefulness.',
];

export const offlineAttackHint: AttackHintProvider = async ({ desk, blocks, previousHints, stage }) => {
  if (stage === 'build') return buildHints[Math.min(previousHints.length, buildHints.length - 1)];
  if (!previousHints.length) return openingHints[desk] ?? themeOf(desk)?.learn ?? 'Which request would best test the safeguards in your build?';
  if (previousHints.length === 1) {
    const beforeAI = blocks.indexOf('ask_ai');
    return beforeAI > 0
      ? 'Follow the request through the blocks before Ask AI. What information could still reach the helper?'
      : 'Look at what reaches Ask AI first. Which decisions could already have consequences before a later check runs?';
  }
  return 'Compare an ordinary request with one that needs extra care. What would you expect a useful helper to do differently?';
};

/** The stage a hint would be for right now, or null when hints can't be asked for. */
export function hintStage(m: Mission, desk: Desk): HintStage | null {
  if (m.focus !== desk || (m.attackHints?.length ?? 0) >= ATTACK_HINT_LIMIT) return null;
  if (m.phase === 'attack') return m.first && !m.launches?.some(round => round.desk === desk) ? 'attack' : null;
  // While building or revising in the six-challenge assessment.
  if ((m.phase === 'build' || m.phase === 'revise') && m.form === 4) return 'build';
  return null;
}

export function hintAvailable(m: Mission, desk: Desk) {
  return hintStage(m, desk) !== null;
}

let hintProvider: AttackHintProvider = offlineAttackHint;
/** Connect a server-backed hint companion. Pass nothing to go back to the offline hints. */
export function setAttackHintProvider(p?: AttackHintProvider) {
  hintProvider = p ?? offlineAttackHint;
}
export const getAttackHintProvider = () => hintProvider;
