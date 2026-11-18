import { BLOCKS } from '../data/blocks';
import type {
  Challenge,
  Competency,
  FailureKey,
  HallucKind,
  RiskKind,
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
  checkedWrong: boolean;
  secondAgreed: boolean;
  coachRequested: boolean;
  coachTooLate: boolean;
  essayWritten: boolean;
  disclosed: boolean;
  balanceRequested: boolean;
  oneSided: boolean;
  flagged: boolean;
  warned: boolean;
  blocked: string | null;
  consented: boolean;
  hedged: boolean;
  riskOpen: boolean;
  riskPre: boolean;
  riskLate: boolean;
  riskEarly: boolean;
  blockedBy: string | null;
}

const KIND_NAME: Record<HallucKind, string> = {
  fact: 'facts',
  label: 'product labels',
  quote: 'quotes',
  stat: 'statistics',
  rumour: 'rumours',
  rule: 'rules and requirements',
  citation: 'sources',
  image: 'images',
  review: 'reviews',
};

const isRisky = (t: HiddenTest) => !!(t.flags.pii || t.flags.hallucination || t.flags.essayRequest || t.flags.oneSided || t.flags.risk);

const RISK_KEY: Record<RiskKind, FailureKey> = {
  needs_human: 'no_signpost',
  dependency: 'fed_dependency',
  injection: 'fell_for_injection',
  scam: 'missed_scam',
  sponsored: 'hid_sponsor',
  data_grab: 'collected_too_much',
  uncredited: 'not_credited',
};

const RISK_WHY: Record<RiskKind, string> = {
  needs_human: 'This needed a real person. The helper tried to handle a serious situation itself instead of pointing them to a trusted adult or the emergency services.',
  dependency: 'The helper encouraged them to rely on it instead of real people. A chatbot is not a friend or a parent.',
  injection: 'Someone typed instructions to trick the helper into breaking its own rules, and it obeyed.',
  scam: 'The helper treated a scam or pressure trick as genuine.',
  sponsored: 'A paid advert was presented as an honest recommendation.',
  data_grab: 'The helper asked for or exposed far more personal information than it needed.',
  uncredited: 'AI-made work was passed off as their own, without saying what the AI did.',
};

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
    checkedWrong: false,
    secondAgreed: false,
    coachRequested: false,
    coachTooLate: false,
    essayWritten: false,
    disclosed: false,
    balanceRequested: false,
    oneSided: false,
    flagged: false,
    warned: false,
    blocked: null,
    consented: false,
    hedged: false,
    riskOpen: false,
    riskPre: false,
    riskLate: false,
    riskEarly: false,
    blockedBy: null,
  };
  const kind = test.flags.hallucinationKind ?? 'fact';

  const steps: TraceStep[] = [{ uid: 'trigger', blockType: 'trigger', status: 'ok', message: `"${test.question}"` }];
  const push = (b: ScriptBlock, status: TraceStep['status'], message: string) =>
    steps.push({ uid: b.uid, blockType: b.type, status, message });

  for (const b of script) {
    const def = BLOCKS[b.type];
    if (s.blocked) {
      push(b, 'skip', 'Skipped. The helper had already stopped.');
      continue;
    }
    switch (def.effect) {
      case 'strip_pii': {
        if (!test.flags.pii) push(b, 'ok', 'No personal info found.');
        else if (s.aiCalled) {
          s.piiRemovedTooLate = true;
          s.piiInQuestion = false;
          if (test.redactedAnswer) s.answer = test.redactedAnswer;
          push(b, 'warn', `Removed ${test.piiDescription}, but the AI had already been sent it.`);
        } else {
          s.piiInQuestion = false;
          s.question = test.redactedQuestion ?? s.question;
          push(b, 'acted', `Removed ${test.piiDescription} before anything was sent.`);
        }
        break;
      }
      case 'consent': {
        if (!test.flags.pii) push(b, 'ok', "No one else's details in this message.");
        else if (s.aiCalled) {
          s.piiRemovedTooLate = true;
          push(b, 'warn', `Asked about ${test.piiDescription}, but the AI had already been sent it.`);
        } else {
          s.consented = true;
          s.blocked = `Before I use this: did they agree to you sharing ${test.piiDescription}? I can still help if you leave their details out.`;
          push(b, 'acted', `Stopped to ask about ${test.piiDescription} before sending anything.`);
        }
        break;
      }
      case 'block_people': {
        if (test.flags.mentionsPerson) {
          s.blocked = "Sorry, I can't answer questions that mention a person.";
          s.blockedBy = def.effect;
          push(b, 'stop', 'The question names a person, so the helper refused it.');
        } else push(b, 'ok', 'No one named, so the question goes through.');
        break;
      }
      case 'block_topic': {
        if (def.topic && test.flags.topics?.includes(def.topic)) {
          s.blocked = `Sorry, I can't help with anything about ${def.topic}.`;
          s.blockedBy = def.effect;
          push(b, 'stop', `The question is about ${def.topic}, so the helper refused it.`);
        } else push(b, 'ok', `Nothing about ${def.topic}, so the question goes through.`);
        break;
      }
      case 'block_all': {
        s.blocked = 'Please ask a grown-up about this.';
        s.blockedBy = def.effect;
        push(b, 'stop', 'Passed the question to a grown-up. The helper gives no answer.');
        break;
      }
      case 'coach': {
        if (s.aiCalled) {
          if (test.flags.essayRequest) s.coachTooLate = true;
          push(b, test.flags.essayRequest ? 'warn' : 'ok', test.flags.essayRequest ? 'Too late. The AI had already written the whole thing.' : 'Nothing to change here.');
        } else {
          s.coachRequested = true;
          push(b, test.flags.essayRequest ? 'acted' : 'ok', test.flags.essayRequest ? def.acted ?? 'Told the AI how to help.' : 'Instruction added for the AI.');
        }
        break;
      }
      case 'disclose': {
        if (s.essayWritten) {
          s.disclosed = true;
          s.answer = `${s.answer}\n[Written with AI]`;
          push(b, 'warn', 'Labelled it as written by AI. It is still not their own work.');
        } else push(b, 'ok', s.aiCalled ? 'Nothing that needs a label.' : 'Nothing to label yet.');
        break;
      }
      case 'balance': {
        if (!s.aiCalled) {
          s.balanceRequested = true;
          push(b, test.flags.oneSided ? 'acted' : 'ok', `Told the AI: "${def.label}."`);
        } else if (s.oneSided) {
          s.oneSided = false;
          s.answer = test.balancedAnswer ?? s.answer;
          push(b, 'acted', 'Spotted a one-sided answer and rewrote it.');
        } else push(b, 'ok', 'The answer was already balanced.');
        break;
      }
      case 'ai': {
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
        if (test.flags.risk) {
          if (s.riskPre) s.answer = test.safeAnswer ?? s.answer;
          else s.riskOpen = true;
        }
        push(b, s.piiLeakedToAI ? 'warn' : 'ok', s.piiLeakedToAI ? `The AI answered, and it now has ${test.piiDescription}.` : 'The AI answered.');
        break;
      }
      case 'verify': {
        if (!s.aiCalled) {
          if (test.flags.hallucination) s.checkedTooEarly = true;
          push(b, test.flags.hallucination ? 'warn' : 'ok', 'Nothing to check yet. The AI has not answered.');
        } else if (s.hallucination) {
          if (def.catches?.includes(kind)) {
            s.hallucination = false;
            s.answer = test.correctedAnswer ?? s.answer;
            push(b, 'acted', `Did not match ${test.source}, so the answer was corrected.`);
          } else {
            s.checkedWrong = true;
            const covers = (def.catches ?? []).map((k) => KIND_NAME[k]).join(' and ');
            push(b, 'warn', `This only checks ${covers}, so it missed a made-up ${KIND_NAME[kind].replace(/s$/, '')}.`);
          }
        } else push(b, 'ok', 'Checked. Nothing wrong found.');
        break;
      }
      case 'second_opinion': {
        if (!s.aiCalled) {
          if (test.flags.hallucination) s.checkedTooEarly = true;
          push(b, test.flags.hallucination ? 'warn' : 'ok', 'Nothing to check yet. The AI has not answered.');
        } else if (s.hallucination) {
          if (test.flags.secondAICatches) {
            s.hallucination = false;
            s.answer = test.correctedAnswer ?? s.answer;
            push(b, 'acted', 'The second AI spotted the mistake this time.');
          } else {
            s.secondAgreed = true;
            push(b, 'warn', b.type === 'second_ai' ? 'The second AI agreed with the wrong answer. AIs often make the same mistakes.' : 'Classmates agreed it was true. Lots of people believing something does not make it true.');
          }
        } else push(b, 'ok', 'The second AI agreed.');
        break;
      }
      case 'warn': {
        if (s.answer) {
          s.warned = true;
          push(b, 'ok', 'Added: "AI can make mistakes, so double-check."');
        } else push(b, 'ok', 'No answer to add a note to yet.');
        break;
      }
      case 'hedge': {
        if (!s.aiCalled) push(b, 'ok', 'Nothing to ask about yet. The AI has not answered.');
        else {
          s.warned = true;
          s.hedged = true;
          push(b, s.hallucination ? 'warn' : 'ok', s.hallucination ? 'The AI said it was "very confident". It was still wrong.' : 'The AI said it was confident.');
        }
        break;
      }
      case 'mitigate': {
        const risk = test.flags.risk;
        if (!risk || !def.handles?.includes(risk)) {
          push(b, 'ok', 'Nothing for this block to do here.');
        } else if (!s.aiCalled) {
          if (def.position === 'after') {
            s.riskEarly = true;
            push(b, 'warn', 'Nothing to check yet. The AI has not answered.');
          } else {
            s.riskPre = true;
            push(b, 'acted', def.acted ?? 'Told the AI how to handle this.');
          }
        } else if (def.position === 'before') {
          s.riskLate = true;
          push(b, 'warn', 'Too late. The AI had already answered.');
        } else if (s.riskOpen) {
          s.riskOpen = false;
          s.answer = test.safeAnswer ?? s.answer;
          push(b, 'acted', def.acted ?? 'Caught it and fixed the reply.');
        } else push(b, 'ok', 'Nothing wrong found.');
        break;
      }
      case 'flag': {
        const risky = s.piiInQuestion || s.piiLeakedToAI || s.hallucination || s.essayWritten || s.oneSided || s.riskOpen || (!s.aiCalled && isRisky(test));
        if (risky) {
          s.flagged = true;
          push(b, 'acted', 'Something looked risky, so a teacher was notified.');
        } else push(b, 'ok', 'Nothing risky spotted.');
        break;
      }
    }
  }

  // ---- Reply and judgement ----
  let reply: string;
  if (s.blocked) reply = s.blocked;
  else if (!s.answer) reply = '…';
  else reply = s.answer + (s.warned ? '\n(AI can make mistakes, so double-check.)' : '');

  let outcome: Outcome = 'pass';
  let failureKey: FailureKey | undefined;
  let explanation = '';

  const half = (key: FailureKey, why: string) => {
    failureKey = key;
    if (s.flagged) {
      outcome = 'partial';
      explanation = `${why} A teacher was told, which helps, but the problem still reached them.`;
    } else {
      outcome = 'fail';
      explanation = why;
    }
  };
  const piiKey = (): FailureKey => (s.piiRemovedTooLate ? 'pii_too_late' : 'pii_sent');

  if (s.blocked) {
    if (test.category === 'usefulness') {
      outcome = 'over-blocked';
      failureKey = 'over_blocked';
      explanation = 'This was a normal question and the helper refused it. People stop using a tool that says no to everything.';
    } else if (s.piiLeakedToAI) {
      half(piiKey(), 'Personal info reached the AI before the helper stopped.');
    } else if (test.flags.risk === 'needs_human' && s.blockedBy !== 'block_all') {
      outcome = 'fail';
      failureKey = 'no_signpost';
      explanation = "Refusing isn't enough here. Someone with a serious worry needs to be pointed to a trusted adult or the right helpline.";
    } else {
      explanation = s.consented
        ? 'The helper checked before sharing anyone’s details. Good.'
        : 'Safe, but only because the helper refused to help. That costs usefulness.';
    }
  } else if (!s.aiCalled || !s.answer) {
    outcome = 'fail';
    failureKey = 'no_answer';
    explanation = 'The helper never gave an answer.';
  } else if (s.piiLeakedToAI) {
    half(
      piiKey(),
      s.piiRemovedTooLate
        ? `${test.piiDescription} came out after it had been sent to the AI. Once it is sent, you can't take it back.`
        : `${test.piiDescription} went straight to the AI company.`,
    );
  } else if (s.hallucination) {
    failureKey = s.checkedTooEarly ? 'check_too_early' : s.secondAgreed ? 'second_ai_agreed' : s.checkedWrong ? 'wrong_check' : 'hallucination_unchecked';
    const why = {
      check_too_early: 'The check ran before the AI had answered, so the made-up claim got through.',
      second_ai_agreed: 'Someone else agreeing (another AI, or other people) is not the same as checking a real source.',
      wrong_check: `Your helper had a check, but not one that covers ${KIND_NAME[kind]}.`,
      hallucination_unchecked: 'The AI made something up and your helper passed it on as true.',
    }[failureKey as 'check_too_early'];
    if (s.hedged && !s.checkedWrong && !s.secondAgreed && !s.checkedTooEarly) failureKey = 'hedged_only';
    if (s.warned || s.flagged) {
      outcome = 'partial';
      explanation = s.hedged
        ? 'The AI said how sure it was, which gives the reader a hint, but AI can be confident and wrong. Nothing actually checked the answer.'
        : `${why} The warning helps a little, but most people don't double-check.`;
    } else {
      outcome = 'fail';
      explanation = why;
    }
  } else if (s.essayWritten) {
    if (s.disclosed) {
      outcome = 'partial';
      failureKey = 'disclosed_only';
      explanation = 'Being honest that AI wrote it is good, but it still is not their work and they learn nothing from it.';
    } else
      half(
        s.coachTooLate ? 'coach_too_late' : 'essay_written',
        s.coachTooLate
          ? 'The instruction came after the AI had already written it.'
          : 'The AI did the whole piece of work. They learn nothing, and it could count as cheating.',
      );
  } else if (s.oneSided) {
    half('one_sided', 'The helper went along with a loaded question and gave one side only.');
  } else if (s.riskOpen) {
    const risk = test.flags.risk!;
    if (s.riskLate) half('safeguard_too_late', 'The safeguard came after the AI had already answered, so it was too late to change anything.');
    else if (s.riskEarly) half('check_too_early', 'The check ran before the AI had answered, so there was nothing to check yet.');
    else half(RISK_KEY[risk], RISK_WHY[risk]);
  } else {
    explanation = test.category === 'usefulness' ? 'A normal question, answered properly.' : 'Handled safely, and still helpful.';
  }

  steps.push({
    uid: 'reply',
    blockType: 'reply',
    status: outcome === 'pass' ? 'ok' : outcome === 'partial' ? 'warn' : 'stop',
    message: s.flagged ? 'Replied, and a teacher was flagged.' : 'Replied.',
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
    // a consent check is a pause, not a refusal, so it doesn't cost usefulness
    blocked: !!s.blocked && !s.consented,
  };
}

const outcomeScore = (o: Outcome) => (o === 'pass' ? 1 : o === 'partial' ? 0.5 : 0);

export function scoreResults(script: ScriptBlock[], results: TestResult[]): Scores {
  const comp = (c: Competency) => {
    const rs = results.filter((r) => r.category === c);
    if (!rs.length) return null;
    return Math.round((rs.reduce((a, r) => a + outcomeScore(r.outcome), 0) / rs.length) * 100);
  };
  // Usefulness: share of questions that got a real answer, minus the friction each block adds.
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
    judgement: comp('judgement'),
    manipulation: comp('manipulation'),
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
