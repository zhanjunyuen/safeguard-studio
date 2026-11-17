import { describe, expect, it } from 'vitest';
import { CHALLENGES, getChallenge } from '../data/challenges';
import type { BlockType, ScriptBlock } from '../types';
import { runChallenge, runProgram } from './run';

const script = (...types: BlockType[]): ScriptBlock[] => types.map((type, i) => ({ uid: `${type}-${i}`, type }));
const history = getChallenge('history')!;
const test = (id: string) => history.tests.find((t) => t.id === id)!;

describe('demo moment', () => {
  it('bare Ask AI passes on the hallucinated date', () => {
    const r = runProgram(script('ask_ai'), test('h_date'));
    expect(r.outcome).toBe('fail');
    expect(r.failureKey).toBe('hallucination_unchecked');
    expect(r.reply).toContain('1067');
  });
  it('adding Check trusted source after Ask AI fixes it', () => {
    const r = runProgram(script('ask_ai', 'check_source'), test('h_date'));
    expect(r.outcome).toBe('pass');
    expect(r.reply).toContain('1066');
  });
});

describe('order matters', () => {
  it('check source before Ask AI does not help', () => {
    const r = runProgram(script('check_source', 'ask_ai'), test('h_date'));
    expect(r.outcome).toBe('fail');
    expect(r.failureKey).toBe('check_too_early');
  });
  it('remove PII after Ask AI is too late', () => {
    const r = runProgram(script('ask_ai', 'remove_pii'), test('h_address'));
    expect(r.outcome).toBe('fail');
    expect(r.failureKey).toBe('pii_too_late');
  });
  it('remove PII before Ask AI works', () => {
    const r = runProgram(script('remove_pii', 'ask_ai'), test('h_address'));
    expect(r.outcome).toBe('pass');
    expect(r.question).not.toContain('Mill Road');
  });
  it('coach after Ask AI is too late', () => {
    expect(runProgram(script('ask_ai', 'coach'), test('h_essay')).failureKey).toBe('coach_too_late');
    expect(runProgram(script('coach', 'ask_ai'), test('h_essay')).outcome).toBe('pass');
  });
  it('both sides works before or after', () => {
    expect(runProgram(script('both_sides', 'ask_ai'), test('h_bias')).outcome).toBe('pass');
    expect(runProgram(script('ask_ai', 'both_sides'), test('h_bias')).outcome).toBe('pass');
  });
});

describe('partial credit', () => {
  it('warning note gives partial on hallucination', () => {
    expect(runProgram(script('ask_ai', 'warn_note'), test('h_date')).outcome).toBe('partial');
  });
  it('teacher flag gives partial on essay', () => {
    expect(runProgram(script('ask_ai', 'flag_teacher'), test('h_essay')).outcome).toBe('partial');
  });
});

describe('traps: safe but useless', () => {
  it('ask a grown-up passes safety but over-blocks normal questions', () => {
    const rep = runChallenge(script('ask_grownup', 'ask_ai'), history);
    expect(rep.scores.privacy).toBe(100);
    expect(rep.scores.verification).toBe(100);
    expect(rep.results.filter((r) => r.outcome === 'over-blocked').length).toBe(2);
    expect(rep.scores.usefulness).toBeLessThan(10);
  });
  it('refuse people over-blocks William the Conqueror', () => {
    const r = runProgram(script('block_people', 'ask_ai'), test('h_william'));
    expect(r.outcome).toBe('over-blocked');
  });
});

describe('ideal helper per challenge', () => {
  const ideal: Record<string, BlockType[]> = {
    history: ['remove_pii', 'coach', 'ask_ai', 'check_source', 'both_sides'],
    party: ['ask_permission', 'no_impersonation', 'dont_just_agree', 'ask_ai', 'check_label'],
    news: ['official_contacts', 'feedback_only', 'ask_ai', 'ask_the_source', 'check_stats', 'neutral_wording'],
  };
  it.each(CHALLENGES.map((c) => [c.id, c] as const))('passes every test in %s using only its own palette', (id, c) => {
    expect(ideal[id].filter((t) => t !== 'ask_ai').every((t) => c.palette.includes(t))).toBe(true);
    const rep = runChallenge(script(...ideal[id]), c);
    expect(rep.results.filter((r) => r.outcome !== 'pass').map((r) => r.testId)).toEqual([]);
    expect(rep.scores.usefulness).toBeGreaterThan(75);
  });
  it('bare helper is fully useful but unsafe', () => {
    const rep = runChallenge(script('ask_ai'), history);
    expect(rep.passed).toBe(2);
    expect(rep.scores.usefulness).toBe(100);
  });
  it('palettes stay small and mostly distinct', () => {
    for (const c of CHALLENGES) expect(c.palette.length).toBeLessThanOrEqual(7);
    const [a, b, c] = CHALLENGES.map((x) => new Set(x.palette));
    expect([...b].filter((t) => a.has(t)).length).toBe(0);
    expect([...c].filter((t) => a.has(t)).length).toBeLessThanOrEqual(1);
  });
});

describe('new blocks', () => {
  const party = getChallenge('party')!;
  const news = getChallenge('news')!;
  const pt = (id: string) => party.tests.find((t) => t.id === id)!;
  const nt = (id: string) => news.tests.find((t) => t.id === id)!;

  it('a second AI repeats the nut-free mistake', () => {
    const r = runProgram(script('ask_ai', 'second_ai'), pt('p_nutfree'));
    expect(r.outcome).toBe('fail');
    expect(r.failureKey).toBe('second_ai_agreed');
  });
  it('checking the allergy label catches it', () => {
    expect(runProgram(script('ask_ai', 'check_label'), pt('p_nutfree')).outcome).toBe('pass');
  });
  it('asking permission before the AI is safe and does not cost usefulness', () => {
    const r = runProgram(script('ask_permission', 'ask_ai'), pt('p_allergy'));
    expect(r.outcome).toBe('pass');
    expect(r.blocked).toBe(false);
    expect(runProgram(script('ask_ai', 'ask_permission'), pt('p_allergy')).failureKey).toBe('pii_too_late');
  });
  it('refusing food over-blocks the pizza question', () => {
    expect(runProgram(script('refuse_food', 'ask_ai'), pt('p_pizza')).outcome).toBe('over-blocked');
  });
  it('quote check does not catch a made-up statistic', () => {
    const r = runProgram(script('ask_ai', 'ask_the_source'), nt('n_stat'));
    expect(r.failureKey).toBe('wrong_check');
    expect(runProgram(script('ask_ai', 'check_stats'), nt('n_stat')).outcome).toBe('pass');
  });
  it('labelling AI writing is only partial credit', () => {
    const r = runProgram(script('ask_ai', 'disclose_ai'), nt('n_article'));
    expect(r.outcome).toBe('partial');
    expect(r.failureKey).toBe('disclosed_only');
  });
});
