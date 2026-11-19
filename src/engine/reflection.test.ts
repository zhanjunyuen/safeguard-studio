import { describe, expect, it } from 'vitest';
import { getChallenge } from '../data/challenges';
import { FAILURE_TEXT } from '../data/blocks';
import { runChallenge } from './run';
import { reflectionCase, reflectionOptions, reflectionPrompt } from './reflection';
import { keyToBlock } from './scriptText';
import type { FailureKey } from '../types';

const history = getChallenge('history')!;
const run = (...keys: string[]) => runChallenge(keys.map((k, i) => keyToBlock(k, String(i))), history);

describe('failure reflections', () => {
  it('distinguishes an absent check, a mistimed check and a skipped branch on the same request', () => {
    const prompt = (...keys: string[]) => reflectionPrompt(history.tests[0], run(...keys).results[0]);
    expect(prompt('ask_ai')).toContain('on its own');
    expect(prompt('check_source', 'ask_ai')).toContain('Check against a trusted source');
    expect(prompt('ask_ai', 'if:ai_unsure:check_source:')).toContain('No, so skip');
  });

  it('asks about a changed failure first, then moves to a case the pupil has not discussed', () => {
    const bare = run('ask_ai');
    const late = run('ask_ai', 'remove_pii');
    const first = reflectionCase(late.results, { ...bare, at: 1, script: ['ask_ai'] }, []);
    expect(first?.failureKey).toBe('pii_too_late');
    const prior = { attempt: 1, testId: bare.results[0].testId, expected: 'hallucination_unchecked' as const, chosen: 'wrong_check' as const, correct: false, text: '' };
    expect(reflectionCase(bare.results, undefined, [prior])?.testId).toBe('h_address');
    expect(reflectionCase(run(...history.ideal).results, undefined, [])).toBeUndefined();
  });

  it('keeps grading stable with exactly one correct choice for every failure', () => {
    for (const key of Object.keys(FAILURE_TEXT) as FailureKey[]) {
      const options = reflectionOptions(key, 'attempt-3', []);
      expect(new Set(options).size).toBe(4);
      expect(options).toContain(key);
      expect(reflectionOptions(key, 'attempt-3', [])).toEqual(options);
    }
  });
});
