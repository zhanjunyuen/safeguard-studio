import { labelOf } from './scriptText';
import { CURVEBALLS } from '../data/curveballs';
import type { BlockType, TestCategory } from '../types';
import type { Desk } from './mission';

/**
 * Marking of pupils' written responses.
 *
 * The future AI marker plugs in here. A marker only decides which **concepts** are present
 * in a response and quotes the evidence; `levelFor` turns concepts into a level with fixed
 * rules, so every level can be traced to quoted evidence and a published rule.
 *
 * Until a trained model is connected, `offlineMarker` gives a keyword preview. It is
 * deliberately simple: it can miss what a pupil meant, and the right words can fool it.
 * The UI labels it as a preview. To connect a model, call `setMarkingProvider` with an
 * adapter that calls a server (never put model credentials in the browser).
 */

/** Version of the concept codebook and level rules (separate from the evidence format's rubricVersion). */
export const RUBRIC_VERSION = 'marking-concepts-1';
export type Criterion = 'testing' | 'anticipation' | 'judgement' | 'revision';
export type Level = 0 | 1 | 2 | null; // null = insufficient evidence

export const CRITERION_NAME: Record<Criterion, string> = {
  testing: 'Testing and diagnosis',
  anticipation: 'Anticipation',
  judgement: 'Independent judgement',
  revision: 'Revision and efficiency',
};

export interface Concept {
  id: string;
  label: string;
  present: boolean;
  /** the sentence from the response that shows it */
  evidence?: string;
  /** decided by the simulator, not by reading the text */
  computed?: boolean;
}

export interface Mark {
  criterion: Criterion;
  rubricVersion: string;
  marker: string;
  concepts: Concept[];
  level: Level;
  feedback: string;
  nextStep: string;
  reviewFlag: boolean;
}

export interface PlannedCase { id: string; label: string; title: string; category: TestCategory }

export type MarkRequest =
  | { criterion: 'testing'; text: string; blocks: BlockType[]; planned: PlannedCase[]; broke: string[] }
  | { criterion: 'anticipation'; text: string; blocks: BlockType[]; desk: Desk; prediction: 'handles' | 'struggles'; handled: boolean }
  | { criterion: 'judgement'; text: string; decision: string; anchors?: JudgementAnchors }
  /** The revision note written on finish or revise. `before` is the frozen (attacked) build, `after` the latest
   *  evaluated build; `failing` are cases the frozen build failed in evaluation or attack; credits come from the simulator. */
  | { criterion: 'revision'; text: string; before: BlockType[]; after: BlockType[]; failing: PlannedCase[]; creditsBefore: number; creditsAfter: number };

/** What C1–C4 look for in one release-decision scenario, as regex sources (see docs/marking-codebook.md).
 *  Omitted = the ecology club scenario. */
export interface JudgementAnchors {
  /** C1: the current fact from the source (e.g. "10 am") */
  current: string;
  /** C2: the detail the source leaves open */
  open: string;
  /** C3: the person or role who can settle it (and when) */
  person: string;
  /** C4: out-of-date details from the draft */
  stale: string;
  /** labels shown in feedback */
  labels?: { current: string; open: string; person: string; stale: string };
}

export const ECOLOGY_ANCHORS: JudgementAnchors = {
  current: "\\b(10\\s*(am|a\\.m\\.?|o'?clock)|ten (am|o'?clock))",
  open: '(accessib|entrance|wheelchair|step[- ]free|disabled access)',
  person: '(site manager|confirm|check with|ask (the|a|someone)|on friday)',
  stale: "(north gate|\\b9\\s*(am|a\\.m)|nine o'?clock)",
  labels: { current: 'Saturday at 10 am', open: 'the accessible entrance', person: 'the site manager', stale: '9 am, north gate' },
};

export type MarkingProvider = (req: MarkRequest, signal?: AbortSignal) => Promise<Mark>;
export type FollowUpProvider = (mark: Mark, question: string, signal?: AbortSignal) => Promise<string>;

// ---------------------------------------------------------------- level rules

/** Fixed concept → level rules. Shared by every marker, offline or model. */
export function levelFor(criterion: Criterion, concepts: Concept[], text: string): Level {
  if (wordCount(text) < 4) return null;
  const has = (id: string) => concepts.find((c) => c.id === id)?.present ?? false;
  if (criterion === 'testing') return has('T1') && has('T3') ? 2 : has('T1') || has('T2') ? 1 : 0;
  if (criterion === 'anticipation') return has('A1') && has('A2') && has('A3') ? 2 : has('A2') || has('A3') ? 1 : 0;
  // Revision: naming a change with no reason is 0; a reason from the trace or a stated consequence is 1;
  // 2 needs the change (or keep), the trace evidence and a comparison of at least two consequences.
  if (criterion === 'revision') return has('R1') && has('R2') && has('R4') ? 2 : has('R2') || has('R3') ? 1 : 0;
  return has('C1') && has('C2') && has('C3') && has('C4') ? 2 : has('C1') || has('C2') || has('C3') ? 1 : 0;
}

// ---------------------------------------------------------------- offline preview marker

const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** The sentence of `text` that contains the first match of `re`. */
function quote(text: string, re: RegExp): string | undefined {
  const m = re.exec(text);
  if (!m) return undefined;
  const start = Math.max(text.lastIndexOf('.', m.index) + 1, text.lastIndexOf('\n', m.index) + 1, 0);
  const endDot = text.slice(m.index).search(/[.!?\n]/);
  const end = endDot === -1 ? text.length : m.index + endDot + 1;
  const s = text.slice(start, end).trim();
  return s.length > 160 ? s.slice(0, 157) + '…' : s;
}

const STOP = new Set(['about', 'against', 'every', 'their', 'someone', 'anything', 'before', 'after', 'question', 'questions', 'there', 'which', 'would', 'should', 'could', 'other', 'others']);
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function wordsRe(phrases: string[]): RegExp | null {
  const words = [...new Set(phrases.flatMap((p) => p.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/)).filter((w) => w.length >= 5 && !STOP.has(w)))];
  return words.length ? new RegExp(`\\b(${words.map(escape).join('|')})`, 'i') : null;
}

const CATEGORY_WORDS: Record<TestCategory, RegExp> = {
  verification: /(wrong|made[ -]?up|false|fact|check|true|date|source|label|quote|number|rumou?r)/i,
  privacy: /(name|address|personal|private|privacy|health|allerg|phone|where (they|she|he) live)/i,
  integrity: /(essay|cheat|write (it|the|their)|homework|do (it|the work) for|own work|copy)/i,
  bias: /(one[- ]sided|loaded|agree|bias|stereotyp|both sides|opinion|fair)/i,
  judgement: /(adult|helpline|person|serious|emergency|human)/i,
  manipulation: /(trick|scam|advert|sponsor|instruction|fake|pressure)/i,
  usefulness: /(normal|refuse|block(s|ed)? (it|everything|normal)|too strict|useful)/i,
};

const MECHANISM = /(only (checks?|covers?|looks?|works?)|doesn'?t (check|cover|catch|look|notice|know|stop|work)|does not (check|cover|catch|look|notice|stop)|can'?t (tell|catch|check|see|stop|know)|cannot|won'?t (catch|notice|stop|check)|before|after|too (late|early)|no (block|check|safeguard)|none of my|nothing (in|to|that)|missing|isn'?t (a|an|the)|not (a|the) (right|kind)|wrong (kind|place|order)|would (catch|stop|fix|notice|check)|catches|stops it|fixes it)/i;
const MISSING = /(missing|no [a-z ]*(check|block|safeguard)|doesn'?t have|hasn'?t got|without (a|any)|forgot|didn'?t (add|put))/i;
const INJECTION_ATTEMPT = /(give (me |this |it )?(full|top|maximum|max) marks|ignore (the|your|all) (rubric|rules|instructions)|mark (this|it) as (a )?2)/i;

function blockRe(blocks: BlockType[]): RegExp | null {
  return wordsRe(blocks.filter((b) => b !== 'ask_ai').map((b) => labelOf(b)));
}

function testing(req: Extract<MarkRequest, { criterion: 'testing' }>): Concept[] {
  const text = req.text;
  const bre = blockRe(req.blocks);
  const blockQuote = (bre && quote(text, bre)) || quote(text, MISSING);
  const caseRe = (c: PlannedCase) => {
    const own = wordsRe([c.label, c.title]);
    return own ? new RegExp(`${own.source}|${CATEGORY_WORDS[c.category].source}`, 'i') : CATEGORY_WORDS[c.category];
  };
  const kindQuote = req.planned.map((c) => quote(text, caseRe(c))).find(Boolean);
  const broken = req.planned.filter((c) => req.broke.includes(c.id));
  const matchQuote = broken.map((c) => quote(text, caseRe(c))).find(Boolean)
    ?? (!broken.length ? quote(text, /(\bhold|handle|\bsafe|\bfine\b|\bok(ay)?\b|\bpass(es)?\b|won'?t (fail|break|get through)|will (work|cope))/i) : undefined);
  return [
    { id: 'T1', label: 'Names a block in the helper, or a safeguard it is missing', present: !!blockQuote, evidence: blockQuote },
    { id: 'T2', label: 'Says what kind of request should get through', present: !!kindQuote, evidence: kindQuote },
    { id: 'T3', label: 'The prediction matches what the attack showed', present: !!matchQuote, evidence: matchQuote, computed: true },
  ];
}

function anticipation(req: Extract<MarkRequest, { criterion: 'anticipation' }>): Concept[] {
  const cb = CURVEBALLS[req.desk]!;
  const text = req.text;
  const bre = blockRe(req.blocks);
  const riskQuote = quote(text, cb.riskWords);
  const mechQuote = (bre && bre.test(text) && quote(text, MECHANISM)) || quote(text, MISSING) || (bre && quote(text, new RegExp(`(${bre.source}).*(${MECHANISM.source})|(${MECHANISM.source}).*(${bre.source})`, 'i')));
  const stepQuote = quote(text, cb.stepWords);
  const correct = (req.prediction === 'handles') === req.handled;
  return [
    { id: 'A1', label: 'The prediction matches what happened', present: correct, computed: true },
    { id: 'A2', label: `Names the risk in this case: ${cb.risk}`, present: !!riskQuote, evidence: riskQuote },
    { id: 'A3', label: 'Links it to a block: what it covers, what it misses, or where it sits', present: !!mechQuote, evidence: mechQuote || undefined },
    { id: 'A4', label: 'Suggests a sensible person or real-world check', present: !!stepQuote, evidence: stepQuote },
  ];
}

function judgement(req: Extract<MarkRequest, { criterion: 'judgement' }>): Concept[] {
  const text = req.text;
  const a = req.anchors ?? ECOLOGY_ANCHORS;
  const L = a.labels ?? ECOLOGY_ANCHORS.labels!;
  const c1 = quote(text, new RegExp(a.current, 'i'));
  const c2 = quote(text, new RegExp(a.open, 'i'));
  const c3 = quote(text, new RegExp(a.person, 'i'));
  const stale = new RegExp(a.stale, 'i');
  const correcting = /\b(not|never|no longer|don'?t|isn'?t|aren'?t|wasn'?t|shouldn'?t|leave|remov\w*|out|wrong|old|last term|instead|rather than|ignore|drop|replac\w*|nobody|no one|chang\w*|delete|cross)\b/i;
  const staleQuote = quote(text, stale);
  const c4ok = !staleQuote || correcting.test(staleQuote);
  return [
    { id: 'C1', label: `Uses the current source (${L.current})`, present: !!c1, evidence: c1 },
    { id: 'C2', label: `Spots the detail that is still open (${L.open})`, present: !!c2, evidence: c2 },
    { id: 'C3', label: `Gives the open question to the right person (${L.person})`, present: !!c3, evidence: c3 },
    { id: 'C4', label: `Doesn't repeat the out-of-date details (${L.stale})`, present: c4ok, evidence: c4ok ? undefined : staleQuote },
  ];
}

// What each consequence family looks like in a revision note (offline preview only).
const CONSEQUENCE: Record<'safety' | 'usefulness' | 'workload', RegExp> = {
  safety: /(\bsafe|unsafe|privacy|private|harm|leak|risk|danger|catch(es)?\b|caught|gets? through|let (it|them) through)/i,
  usefulness: /(useful|helpful|normal (question|request)s?|refus|too strict|over[- ]?block|block(s|ed)? (normal|everything|good)|answers? (normal|properly))/i,
  workload: /(credit|cost|cheap|expensive|workload|slow|faster|every message|runs? on every)/i,
};
const KEEP_OR_CHANGE = /\b(kept|keep|left (it|the|my)|no change|didn'?t change|same (build|design|blocks?|stack)|added|removed|took out|moved|swapped|replaced|changed)\b/i;
const TRACE_WORDS = /(\btests?\b|attack|replay|trace|\bcase\b|failed|passed|got through|was caught|step)/i;

function revision(req: Extract<MarkRequest, { criterion: 'revision' }>): Concept[] {
  const text = req.text;
  const bre = blockRe([...req.before, ...req.after]);
  const r1 = (bre && quote(text, bre)) || quote(text, KEEP_OR_CHANGE);
  const caseRe = wordsRe(req.failing.flatMap((c) => [c.label, c.title]));
  const r2 = (caseRe && quote(text, caseRe)) || quote(text, TRACE_WORDS);
  const families = (Object.keys(CONSEQUENCE) as (keyof typeof CONSEQUENCE)[]).filter((k) => CONSEQUENCE[k].test(text));
  const r3 = families.length ? quote(text, CONSEQUENCE[families[0]]) : undefined;
  const r4 = families.length >= 2 ? quote(text, CONSEQUENCE[families[1]]) : undefined;
  return [
    { id: 'R1', label: 'Says what was changed, or that the build was kept', present: !!r1, evidence: r1 },
    { id: 'R2', label: 'Cites evidence from a test, attack or replay', present: !!r2, evidence: r2 },
    { id: 'R3', label: 'States a consequence for safety, usefulness or workload', present: !!r3, evidence: r3 },
    { id: 'R4', label: 'Compares at least two of safety, usefulness and workload', present: !!r4, evidence: r4 },
  ];
}

const NEXT: Record<Criterion, Record<string, string>> = {
  testing: {
    T1: 'Which block in your helper did you expect to let it through, or which safeguard is missing?',
    T2: 'What kind of request did you expect to get past your helper?',
    T3: 'Look at the attack replies. Which of your predictions came true, and which block explains it?',
  },
  anticipation: {
    A1: 'Your prediction did not match. Which step in the replay surprised you, and why?',
    A2: 'What exactly is risky about this request? Name the risk in your own words.',
    A3: 'Which block in your helper would see this request, and does it check the right kind of thing?',
    A4: 'If no block can catch this, who or what should check it instead?',
  },
  judgement: {
    C1: "What does this term's notice say about the time?",
    C2: "Which detail does this term's notice still leave open?",
    C3: 'Who can confirm that detail, and when?',
    C4: "Is anything in the helper's draft out of date? What should families not be told?",
  },
  revision: {
    R1: 'Which block did you add, remove or move, or did you keep the build as it was?',
    R2: 'Which test or attack result made you decide this? What happened in the replay?',
    R3: 'What does this change do to safety, usefulness or the workload credits?',
    R4: 'You named one effect. What did the change cost or gain on another one: safety, usefulness or workload?',
  },
};

const PRAISE: Record<Criterion, string> = {
  testing: 'You connected your prediction to a specific block and the attack showed it.',
  anticipation: 'You named the risk, linked it to how your helper works, and predicted correctly.',
  judgement: 'You used the current source, spotted what is still uncertain and gave it to the right person.',
  revision: 'You named the change, backed it with a result from the replay and weighed what it costs against what it gains.',
};

export function markOffline(req: MarkRequest): Mark {
  const concepts = req.criterion === 'testing' ? testing(req) : req.criterion === 'anticipation' ? anticipation(req) : req.criterion === 'revision' ? revision(req) : judgement(req);
  const level = levelFor(req.criterion, concepts, req.text);
  const missing = concepts.find((c) => !c.present);
  const feedback = level === null
    ? 'There is not enough here to mark yet. Write a full sentence or two.'
    : missing
      ? `Not yet shown: ${missing.label.charAt(0).toLowerCase() + missing.label.slice(1)}.`
      : PRAISE[req.criterion];
  const nextStep = missing ? NEXT[req.criterion][missing.id] : req.criterion === 'anticipation' && !concepts.find((c) => c.id === 'A4')?.present
    ? NEXT.anticipation.A4 : 'Could you explain this to a classmate in one sentence?';
  return {
    criterion: req.criterion,
    rubricVersion: RUBRIC_VERSION,
    marker: 'offline-keywords-0',
    concepts,
    level,
    feedback,
    nextStep,
    reviewFlag: level === null || INJECTION_ATTEMPT.test(req.text),
  };
}

export const offlineMarker: MarkingProvider = async (req) => markOffline(req);

export const FOLLOW_UPS = ['Why did I get this level?', 'What would make it stronger?', 'Can I trust this marker?'];

export const offlineFollowUp: FollowUpProvider = async (mark, question) => {
  const got = mark.concepts.filter((c) => c.present).map((c) => c.label.toLowerCase());
  const not = mark.concepts.filter((c) => !c.present).map((c) => c.label.toLowerCase());
  if (question === FOLLOW_UPS[0]) {
    if (mark.level === null) return 'Your answer was too short to find any evidence, so it is marked "not enough evidence" rather than 0.';
    return `Level ${mark.level} of 2. Shown: ${got.length ? got.join('; ') : 'none of the concepts yet'}. ${not.length ? `Not yet shown: ${not.join('; ')}.` : ''} The level comes from fixed rules about which of these are present, so the same evidence always gets the same level.`;
  }
  if (question === FOLLOW_UPS[1]) return not.length ? `${mark.nextStep} Answering that would add: ${not[0]}.` : 'Everything the rubric looks for is there. To go further, compare the safety, usefulness and workload of another option.';
  return 'This is an offline preview that looks for key words. It can miss what you meant, and the right words can fool it. Your teacher sees your full answer, and the trained AI marker will read for meaning. If this feels wrong, say so: that is good evidence too.';
};

/** Score bands for the skills summary: the total out of 8 maps to one plain-English band. */
export const SKILL_BANDS: { min: number; band: string }[] = [
  { min: 6, band: 'Secure' },
  { min: 3, band: 'Developing' },
  { min: 0, band: 'Getting started' },
];
export const SKILL_ORDER: Criterion[] = ['testing', 'anticipation', 'judgement', 'revision'];

export interface SkillsScore {
  /** level per skill; null = not enough evidence (counts as 0 in the total) */
  scores: Record<Criterion, Level>;
  total: number;
  outOf: 8;
  band: string;
  /** skills with no usable mark yet */
  notEnoughEvidence: Criterion[];
}

/** The clear score for a pupil's set of marks: the sum of the four skill levels (0–2 each) out of 8,
 *  and its band. Fixed rules, like levelFor: the model never decides the score, it explains it. */
export function skillsScore(marks: Partial<Record<Criterion, Level>>): SkillsScore {
  const scores = Object.fromEntries(SKILL_ORDER.map((c) => [c, marks[c] ?? null])) as Record<Criterion, Level>;
  const total = SKILL_ORDER.reduce((sum, c) => sum + (scores[c] ?? 0), 0);
  return {
    scores, total, outOf: 8,
    band: SKILL_BANDS.find((b) => total >= b.min)!.band,
    notEnoughEvidence: SKILL_ORDER.filter((c) => scores[c] === null),
  };
}

// ---------------------------------------------------------------- trained-model output

/** The concepts each criterion is marked on, with the codebook's wording (docs/marking-codebook.md). */
const CONCEPT_LABEL: Record<Criterion, [string, string][]> = {
  testing: [['T1', 'Names a block in the helper, or a safeguard it is missing'], ['T2', 'Says what kind of request should get through'], ['T3', 'The prediction matches what the attack showed']],
  anticipation: [['A1', 'The prediction matches what happened'], ['A2', 'Names the risk in this case'], ['A3', 'Links it to a block: what it covers, what it misses, or where it sits'], ['A4', 'Suggests a sensible person or real-world check']],
  judgement: [['C1', 'Uses the current source for the fact that changed'], ['C2', 'Spots the detail the source still leaves open'], ['C3', 'Gives the open question to the right person'], ['C4', 'Does not repeat out-of-date details']],
  revision: [['R1', 'Says what was changed, or that the build was kept'], ['R2', 'Cites evidence from a test, attack or replay'], ['R3', 'States a consequence for safety, usefulness or workload'], ['R4', 'Compares at least two of safety, usefulness and workload']],
};

const squash = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();

/** The first JSON object in a model reply (the model may wrap it in text or a code fence). */
function jsonIn(raw: string): Record<string, unknown> | null {
  const i = raw.indexOf('{'), j = raw.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try { const o = JSON.parse(raw.slice(i, j + 1)); return o && typeof o === 'object' ? o as Record<string, unknown> : null; } catch { return null; }
}

/**
 * Turns the trained marker's reply into a Mark, applying the same rules as the training validator.
 * The reply starts with a `reasoning` field (its concept-by-concept working); that is dropped here
 * and never shown to pupils. Concepts need an exact quote from the pupil's answer, A1 comes from the
 * simulator, and the level is always recomputed with levelFor: the model's own `level` only raises a
 * review flag if it disagrees. A reply that isn't valid JSON falls back to the offline preview, flagged.
 */
export function parseModelMark(raw: string, req: MarkRequest, marker = 'trained-model'): Mark {
  const o = jsonIn(raw);
  if (!o || !Array.isArray(o.concepts)) return { ...markOffline(req), reviewFlag: true };
  const given = new Map((o.concepts as Record<string, unknown>[]).map((c) => [String(c?.id), c]));
  const concepts: Concept[] = CONCEPT_LABEL[req.criterion].map(([id, label]) => {
    if (id === 'A1' && req.criterion === 'anticipation') {
      return { id, label, present: (req.prediction === 'handles') === req.handled, computed: true };
    }
    const c = given.get(id);
    const evidence = typeof c?.evidence === 'string' ? c.evidence : undefined;
    // C4 is present when no out-of-date detail is repeated, so it needs no quote; every other concept does.
    const quoted = !!evidence && squash(req.text).includes(squash(evidence));
    const present = id === 'C4' ? c?.present !== false : c?.present === true && quoted;
    return { id, label, present, ...(present && evidence ? { evidence } : {}) };
  });
  const level = levelFor(req.criterion, concepts, req.text);
  const claimed = o.level === null || [0, 1, 2].includes(o.level as number) ? (o.level as Level) : undefined;
  return {
    criterion: req.criterion,
    rubricVersion: RUBRIC_VERSION,
    marker,
    concepts,
    level,
    feedback: typeof o.feedback === 'string' && o.feedback ? o.feedback : 'Your teacher will look at this answer.',
    nextStep: typeof o.nextStep === 'string' && o.nextStep ? o.nextStep : 'What could you add to your answer?',
    reviewFlag: o.reviewFlag === true || level === null || INJECTION_ATTEMPT.test(req.text) || (claimed !== undefined && claimed !== level),
  };
}

/** The pupil-facing answer from the trained model's follow-up reply ({"reasoning", "answer"}); the
 *  reasoning is dropped. Plain text (an older model) is returned as it is. */
export function parseModelFollowUp(raw: string): string {
  const o = jsonIn(raw);
  return o && typeof o.answer === 'string' ? o.answer : raw.trim();
}

/** Asks for a short summary of a pupil's skills from their marks (served by the trained model). */
export type SkillsSummaryProvider = (marks: Mark[], signal?: AbortSignal) => Promise<string>;

let provider: MarkingProvider = offlineMarker;
let followUp: FollowUpProvider = offlineFollowUp;
/** Connect a server-backed marker (the trained model). Pass nothing to go back to the offline preview. */
export function setMarkingProvider(p?: MarkingProvider, f?: FollowUpProvider) {
  provider = p ?? offlineMarker;
  followUp = f ?? offlineFollowUp;
}
export const getMarkingProvider = () => provider;
export const getFollowUpProvider = () => followUp;
