import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkRequest } from './marking';

// The Edge Function call is mocked: each test sets what the "model" replies (null = unreachable).
const reply = vi.hoisted(() => ({ next: [] as (string | null)[], bodies: [] as Record<string, unknown>[] }));
vi.mock('../lib/literacyAi', () => ({
  askLiteracyAi: async (body: Record<string, unknown>) => { reply.bodies.push(body); return reply.next.shift() ?? null; },
}));

const { aiMarker, aiFollowUp, aiSkillsSummary, aiAttackHint, AI_MARKER } = await import('./aiProviders');

const judgement = (text: string): MarkRequest => ({ criterion: 'judgement', text, decision: 'edit' });
const answer = 'Tell families it starts at 10 am. Ask the site manager to confirm the accessible entrance.';
const modelMark = (concepts: object[], extra: object = {}) => JSON.stringify({ reasoning: 'C1 present…', criterion: 'judgement', concepts, level: 1, feedback: 'Good use of the notice.', nextStep: 'What is out of date?', reviewFlag: false, ...extra });

beforeEach(() => { reply.next = []; reply.bodies = []; });

describe('AI marker', () => {
  it('keeps quoted concepts, drops unquoted ones and recomputes the level with the fixed rules', async () => {
    reply.next = [modelMark([
      { id: 'C1', present: true, evidence: 'Tell families it starts at 10 am.' },
      { id: 'C2', present: true, evidence: 'the accessible entrance' },
      { id: 'C3', present: true, evidence: 'something the pupil never wrote' },
      { id: 'C4', present: true },
    ])];
    const mark = await aiMarker(judgement(answer));
    expect(mark.marker).toBe(AI_MARKER);
    expect(mark.concepts.find((c) => c.id === 'C3')?.present).toBe(false);
    expect(mark.level).toBe(1);
    expect(reply.bodies[0]).toMatchObject({ task: 'mark', criterion: 'judgement', text: answer });
    expect((reply.bodies[0] as any).packet.currentSource).toMatch(/10 am/);
  });

  it('falls back to the offline preview when the AI is unreachable, and asks again next time', async () => {
    const req = judgement(answer + ' Offline case.');
    const mark = await aiMarker(req);
    expect(mark.marker).toMatch(/^offline/);
    reply.next = [modelMark([{ id: 'C1', present: true, evidence: 'Tell families it starts at 10 am.' }])];
    expect((await aiMarker(req)).marker).toBe(AI_MARKER);
  });

  it('asks the AI once per answer, however often the page re-renders', async () => {
    reply.next = [modelMark([])];
    const req = judgement(answer + ' Cached.');
    await Promise.all([aiMarker(req), aiMarker(req)]);
    expect(reply.bodies.length).toBe(1);
  });
});

describe('AI follow-ups and summary', () => {
  it('passes on a follow-up answer, but not one that states a different level', async () => {
    reply.next = [modelMark([{ id: 'C1', present: true, evidence: 'Tell families it starts at 10 am.' }])];
    const mark = await aiMarker(judgement(answer + ' Follow.'));
    reply.next = [JSON.stringify({ reasoning: '…', answer: 'You used the new time, so C1 is shown. Next, say what is out of date.' })];
    expect(await aiFollowUp(mark, 'Why did I get this level?')).toMatch(/new time/);
    reply.next = [JSON.stringify({ answer: 'This is level 2 of 2, well done.' })];
    expect(await aiFollowUp(mark, 'Why did I get this level?')).not.toMatch(/well done/);
  });

  it('uses the AI summary only when it states the score the rules give', async () => {
    reply.next = [modelMark([{ id: 'C1', present: true, evidence: 'Tell families it starts at 10 am.' }])];
    const mark = await aiMarker(judgement(answer + ' Summary.'));
    reply.next = [JSON.stringify({ summary: 'You scored 1 out of 8: Getting started. You used the new time.' })];
    expect(await aiSkillsSummary([mark])).toMatch(/new time/);
    reply.next = [JSON.stringify({ summary: 'You scored 7 out of 8: Secure.' })];
    expect(await aiSkillsSummary([mark])).toMatch(/^You scored 1 out of 8: Getting started\./);
  });
});

describe('AI attack hints', () => {
  it('lets the model choose an attack-planning question and falls back if it offers a fix', async () => {
    const ctx = { desk: 'party' as const, blocks: ['ask_ai'], previousHints: [], challengeId: 'party', plannedAttacks: ['Quote an unchecked poll result'] };
    const signal = new AbortController().signal;
    reply.next = [JSON.stringify({ hint: 'Move the privacy block before Ask AI.' })];
    const fallback = await aiAttackHint(ctx, signal);
    expect(fallback).toContain('You picked “Quote an unchecked poll result”');
    const { planningQuestions } = (reply.bodies[0] as { context: { planningQuestions: string[] } }).context;
    const comparison = planningQuestions.find(q => q.includes('for comparison'))!;
    expect(comparison).toBeTruthy();
    reply.next = [JSON.stringify({ hint: comparison })];
    expect(await aiAttackHint(ctx, signal)).toBe(comparison);
    reply.next = [JSON.stringify({ hint: 'How could you compare those replies?' })];
    expect(await aiAttackHint(ctx, signal)).toBe(comparison);
    expect(await aiAttackHint({ ...ctx, previousHints: [fallback] }, signal)).toMatch(/made-up detail/);
  });

  it('uses the build hint and latest results while designing the helper', async () => {
    const hint = 'Your allergy test got through. What reaches Ask AI before the first check?';
    reply.next = [JSON.stringify({ hint })];
    expect(await aiAttackHint({ desk: 'party', blocks: ['ask_ai'], previousHints: [], stage: 'build',
      latestResults: [{ test: 'The allergy question', outcome: 'got through' }] }, new AbortController().signal)).toBe(hint);
    expect(reply.bodies[0]).toMatchObject({ context: { stage: 'build', build: 'Ask AI', latestResults: [{ test: 'The allergy question', outcome: 'got through' }] } });
  });
});

describe('AI final verdict', () => {
  it('keeps a verdict that states the computed score and replaces one that does not', async () => {
    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({ literacyAiUrl: 'https://example.test/functions/v1/literacy-ai', supabaseKey: 'k' }));
    const { finalVerdict } = await import('./aiProviders');
    const f = { total: 64, band: 'Developing', categories: { answers: 50, tests: 80, workload: 80, attempts: 70, independence: 67 }, parts: {}, skills: { scores: {}, total: 4 }, challenges: [], hintsUsed: 1 } as never;
    reply.next = [JSON.stringify({ verdict: 'You scored 64 out of 100, Developing. Your builds were strong.' })];
    expect(await finalVerdict(f, [])).toEqual({ text: 'You scored 64 out of 100, Developing. Your builds were strong.', ai: true });
    reply.next = [JSON.stringify({ verdict: 'You scored 90 out of 100!' })];
    expect((await finalVerdict(f, [])).ai).toBe(false);
    reply.next = [JSON.stringify({ verdict: 'Great work overall.' })];
    expect((await finalVerdict(f, [])).ai).toBe(false);
    expect((reply.bodies.at(-1) as any).task).toBe('final');
  });
});
