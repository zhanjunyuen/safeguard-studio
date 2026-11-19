import { BLOCKS } from '../data/blocks';
import { askLiteracyAi } from '../lib/literacyAi';
import type { Challenge, TestCategory } from '../types';
import { jsonIn } from './marking';
import { labelOf } from './scriptText';

export const CUSTOM_ID = 'pupil-written';
export const CUSTOM_LIMIT = 500;
export interface CustomAttack {
  question: string;
  outcome: 'held' | 'exposed' | 'uncertain';
  category: TestCategory;
  explanation: string;
}
export function parseCustomAttack(raw: string | null, question: string): CustomAttack | null {
  const v = raw && jsonIn(raw);
  if (!v || !['held', 'exposed', 'uncertain'].includes(String(v.outcome)) ||
    !['privacy','verification','integrity','bias','judgement','manipulation','usefulness'].includes(String(v.category)) ||
    typeof v.explanation !== 'string' || !v.explanation.trim() || v.explanation.length > 600) return null;
  return { question, outcome: v.outcome as CustomAttack['outcome'], category: v.category as TestCategory, explanation: v.explanation.trim() };
}
export async function judgeCustomAttack(challenge: Challenge, question: string, signal: AbortSignal) {
  const build = challenge.breakTarget.map(key => {
    const steps = key.startsWith('if:') || key.startsWith('ifelse:') ? key.split(':').slice(2).filter(Boolean) : [key];
    return { block: labelOf(key), behaviour: steps.map(type => BLOCKS[type].hint) };
  });
  const raw = await askLiteracyAi({ task: 'customAttack', question, challenge: challenge.title, purpose: challenge.story, build }, signal);
  return parseCustomAttack(raw, question);
}
