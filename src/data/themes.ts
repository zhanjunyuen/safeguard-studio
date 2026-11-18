import type { Competency } from '../types';
import { CHALLENGES } from './challenges';

export interface Theme {
  id: string;
  title: string;
  learn: string;
  competency: Competency;
}

/** Challenges are grouped into themes; each theme focuses on one part of using AI well. */
export const THEMES: Theme[] = [
  { id: 'truth', title: 'Is it true?', competency: 'verification', learn: 'AI sounds just as confident when it is wrong. Check facts, sources and photos before you trust them.' },
  { id: 'privacy', title: 'Whose info is it?', competency: 'privacy', learn: "Protect other people's details, not just your own, and only share what is needed." },
  { id: 'integrity', title: 'Is it your work?', competency: 'integrity', learn: 'Use AI to help you learn, not to do the learning for you, and be honest about what it made.' },
  { id: 'fairness', title: 'Is it fair?', competency: 'bias', learn: 'AI can repeat stereotypes and tell people what they want to hear. Make sure everyone gets a fair deal.' },
  { id: 'judgement', title: 'Should I even use AI for this?', competency: 'judgement', learn: 'Some questions need a real person, not a chatbot. Know when to step back.' },
  { id: 'manipulation', title: "Who's trying to trick you?", competency: 'manipulation', learn: 'Scams, hidden adverts and people trying to trick the AI itself. Learn to spot them.' },
];

export const challengesIn = (themeId: string) => CHALLENGES.filter((c) => c.themeId === themeId);
export const themeOf = (challengeId: string) => THEMES.find((t) => t.id === CHALLENGES.find((c) => c.id === challengeId)?.themeId);
