import { describe, expect, it } from 'vitest';
import { getChallenge } from '../data/challenges';
import type { ScriptBlock } from '../types';
import { usefulnessAdvice } from './advice';
import { runChallenge } from './run';

const lin = (...t: string[]): ScriptBlock[] => t.map((type, i) => ({ uid: `${type}-${i}`, type }));

describe('usefulness advice', () => {
  it('on Level 2, points at always-on safeguards and suggests an IF', () => {
    // the helper from the screenshot: everything always on
    const s = lin('coach', 'both_sides', 'remove_pii', 'ask_ai', 'check_source');
    const rep = runChallenge(s, getChallenge('history@2')!);
    const a = usefulnessAdvice(s, rep, true, getChallenge('history@2')!);
    expect(a).toMatch(/IF … THEN/);
    expect(a).toMatch(/only helped on/);
    expect(a).toMatch(/What do/);
    expect(a).not.toMatch(/Take out/);
  });
  it('on Level 1, names a block that never helped', () => {
    const s = lin('remove_pii', 'coach', 'both_sides', 'ask_ai', 'check_source', 'warn_note');
    const a = usefulnessAdvice(s, runChallenge(s, getChallenge('history')!), false);
    expect(a).toMatch(/“Add "AI can be wrong" note” never changed a single answer/);
  });
});
