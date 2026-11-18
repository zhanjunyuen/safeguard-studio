import { themeOf } from '../data/themes';
import type { BlockType } from '../types';
import type { Desk, Mission } from './mission';

export const ATTACK_HINT_LIMIT = 3;

export interface AttackHint {
  desk: Desk;
  text: string;
}

export interface AttackHintContext {
  desk: Desk;
  blocks: BlockType[];
  previousHints: string[];
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

export const offlineAttackHint: AttackHintProvider = async ({ desk, blocks, previousHints }) => {
  if (!previousHints.length) return openingHints[desk] ?? themeOf(desk)?.learn ?? 'Which request would best test the safeguards in your build?';
  if (previousHints.length === 1) {
    const beforeAI = blocks.indexOf('ask_ai');
    return beforeAI > 0
      ? 'Follow the request through the blocks before Ask AI. What information could still reach the helper?'
      : 'Look at what reaches Ask AI first. Which decisions could already have consequences before a later check runs?';
  }
  return 'Compare an ordinary request with one that needs extra care. What would you expect a useful helper to do differently?';
};

export function hintAvailable(m: Mission, desk: Desk) {
  return m.phase === 'attack' && !!m.first && m.focus === desk
    && !m.launches?.some(round => round.desk === desk)
    && (m.attackHints?.length ?? 0) < ATTACK_HINT_LIMIT;
}
