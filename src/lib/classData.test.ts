import { describe, expect, it } from 'vitest';
import { groupClassRows, type RunRow } from './classData';

const row = (o: Partial<RunRow>): RunRow => ({
  student_id: 's1', display_name: 'Sam', challenge_id: 'history', mode: 'build', script: ['ask_ai'],
  results: [], scores: null, reflection: null, created_at: '2026-11-17T10:00:00Z', ...o,
});

describe('groupClassRows', () => {
  it('maps build, reflect and break rows onto the local shapes', () => {
    const scores = { verification: 0, privacy: 0, integrity: 0, bias: 0, usefulness: 100 };
    const out = groupClassRows([
      row({ results: [{ testId: 'h_date', outcome: 'fail', failureKey: 'hallucination_unchecked' }], scores }),
      row({ mode: 'reflect', reflection: { testId: 'h_date', expected: 'hallucination_unchecked', chosen: 'hallucination_unchecked', correct: true, text: '' } }),
      row({ mode: 'break', script: ['h_address', 'h_date'], results: ['h_address'] }),
      row({ student_id: 's2', display_name: 'Ana', challenge_id: 'party', scores }),
    ]);
    expect(out.map((s) => s.name)).toEqual(['Sam', 'Ana']);
    const sam = out[0];
    expect(sam.progress.history.attempts).toHaveLength(1);
    expect(sam.progress.history.reflections[0]).toMatchObject({ attempt: 1, correct: true });
    expect(sam.breaks.history[0]).toMatchObject({ attacks: ['h_address', 'h_date'], broke: ['h_address'] });
  });
});
