import { BLOCKS } from '../data/blocks';
import type {
  BlockType,
  Challenge,
  Competency,
  FailureKey,
  HiddenTest,
  Outcome,
  RunReport,
  Scores,
  ScriptBlock,
  TestResult,
  TraceStep,
} from '../types';

interface MsgState {
  question: string;
  piiInQuestion: boolean;
  piiLeakedToAI: boolean;
  piiRemovedTooLate: boolean;
  aiCalled: boolean;
  answer: string | null;
  hallucination: boolean;
  checkedTooEarly: boolean;
  coachRequested: boolean;
  coachTooLate: boolean;
  essayWritten: boolean;
  balanceRequested: boolean;
  oneSided: boolean;
  flagged: boolean;
  warned: boolean;
  blocked: string | null;
}

const isRisky = (t: HiddenTest) =>
  !!(t.flags.pii || t.flags.hallucination || t.flags.essayRequest || t.flags.oneSided);

/** Runs a student's script against one hidden test. Pure and deterministic. */
export function runProgram(script: ScriptBlock[], test: HiddenTest): TestResult {
  const s: MsgState = {
    question: test.question,
    piiInQuestion: !!test.flags.pii,
    piiLeakedToAI: false,
    piiRemovedTooLate: false,
    aiCalled: false,
    answer: null,
    hallucination: false,
    checkedTooEarly: false,
    coachRequested: false,
    coachTooLate: false,
    essayWritten: false,
    balanceRequested: false,
    oneSided: false,
    flagged: false,
    warned: false,
    blocked: null,
  };

  const steps: TraceStep[] = [
    { uid: 'trigger', blockType: 'trigger', status: 'ok', message: `Question: “${test.question}”` },
  ];
  const push = (b: ScriptBlock, status: TraceStep['status'], message: string) =>
    steps.push({ uid: b.uid, blockType: b.type, status, message });

  for (const b of script) {
    if (s.blocked) {
      push(b, 'skip', 'Skipped: the helper already stopped.');
      continue;
    }
    switch (b.type as BlockType) {
      case 'remove_pii': {
        if (!test.flags.pii) {
          push(b, 'ok', 'No personal info found.');
        } else if (s.aiCalled) {
          s.piiRemovedTooLate = true;
          push(b, 'warn', `Removed ${test.piiDescription}, but it had ALREADY been sent to the AI.`);
          if (test.redactedAnswer) s.answer = test.redactedAnswer;
          s.piiInQuestion = false;
        } else {
          s.piiInQuestion = false;
          s.question = test.redactedQuestion ?? s.question;
          push(b, 'acted', `Removed ${test.piiDescription} before anything left the device.`);
        }
        break;
      }
      case 'block_people': {
        if (test.flags.mentionsPerson) {
          s.blocked = "Sorry, I can't answer questions that mention a person.";
          push(b, 'stop', 'This question mentions a person, so the helper refused it.');
        } else push(b, 'ok', 'No people mentioned, so the question goes through.');
        break;
      }
      case 'ask_grownup': {
        s.blocked = 'Please ask a grown-up about this.';
        push(b, 'stop', 'Sent the question to a grown-up. The helper gives no answer.');
        break;
      }
      case 'coach': {
        if (s.aiCalled) {
          if (test.flags.essayRequest) s.coachTooLate = true;
          push(
            b,
            test.flags.essayRequest ? 'warn' : 'ok',
            test.flags.essayRequest
              ? 'Too late: the AI had already written the whole thing.'
              : 'Nothing to coach here.',
          );
        } else {
          s.coachRequested = true;
          push(b, test.flags.essayRequest ? 'acted' : 'ok',
            test.flags.essayRequest
              ? 'Told the AI: help them plan, don’t do it for them.'
              : 'Told the AI to coach rather than do the work.');
        }
        break;
      }
      case 'both_sides': {
        if (!s.aiCalled) {
          s.balanceRequested = true;
          push(b, test.flags.oneSided ? 'acted' : 'ok', 'Told the AI to give more than one point of view.');
        } else if (s.oneSided) {
          s.oneSided = false;
          s.answer = test.balancedAnswer ?? s.answer;
          push(b, 'acted', 'Spotted a one-sided answer and added the other side.');
        } else push(b, 'ok', 'Answer is already balanced.');
        break;
      }
      case 'ask_ai': {
        s.aiCalled = true;
        if (s.piiInQuestion) s.piiLeakedToAI = true;
        const piiStripped = test.flags.pii && !s.piiInQuestion;
        s.answer = piiStripped && test.redactedAnswer ? test.redactedAnswer : test.aiRawAnswer;
        if (test.flags.hallucination) s.hallucination = true;
        if (test.flags.essayRequest) {
          if (s.coachRequested) s.answer = test.coachAnswer ?? s.answer;
          else s.essayWritten = true;
        }
        if (test.flags.oneSided) {
          if (s.balanceRequested) s.answer = test.balancedAnswer ?? s.answer;
          else s.oneSided = true;
        }
        push(
          b,
          s.piiLeakedToAI ? 'warn' : 'ok',
          s.piiLeakedToAI
            ? `The AI answered, and now it has ${test.piiDescription}.`
            : 'The AI answered confidently.',
        );
        break;
      }
      case 'check_source': {
        if (!s.aiCalled) {
          if (test.flags.hallucination) s.checkedTooEarly = true;
          push(b, test.flags.hallucination ? 'warn' : 'ok', 'Nothing to check yet: the AI hasn’t answered.');
        } else if (s.hallucination) {
          s.hallucination = false;
          s.answer = test.correctedAnswer ?? s.answer;
          push(b, 'acted', `Caught it! Didn’t match ${test.source}, so the answer was corrected.`);
        } else push(b, 'ok', 'Checked against a trusted source: it matches.');
        break;
      }
      case 'warn_note': {
        if (s.answer) {
          s.warned = true;
          push(b, 'ok', 'Added: “AI can make mistakes, so double-check.”');
        } else push(b, 'ok', 'No answer to add a note to yet.');
        break;
      }
      case 'flag_teacher': {
        const risky =
          s.piiInQuestion || s.piiLeakedToAI || s.hallucination || s.essayWritten || s.oneSided ||
          (!s.aiCalled && isRisky(test));
        if (risky) {
          s.flagged = true;
          push(b, 'acted', 'Something looks risky, so the teacher was notified.');
        } else push(b, 'ok', 'Nothing risky spotted.');
        break;
      }
    }
  }

  // ---- Reply & judgement ----
  let reply: string;
  if (s.blocked) reply = s.blocked;
  else if (!s.answer) reply = '…';
  else reply = s.answer + (s.warned ? '\n⚠️ AI can make mistakes, so double-check.' : '');

  let outcome: Outcome = 'pass';
  let failureKey: FailureKey | undefined;
  let explanation = '';

  const half = (key: FailureKey, why: string) => {
    failureKey = key;
    if (s.flagged) {
      outcome = 'partial';
      explanation = `${why} A teacher was flagged, which helps, but the problem still reached the user.`;
    } else {
      outcome = 'fail';
      explanation = why;
    }
  };

  if (s.blocked) {
    if (test.category === 'usefulness') {
      outcome = 'over-blocked';
      failureKey = 'over_blocked';
      explanation = 'This was a normal question, and the helper refused it. Too much caution makes a tool nobody uses.';
    } else if (s.piiLeakedToAI) {
      half(s.piiRemovedTooLate ? 'pii_too_late' : 'pii_sent', 'Personal info reached the AI before the helper stopped.');
    } else {
      explanation = 'Safe, but only because the helper refused to help. That costs usefulness.';
    }
  } else if (!s.aiCalled || !s.answer) {
    outcome = 'fail';
    failureKey = 'no_answer';
    explanation = 'The helper never gave an answer.';
  } else if (s.piiLeakedToAI) {
    half(
      s.piiRemovedTooLate ? 'pii_too_late' : 'pii_sent',
      s.piiRemovedTooLate
        ? `${test.piiDescription} was removed, but only after it was sent to the AI. Once it has gone, you can't get it back.`
        : `${test.piiDescription} was sent straight to the AI company.`,
    );
  } else if (s.hallucination) {
    if (s.warned || s.flagged) {
      outcome = 'partial';
      failureKey = s.checkedTooEarly ? 'check_too_early' : 'hallucination_unchecked';
      explanation =
        'The wrong answer still went out. The warning helps, but most people don’t double-check.';
    } else {
      outcome = 'fail';
      failureKey = s.checkedTooEarly ? 'check_too_early' : 'hallucination_unchecked';
      explanation = s.checkedTooEarly
        ? 'Your source check ran before the AI had answered, so the made-up fact slipped through.'
        : 'The AI made up a fact, and your helper passed it on as if it were true.';
    }
  } else if (s.essayWritten) {
    half(
      s.coachTooLate ? 'coach_too_late' : 'essay_written',
      s.coachTooLate
        ? 'The coach instruction came after the AI had already written it.'
        : 'The AI did the whole piece of work for them. They will learn nothing, and it could count as cheating.',
    );
  } else if (s.oneSided) {
    half('one_sided', 'The helper just agreed with a loaded question and gave one side only.');
  } else {
    explanation =
      test.category === 'usefulness' ? 'Helpful answer to a normal question. 👍' : 'Handled safely and still helpful.';
  }

  steps.push({
    uid: 'reply',
    blockType: 'reply',
    status: outcome === 'pass' ? 'ok' : outcome === 'partial' ? 'warn' : 'stop',
    message: s.flagged ? 'Replied (teacher flagged 🚩)' : 'Replied.',
  });

  return {
    testId: test.id,
    category: test.category,
    outcome,
    failureKey,
    explanation,
    steps,
    question: s.question,
    reply,
    flagged: s.flagged,
    blocked: !!s.blocked,
  };
}

const outcomeScore = (o: Outcome) => (o === 'pass' ? 1 : o === 'partial' ? 0.5 : 0);

export function scoreResults(script: ScriptBlock[], results: TestResult[]): Scores {
  const comp = (c: Competency) => {
    const rs = results.filter((r) => r.category === c);
    if (!rs.length) return null;
    return Math.round((rs.reduce((a, r) => a + outcomeScore(r.outcome), 0) / rs.length) * 100);
  };
  // Usefulness: how many questions got a real (unblocked) answer, minus friction.
  const answered = results.filter((r) => !r.blocked && r.failureKey !== 'no_answer').length;
  const benign = results.filter((r) => r.category === 'usefulness');
  const benignOk = benign.filter((r) => r.outcome === 'pass').length;
  const friction = script.reduce((a, b) => a + BLOCKS[b.type].cost, 0);
  const base = 0.6 * (benign.length ? benignOk / benign.length : 1) + 0.4 * (answered / results.length);
  const usefulness = Math.max(0, Math.min(100, Math.round(base * 100 - friction)));
  return {
    verification: comp('verification'),
    privacy: comp('privacy'),
    integrity: comp('integrity'),
    bias: comp('bias'),
    usefulness,
  };
}

export function runChallenge(script: ScriptBlock[], challenge: Challenge): RunReport {
  const results = challenge.tests.map((t) => runProgram(script, t));
  return {
    results,
    scores: scoreResults(script, results),
    passed: results.filter((r) => r.outcome === 'pass').length,
    total: results.length,
  };
}
