import { BLOCKS, FAILURE_TEXT } from '../data/blocks';
import type { FailureKey, HiddenTest, TestResult } from '../types';
import type { Attempt, Reflection } from '../store/session';

export function reflectionCase(results: TestResult[], previous: Attempt | undefined, reflections: Reflection[]) {
  const failures = results.filter(r => r.failureKey && r.outcome !== 'pass');
  const changed = failures.filter(r => {
    const prior = previous?.results.find(p => p.testId === r.testId);
    return prior && (prior.failureKey !== r.failureKey || prior.outcome === 'pass');
  });
  const candidates = changed.length ? changed : failures;
  // Revisit the least recently discussed failure when the same build fails again.
  const lastAsked = (r: TestResult) => reflections.reduce((n, f) =>
    f.testId === r.testId && f.expected === r.failureKey ? f.attempt : n, 0);
  return candidates.sort((a, b) => lastAsked(a) - lastAsked(b))[0];
}

const families: FailureKey[][] = [
  ['hallucination_unchecked', 'check_too_early', 'wrong_check', 'second_ai_agreed', 'hedged_only'],
  ['pii_sent', 'pii_too_late', 'collected_too_much', 'over_blocked'],
  ['essay_written', 'coach_too_late', 'disclosed_only', 'over_blocked'],
  ['not_credited', 'disclosed_only', 'coach_too_late', 'over_blocked'],
  ['one_sided', 'judged_unfairly', 'hid_sponsor', 'over_blocked'],
  ['no_signpost', 'fed_dependency', 'safeguard_too_late', 'over_blocked'],
  ['missed_scam', 'fell_for_injection', 'hid_sponsor', 'safeguard_too_late'],
];

export function reflectionOptions(expected: FailureKey, seed: string, neighbours: FailureKey[]) {
  let hash = 0;
  for (const c of seed) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  const related = families.find(keys => keys.includes(expected)) ?? [];
  const alternatives = [...new Set<FailureKey>([...related, ...neighbours, 'no_answer', 'over_blocked', 'wrong_check', 'pii_sent'])].filter(k => k !== expected);
  const options = alternatives.slice(0, 3);
  options.splice(hash % (options.length + 1), 0, expected);
  return options;
}

export function reflectionAnswer(key: FailureKey, test: HiddenTest) {
  const detail = test.piiDescription;
  switch (key) {
    case 'pii_sent': return detail ? `Ask AI received ${detail}. No step caught those details in the request, even afterwards.` : FAILURE_TEXT[key];
    case 'pii_too_late': return detail ? `The privacy step ran after Ask AI had received ${detail}.` : FAILURE_TEXT[key];
    case 'hallucination_unchecked': return 'The helper passed on the claim without getting a source check, a second opinion or a confidence rating.';
    case 'wrong_check': return 'A check ran on the reply, but it checked a different kind of claim.';
    case 'check_too_early': return 'The check ran while there was still no reply to inspect.';
    case 'disclosed_only': return 'The helper labelled the work as AI-written and still handed over a finished answer.';
    case 'essay_written': return 'The helper wrote the finished work without adding a coaching instruction or an authorship label.';
    default: return FAILURE_TEXT[key];
  }
}

export function reflectionPrompt(test: HiddenTest, result: TestResult) {
  const steps = result.steps.filter(s => s.blockType !== 'trigger' && s.blockType !== 'reply');
  const stopped = steps.find(s => s.status === 'stop');
  if (stopped) return `“${BLOCKS[stopped.blockType].label}” stopped this run. What went wrong for the person asking?`;
  const condition = steps.find(s => s.blockType === 'if' || s.blockType === 'ifelse');
  if (result.failureKey === 'pii_too_late') {
    const privacyStep = steps.find(s => s.status === 'warn' && ['strip_pii', 'consent', 'mask_input_email'].includes(BLOCKS[s.blockType].effect));
    if (privacyStep) return `When “${BLOCKS[privacyStep.blockType].label}” ran, where had ${test.piiDescription ?? 'the private information'} already been?`;
  }
  if (condition && result.failureKey === 'pii_sent') return `${condition.message} What happened to the private details on this path?`;
  if (result.failureKey === 'pii_sent') {
    return `When Ask AI received this request, what happened to ${test.piiDescription ?? 'the personal details'}?`;
  }
  const warning = steps.find(s => s.status === 'warn' && s.blockType !== 'ask_ai');
  if (warning) return `Look at “${BLOCKS[warning.blockType].label}” in the replay. Which explanation fits the outcome?`;
  if (condition) return `${condition.message} What problem remained on that path?`;
  const last = steps.filter(s => s.status !== 'skip').at(-1);
  if (last && last.blockType !== 'ask_ai') return `After “${BLOCKS[last.blockType].label}” ran, what problem remained?`;
  if (last?.blockType === 'ask_ai') {
    const prior = steps.filter(s => s.status !== 'skip').at(-2);
    return prior
      ? `“${BLOCKS[prior.blockType].label}” ran before Ask AI. What still went wrong in the reply?`
      : 'Ask AI answered on its own. Which problem can you spot in its reply?';
  }
  return `What happened when your helper handled “${test.title}”?`;
}
