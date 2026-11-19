import { getChallenge } from '../data/challenges';
import { askLiteracyAi } from '../lib/literacyAi';
import { literacyAiUrl } from '../lib/supabase';
import { offlineAttackHint, setAttackHintProvider, type AttackHintProvider } from './attackHints';
import { markAnchors, markPacket } from './markPacket';
import {
  jsonIn, markOffline, offlineFollowUp, offlineSkillsSummary, parseModelFollowUp, parseModelMark, scoreOf,
  setMarkingProvider, setSkillsSummaryProvider, SKILL_BANDS,
  type FollowUpProvider, type Mark, type MarkingProvider, type MarkRequest, type SkillsSummaryProvider,
} from './marking';
import { labelOf } from './scriptText';

/**
 * The Adaption AI behind the four AI features: marking, follow-up answers, attack hints and the
 * skills summary. Each call goes through the literacy-ai Edge Function (the key stays on the
 * server). The model only reports concepts with quotes; parseModelMark checks the quotes and
 * recomputes the level with the fixed rules. Any failure falls back to the offline version, so
 * the assessment never stops working.
 */

/** The `marker` name on marks from the AI, shown in the evidence export. */
export const AI_MARKER = 'adaption-literacy-model';

/** The request behind each AI mark, so follow-ups and the summary can send the same evidence. */
const requestOf = new WeakMap<Mark, MarkRequest>();
/** One mark per request for this page visit: re-renders and React's double effects don't call the AI twice. */
const markCache = new Map<string, Promise<Mark>>();

/** A mark in the shape the model was trained on (the training completion JSON). */
const markForModel = (m: Mark) => ({
  criterion: m.criterion, rubricVersion: m.rubricVersion,
  concepts: m.concepts.map((c) => ({ id: c.id, present: c.present, evidence: c.evidence ?? null, source: c.computed ? 'trace' : 'response' })),
  level: m.level, insufficientEvidence: m.level === null, feedback: m.feedback, nextStep: m.nextStep, reviewFlag: m.reviewFlag,
});

export const aiMarker: MarkingProvider = (req) => {
  const key = JSON.stringify(req);
  const cached = markCache.get(key);
  if (cached) return cached;
  // Not tied to the component's abort signal: the answer is cached and reused when it remounts.
  const pending = (async () => {
    const raw = await askLiteracyAi({ task: 'mark', criterion: req.criterion, text: req.text, packet: markPacket(req), anchors: markAnchors(req) });
    if (!raw) { markCache.delete(key); return markOffline(req); }
    const mark = parseModelMark(raw, req, AI_MARKER);
    requestOf.set(mark, req);
    return mark;
  })();
  markCache.set(key, pending);
  return pending;
};

/** Statements of the pupil's own level in an answer ("Level 1 of 2", "you got level 1"), as the training validator reads them. */
const claimedLevels = (a: string) => [...a.matchAll(/(?:level (\d) of 2|(?:you have|you got|you get|gives you|gives|stays(?: at)?|this is|that's|which is|it is|it's) level (\d))/gi)].map((m) => Number(m[1] ?? m[2]));

export const aiFollowUp: FollowUpProvider = async (mark, question, signal) => {
  const req = requestOf.get(mark);
  if (!req) return offlineFollowUp(mark, question);
  const raw = await askLiteracyAi({ task: 'followup', packet: markPacket(req), text: req.text, mark: markForModel(mark), question }, signal);
  const answer = raw ? parseModelFollowUp(raw).trim() : '';
  // Never let an answer state a different level from the one the rules gave.
  if (!answer || answer.length > 1200 || claimedLevels(answer).some((l) => l !== mark.level)) return offlineFollowUp(mark, question);
  return answer;
};

export const aiSkillsSummary: SkillsSummaryProvider = async (marks, signal) => {
  const items = marks.flatMap((m) => { const req = requestOf.get(m); return req ? [{ criterion: m.criterion, text: req.text, mark: markForModel(m) }] : []; });
  if (!items.length) return offlineSkillsSummary(marks);
  const raw = await askLiteracyAi({ task: 'summary', items }, signal);
  const text = raw ? jsonIn(raw)?.summary : undefined;
  if (typeof text !== 'string' || !text.trim()) return offlineSkillsSummary(marks);
  // The total and band are fixed by the rules; reject a summary that states different ones.
  const score = scoreOf(marks);
  const totals = [...text.matchAll(/(\d)\s*(?:out of|\/)\s*8/gi)].map((m) => Number(m[1]));
  const bands = SKILL_BANDS.map((b) => b.band).filter((b) => new RegExp(`\\b${b}\\b`, 'i').test(text));
  if (totals.some((t) => t !== score.total) || bands.some((b) => b !== score.band)) return offlineSkillsSummary(marks);
  return text.trim();
};

export const aiAttackHint: AttackHintProvider = async (ctx, signal) => {
  const c = getChallenge(ctx.challengeId ?? ctx.desk);
  const raw = await askLiteracyAi({
    task: 'hint',
    context: {
      challenge: c?.title, audience: c?.audience, story: c?.story, level: c?.id.endsWith('@2') ? 2 : 1,
      build: ctx.blocks.map(labelOf).join(' → '), attackOptions: c?.tests.map((t) => t.attackLabel) ?? [], previousHints: ctx.previousHints,
    },
  }, signal);
  const hint = raw ? jsonIn(raw)?.hint : undefined;
  if (signal.aborted) return '';
  return typeof hint === 'string' && hint.trim().length >= 10 && hint.length <= 400 ? hint.trim() : offlineAttackHint(ctx, signal);
};

/** Switches every AI feature to the Adaption model when the app is built with Supabase. Returns whether it did. */
export function connectLiteracyAi() {
  if (!literacyAiUrl) return false;
  setMarkingProvider(aiMarker, aiFollowUp);
  setAttackHintProvider(aiAttackHint);
  setSkillsSummaryProvider(aiSkillsSummary);
  return true;
}
