export type Competency = 'verification' | 'privacy' | 'integrity' | 'bias' | 'judgement' | 'manipulation';
export type TestCategory = Competency | 'usefulness';

/** Block ids are defined in src/data/blocks.ts; a unit test checks every id used exists. */
export type BlockType = string;

/** What a block does to a message. Several blocks share an effect. */
export type Effect =
  | 'ai'
  | 'strip_pii'
  | 'consent'
  | 'verify'
  | 'scan_reply'
  | 'reference_year'
  | 'mask_input_email'
  | 'cite_correction'
  | 'mask_reply_email'
  | 'link_scheme'
  | 'second_opinion'
  | 'coach'
  | 'disclose'
  | 'balance'
  | 'warn'
  | 'flag'
  | 'block_all'
  | 'block_people'
  | 'block_topic'
  | 'hedge'
  | 'mitigate'
  | 'control';

/** Risks that aren't facts, privacy, cheating or bias: each needs a specific safeguard. */
export type RiskKind = 'needs_human' | 'dependency' | 'injection' | 'scam' | 'sponsored' | 'data_grab' | 'uncredited' | 'unfair_judgement';

/** The kind of made-up content in a hallucination test. */
export type HallucKind = 'fact' | 'label' | 'quote' | 'stat' | 'rumour' | 'rule' | 'citation' | 'image' | 'review'
  | 'chronology' | 'booking' | 'kit_stock' | 'checkout';

/** Conditions for IF blocks. They look at what the message says, not at what it really is. */
export type CondId = 'person' | 'numbers' | 'contact' | 'health' | 'finished' | 'opinion' | 'urgent' | 'ai_unsure';

export interface ScriptBlock {
  uid: string;
  /** a safeguard block id, or 'if' / 'ifelse' for Level 2 control blocks */
  type: BlockType;
  cond?: CondId;
  then?: ScriptBlock | null;
  else?: ScriptBlock | null;
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
  /** Visible feature a scan_reply block looks for in the drafted reply. */
  pattern?: RegExp;
  /** where it needs to go to work, shown in the README and teacher notes */
  position: 'before' | 'after' | 'either' | 'anywhere';
  /** for mitigate blocks: which risks this block deals with */
  handles?: RiskKind[];
  /** for block_topic: the topic this block refuses */
  topic?: string;
  /** message when the block fixes something */
  acted?: string;
}

export interface HiddenTest {
  id: string;
  /** the attack block that creates this situation in Break mode */
  attackLabel: string;
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
  /** reply once the risk has been handled properly */
  safeAnswer?: string;
  /** answer when both sides are shown */
  balancedAnswer?: string;
  /** what the fake piece of personal info is (for narration) */
  piiDescription?: string;
  /** source used by the trusted-source check */
  source?: string;
  /** override which IF conditions this message triggers (edge cases set this on purpose) */
  cues?: CondId[];
  flags: {
    pii?: boolean;
    /** Email masking fully removes the private information in this case. */
    emailOnlyPii?: boolean;
    hallucination?: boolean;
    essayRequest?: boolean;
    oneSided?: boolean;
    mentionsPerson?: boolean;
    /** topics a refuse-a-topic block would trigger on, e.g. 'food', 'tests' */
    topics?: string[];
    /** what kind of thing was made up (default 'fact') */
    hallucinationKind?: HallucKind;
    /** a risk that needs a specific safeguard (see RiskKind) */
    risk?: RiskKind;
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
  /** which theme this challenge belongs to (src/data/themes.ts) */
  themeId: string;
  /** a helper that passes every test (used by tests and the sample class) */
  ideal: BlockType[];
  /** the locked helper students try to break in Break mode */
  breakTarget: BlockType[];
  /** the safeguard blocks offered in this challenge */
  palette: BlockType[];
  tests: HiddenTest[];
}

export type StepStatus = 'ok' | 'acted' | 'warn' | 'stop' | 'skip';

export interface TraceStep {
  /** uid of block in script, or 'trigger' / 'reply' */
  uid: string;
  blockType: BlockType | 'trigger' | 'reply' | 'if' | 'ifelse';
  status: StepStatus;
  message: string;
}

export type Outcome = 'pass' | 'partial' | 'fail' | 'over-blocked';

export type FailureKey =
  | 'hallucination_unchecked'
  | 'judged_unfairly'
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
  | 'disclosed_only'
  | 'hedged_only'
  | 'no_signpost'
  | 'fed_dependency'
  | 'fell_for_injection'
  | 'missed_scam'
  | 'hid_sponsor'
  | 'collected_too_much'
  | 'not_credited'
  | 'safeguard_too_late';

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
  /** usefulness cost of the blocks that actually ran for this message */
  cost: number;
  /** true if the helper refused/stopped rather than answering */
  blocked: boolean;
}

export interface Scores {
  verification: number | null;
  privacy: number | null;
  integrity: number | null;
  bias: number | null;
  judgement?: number | null;
  manipulation?: number | null;
  usefulness: number;
}

export interface RunReport {
  results: TestResult[];
  scores: Scores;
  passed: number;
  total: number;
}
