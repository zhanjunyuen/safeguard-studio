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

describe('ideal helper', () => {
  const ideal = script('remove_pii', 'coach', 'ask_ai', 'check_source', 'both_sides');
  it.each(CHALLENGES.map((c) => [c.id, c] as const))('passes every test in %s', (_id, c) => {
    const rep = runChallenge(ideal, c);
    expect(rep.results.filter((r) => r.outcome !== 'pass').map((r) => r.testId)).toEqual([]);
    expect(rep.scores.usefulness).toBeGreaterThan(75);
  });
  it('bare helper is more useful-ish but unsafe', () => {
    const rep = runChallenge(script('ask_ai'), history);
    expect(rep.passed).toBe(2);
    expect(rep.scores.usefulness).toBe(100);
  });
});
