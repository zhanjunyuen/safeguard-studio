import type { BlockDef, BlockType, FailureKey } from '../types';

export const BLOCKS: Record<BlockType, BlockDef> = {
  ask_ai: {
    type: 'ask_ai',
    label: 'Ask AI',
    icon: '✨',
    color: '#9966FF',
    category: 'AI',
    cost: 0,
    hint: 'Sends the question to the AI and gets its answer. It sounds confident, but it can be wrong.',
    removable: false,
  },
  remove_pii: {
    type: 'remove_pii',
    label: 'Remove personal info',
    icon: '🛡️',
    color: '#4C97FF',
    category: 'Privacy',
    cost: 3,
    hint: 'Strips names, addresses, phone numbers and health details out of the message.',
    removable: true,
  },
  check_source: {
    type: 'check_source',
    label: 'Check against a trusted source',
    icon: '🔍',
    color: '#3DAA5C',
    category: 'Verification',
    cost: 4,
    hint: 'Compares the facts in the AI answer with a trusted source (BBC Bitesize, official sites) and fixes anything that does not match.',
    removable: true,
  },
  coach: {
    type: 'coach',
    label: "Coach, don't write it for them",
    icon: '🧑‍🏫',
    color: '#FF8C1A',
    category: 'Integrity',
    cost: 3,
    hint: 'Tells the AI to help the person think and plan, instead of doing the whole piece of work for them.',
    removable: true,
  },
  both_sides: {
    type: 'both_sides',
    label: 'Show both sides',
    icon: '⚖️',
    color: '#E5527A',
    category: 'Bias',
    cost: 3,
    hint: 'Makes sure answers to opinion questions give more than one point of view.',
    removable: true,
  },
  flag_teacher: {
    type: 'flag_teacher',
    label: 'Flag for a teacher if risky',
    icon: '🚩',
    color: '#0FA88A',
    category: 'Human',
    cost: 8,
    hint: 'If something looks risky, a teacher gets a notification. It does not fix the answer itself.',
    removable: true,
  },
  warn_note: {
    type: 'warn_note',
    label: 'Add "AI can be wrong" note',
    icon: '⚠️',
    color: '#3DAA5C',
    category: 'Verification',
    cost: 0,
    hint: 'Adds a reminder to the reply that AI can make mistakes.',
    removable: true,
  },
  ask_grownup: {
    type: 'ask_grownup',
    label: 'Send every question to a grown-up',
    icon: '👪',
    color: '#0FA88A',
    category: 'Human',
    cost: 40,
    hint: 'Never answers. Every question is passed to an adult instead.',
    removable: true,
  },
  block_people: {
    type: 'block_people',
    label: 'Refuse any question about a person',
    icon: '🚫',
    color: '#4C97FF',
    category: 'Privacy',
    cost: 20,
    hint: 'Refuses any question that mentions a person by name.',
    removable: true,
  },
};

export const PALETTE_ORDER: BlockType[] = [
  'remove_pii',
  'block_people',
  'check_source',
  'warn_note',
  'coach',
  'both_sides',
  'flag_teacher',
  'ask_grownup',
];

export const TRIGGER_COLOR = '#FFBF00';
export const REPLY_COLOR = '#5B6B8C';

export const FAILURE_TEXT: Record<FailureKey, string> = {
  hallucination_unchecked: 'The AI made up a fact and nothing checked it before the reply',
  check_too_early: 'The source check ran before the AI had answered, so there was nothing to check',
  pii_sent: "Someone's personal information was sent to the AI",
  pii_too_late: 'Personal info was removed, but only after it had already reached the AI',
  essay_written: 'The AI did the whole piece of work for them',
  coach_too_late: "The 'coach' instruction came after the AI had already written it",
  one_sided: 'The answer only gave one side of an opinion question',
  no_answer: 'The helper never actually answered',
  over_blocked: 'The helper refused a perfectly normal question',
};

export const COMPETENCY_META = {
  verification: { label: 'Verification', icon: '🔍', color: '#3DAA5C' },
  privacy: { label: 'Privacy', icon: '🛡️', color: '#4C97FF' },
  integrity: { label: 'Academic integrity', icon: '🧑‍🏫', color: '#FF8C1A' },
  bias: { label: 'Bias & balance', icon: '⚖️', color: '#E5527A' },
  usefulness: { label: 'Usefulness', icon: '💡', color: '#9966FF' },
} as const;
