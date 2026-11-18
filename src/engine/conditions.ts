import type { CondId, HiddenTest } from '../types';

/** IF-block conditions. Like a real filter, they only see the words in the message. */
export const CONDITIONS: Record<CondId, { label: string; hint: string }> = {
  person: { label: 'it mentions a person', hint: 'True when the message names someone.' },
  numbers: { label: 'it contains numbers', hint: 'True for long numbers (phone, card, door numbers in an address).' },
  contact: { label: 'it has a link or email', hint: 'True when the message has a web link or an email address.' },
  health: { label: "it's about health or feelings", hint: 'True when the message mentions illness, injuries or feelings.' },
  finished: { label: 'it asks for finished work', hint: 'True when someone asks the AI to write or make the whole thing.' },
  opinion: { label: "it's an opinion question", hint: 'True when the message asks what to think, or pushes a view.' },
  urgent: { label: 'it sounds urgent or pushy', hint: 'True when the message says hurry, now, or gives a deadline.' },
  ai_unsure: { label: "the AI isn't sure", hint: 'True when the AI says it is not confident about its answer.' },
};

export const COND_ORDER: CondId[] = ['person', 'numbers', 'contact', 'health', 'finished', 'opinion', 'urgent', 'ai_unsure'];

const HEALTH = /(allerg|asthma|epipen|\bill\b|hurt|injur|breath|burn|swell|panic|\blow\b|\bsad\b|upset|anxious|lonely|worried|dyslexia|sleep|nervous)/i;
const URGENT = /(urgent|hurry|\bnow\b|quick|minutes|hours|today|asap|immediately|ends in)/i;
const NUMBERS = /\d{3,}|\b\d+\s+[A-Z][a-z]+\s+(Road|Lane|Street|Close|Way|Avenue)\b/;

/** Which conditions a message triggers. Edge-case tests override this with `cues`. */
export function cuesOf(t: HiddenTest): Set<CondId> {
  if (t.cues) return new Set(t.cues);
  const q = t.question;
  const c = new Set<CondId>();
  if (t.flags.mentionsPerson) c.add('person');
  if (NUMBERS.test(q)) c.add('numbers');
  if (/@|https?:|www\.|bit\.ly/i.test(q)) c.add('contact');
  if (HEALTH.test(q) || t.flags.topics?.some((x) => x === 'medical' || x === 'feelings')) c.add('health');
  if (t.flags.essayRequest) c.add('finished');
  if (t.flags.oneSided || t.flags.topics?.includes('opinions')) c.add('opinion');
  if (URGENT.test(q)) c.add('urgent');
  // 'ai_unsure' is never true: the scripted AI always sounds confident, even when it is wrong.
  return c;
}
