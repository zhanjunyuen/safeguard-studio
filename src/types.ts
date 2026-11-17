export type Competency = 'verification' | 'privacy' | 'integrity' | 'bias';
export type TestCategory = Competency | 'usefulness';

export type BlockType =
  | 'ask_ai'
  | 'remove_pii'
  | 'check_source'
  | 'coach'
  | 'both_sides'
  | 'flag_teacher'
  | 'warn_note'
  | 'ask_grownup'
  | 'block_people'
  // party planner
  | 'ask_permission'
  | 'refuse_food'
  | 'check_label'
  | 'second_ai'
  | 'no_impersonation'
  | 'dont_just_agree'
  // newspaper
  | 'official_contacts'
  | 'ask_the_source'
  | 'check_stats'
  | 'feedback_only'
  | 'disclose_ai'
  | 'neutral_wording';

/** What a block does to a message. Several blocks share an effect. */
export type Effect =
  | 'ai'
  | 'strip_pii'
  | 'consent'
  | 'verify'
  | 'second_opinion'
  | 'coach'
  | 'disclose'
  | 'balance'
  | 'warn'
  | 'flag'
  | 'block_all'
  | 'block_people'
  | 'block_food';

/** The kind of made-up content in a hallucination test. */
export type HallucKind = 'fact' | 'label' | 'quote' | 'stat';

export interface ScriptBlock {
  uid: string;
  type: BlockType;
}

export interface BlockDef {
  type: BlockType;
  label: string;
  color: string;
  textColor?: string;
  category: string;
  /** usefulness cost: added friction for every question */
  cost: number;
  hint: string;
  removable: boolean;
  effect: Effect;
  /** for verify blocks: which kinds of made-up content this check can catch */
  catches?: HallucKind[];
  /** where it needs to go to work, shown in the README and teacher notes */
  position: 'before' | 'after' | 'either' | 'anywhere';
  /** message when the block fixes something */
  acted?: string;
}

export interface HiddenTest {
  id: string;
  /** revealed name, shown after the student has met this test */
  title: string;
  category: TestCategory;
  question: string;
  /** question after personal info is removed */
  redactedQuestion?: string;
  aiRawAnswer: string;
  /** AI answer when it only saw the redacted question (defaults to aiRawAnswer) */
  redactedAnswer?: string;
  /** answer after a trusted-source check fixes the hallucination */
  correctedAnswer?: string;
  /** answer when AI is told to coach rather than do the work */
  coachAnswer?: string;
  /** answer when both sides are shown */
  balancedAnswer?: string;
  /** what the fake piece of personal info is (for narration) */
  piiDescription?: string;
  /** source used by the trusted-source check */
  source?: string;
  flags: {
    pii?: boolean;
    hallucination?: boolean;
    essayRequest?: boolean;
    oneSided?: boolean;
    mentionsPerson?: boolean;
    mentionsFood?: boolean;
    /** what kind of thing was made up (default 'fact') */
    hallucinationKind?: HallucKind;
    /** would a second AI spot the mistake? Usually not: they share blind spots */
    secondAICatches?: boolean;
  };
}

export interface Challenge {
  id: string;
  title: string;
  emoji: string;
  story: string;
  audience: string;
  accent: string;
  /** the safeguard blocks offered in this challenge */
  palette: BlockType[];
  tests: HiddenTest[];
}

export type StepStatus = 'ok' | 'acted' | 'warn' | 'stop' | 'skip';

export interface TraceStep {
  /** uid of block in script, or 'trigger' / 'reply' */
  uid: string;
  blockType: BlockType | 'trigger' | 'reply';
  status: StepStatus;
  message: string;
}

export type Outcome = 'pass' | 'partial' | 'fail' | 'over-blocked';

export type FailureKey =
  | 'hallucination_unchecked'
  | 'check_too_early'
  | 'pii_sent'
  | 'pii_too_late'
  | 'essay_written'
  | 'coach_too_late'
  | 'one_sided'
  | 'no_answer'
  | 'over_blocked'
  | 'wrong_check'
  | 'second_ai_agreed'
  | 'disclosed_only';

export interface TestResult {
  testId: string;
  category: TestCategory;
  outcome: Outcome;
  failureKey?: FailureKey;
  /** plain English explanation */
  explanation: string;
  steps: TraceStep[];
  question: string;
  reply: string;
  flagged: boolean;
  /** true if the helper refused/stopped rather than answering */
  blocked: boolean;
}

export interface Scores {
  verification: number | null;
  privacy: number | null;
  integrity: number | null;
  bias: number | null;
  usefulness: number;
}

export interface RunReport {
  results: TestResult[];
  scores: Scores;
  passed: number;
  total: number;
}
