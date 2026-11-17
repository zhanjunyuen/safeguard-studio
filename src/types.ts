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
  | 'block_people';

export interface ScriptBlock {
  uid: string;
  type: BlockType;
}

export interface BlockDef {
  type: BlockType;
  label: string;
  icon: string;
  color: string;
  textColor?: string;
  category: string;
  /** usefulness cost: added friction for every question */
  cost: number;
  hint: string;
  removable: boolean;
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
  };
}

export interface Challenge {
  id: string;
  title: string;
  emoji: string;
  story: string;
  audience: string;
  accent: string;
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
  | 'over_blocked';

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
