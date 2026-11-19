import { CHALLENGES } from '../data/challenges';
import { drawAssignment } from '../data/mission';
import type { Criterion } from './marking';
import type { AssessmentLevel, Desk, Mission } from './mission';

/**
 * What a teacher can set for an assessment: which challenges pupils get, whether each written
 * question is required or optional, and (optionally) a fixed level and time allowance.
 * A copy is saved on each attempt when it starts, so later changes never alter a pupil's attempt.
 */

export type QuestionKey = 'design' | 'attack' | 'curveball' | 'revision' | 'release';
export type Requirement = 'required' | 'optional';

/** The written questions in the assessment, in the order pupils meet them. `skill` is the skill each one is marked on. */
export const QUESTIONS: { key: QuestionKey; label: string; when: string; skill?: Criterion }[] = [
  { key: 'design', label: 'Design note', when: 'Before testing: which risk is the build designed for?' },
  { key: 'attack', label: 'Attack prediction', when: 'Before launching attacks: which block will fail, and why?', skill: 'testing' },
  { key: 'curveball', label: 'Curveball explanation', when: 'After the attack: why will the helper cope or not?', skill: 'anticipation' },
  { key: 'revision', label: 'Revision note', when: 'When revising: what did the attack show, and why keep or change blocks?', skill: 'revision' },
  { key: 'release', label: 'Release explanation', when: 'At the end: what should the club tell families, and who decides?', skill: 'judgement' },
];

/** Most and fewest challenges a teacher can set. */
export const MAX_CHALLENGES = 6;
export const MIN_CHALLENGES = 1;

export interface AssessmentSettings {
  /** chosen challenge ids, or null for a random draw of one per theme */
  challenges: Desk[] | null;
  questions: Record<QuestionKey, Requirement>;
  /** fixed level, or null to let pupils choose */
  level: AssessmentLevel | null;
  /** fixed time allowance in minutes (0 = untimed), or null to let pupils choose */
  minutes: number | null;
}

export const DEFAULT_SETTINGS: AssessmentSettings = {
  challenges: null,
  questions: { design: 'optional', attack: 'required', curveball: 'required', revision: 'required', release: 'required' },
  level: null,
  minutes: null,
};

/** Time allowances offered to pupils and teachers. */
export const TIME_OPTIONS = [0, 15, 25, 40, 60];

const ids = new Set(CHALLENGES.map((c) => c.id));

/** Cleans settings from storage or the class database: unknown values fall back to the defaults. */
export function cleanSettings(raw: unknown): AssessmentSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AssessmentSettings>;
  const chosen = Array.isArray(r.challenges) ? [...new Set(r.challenges.filter((id) => ids.has(id)))].slice(0, MAX_CHALLENGES) as Desk[] : [];
  const questions = { ...DEFAULT_SETTINGS.questions };
  for (const q of QUESTIONS) {
    const v = (r.questions as Record<string, unknown> | undefined)?.[q.key];
    if (v === 'required' || v === 'optional') questions[q.key] = v;
  }
  return {
    challenges: chosen.length >= MIN_CHALLENGES ? chosen : null,
    questions,
    level: r.level === 1 || r.level === 2 ? r.level : null,
    minutes: typeof r.minutes === 'number' && TIME_OPTIONS.includes(r.minutes) ? r.minutes : null,
  };
}

/** The challenges for a new attempt: the teacher's choice, else one per theme at random. */
export const assignmentFor = (s: AssessmentSettings, random = Math.random): Desk[] =>
  s.challenges?.length ? [...s.challenges] : drawAssignment(random) as Desk[];

/** Whether a question must be answered in this attempt. Attempts from before settings existed use the defaults. */
export const isRequired = (m: Pick<Mission, 'settings'>, q: QuestionKey) =>
  (m.settings?.questions ?? DEFAULT_SETTINGS.questions)[q] === 'required';

/** Skills whose question is optional in this attempt (an unanswered optional question doesn't count against the pupil). */
export const optionalSkills = (m: Pick<Mission, 'settings'>): Criterion[] =>
  QUESTIONS.filter((q) => q.skill && !isRequired(m, q.key)).map((q) => q.skill!);
