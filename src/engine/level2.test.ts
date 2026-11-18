import { describe, expect, it } from 'vitest';
import { BLOCKS } from '../data/blocks';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { LEVEL2 } from '../data/level2';
import type { ScriptBlock } from '../types';
import { runChallenge, runProgram } from './run';
import { idealScript, usefulnessTarget } from './targets';

const lin = (types: string[]): ScriptBlock[] => types.map((type, i) => ({ uid: `${type}-${i}`, type }));

/** "Add every safeguard": every non-refusing block, before-blocks before Ask AI and checks after. */
function everything(id: string): ScriptBlock[] {
  const c = getChallenge(id)!;
  const safe = c.palette.filter((t) => !BLOCKS[t].effect.startsWith('block'));
  const before = safe.filter((t) => ['before', 'either', 'anywhere'].includes(BLOCKS[t].position) && BLOCKS[t].effect !== 'warn' && BLOCKS[t].effect !== 'flag');
  const after = safe.filter((t) => !before.includes(t));
  return lin([...before, 'ask_ai', ...after]);
}

describe('usefulness target (Level 1)', () => {
  it.each(CHALLENGES.map((c) => [c.id] as const))('%s: ideal meets the target, "add every safeguard" does not', (id) => {
    const c = getChallenge(id)!;
    expect(runChallenge(idealScript(id), c).scores.usefulness).toBeGreaterThanOrEqual(usefulnessTarget(id));
    expect(runChallenge(everything(id), c).scores.usefulness).toBeLessThan(usefulnessTarget(id));
  });
});

describe('Level 2', () => {
  it('every challenge has a Level 2', () => {
    for (const c of CHALLENGES) expect(LEVEL2[c.id], c.id).toBeDefined();
  });
  it.each(CHALLENGES.map((c) => [c.id] as const))('%s: the IF-based ideal passes all 7 tests and hits the target', (id) => {
    const l2 = getChallenge(`${id}@2`)!;
    const rep = runChallenge(idealScript(`${id}@2`), l2);
    expect(rep.results.filter((r) => r.outcome !== 'pass').map((r) => r.testId)).toEqual([]);
    expect(rep.total).toBe(7);
    expect(rep.scores.usefulness).toBeGreaterThanOrEqual(usefulnessTarget(`${id}@2`));
  });
  it.each(CHALLENGES.map((c) => [c.id] as const))('%s: the always-on Level 1 helper is not enough for Level 2', (id) => {
    const l2 = getChallenge(`${id}@2`)!;
    const rep = runChallenge(idealScript(id), l2);
    const passedAll = rep.results.every((r) => r.outcome === 'pass');
    expect(passedAll && rep.scores.usefulness >= usefulnessTarget(`${id}@2`)).toBe(false);
  });
  it('the edge case slips past the obvious condition', () => {
    const l2 = getChallenge('history@2')!;
    const edge = l2.tests.find((t) => t.id === 'h2_street')!;
    const byName: ScriptBlock[] = [{ uid: 'i', type: 'if', cond: 'person', then: { uid: 'p', type: 'remove_pii' } }, { uid: 'a', type: 'ask_ai' }];
    const byNumber: ScriptBlock[] = [{ uid: 'i', type: 'if', cond: 'numbers', then: { uid: 'p', type: 'remove_pii' } }, { uid: 'a', type: 'ask_ai' }];
    expect(runProgram(byName, edge).failureKey).toBe('pii_sent');
    expect(runProgram(byNumber, edge).outcome).toBe('pass');
  });
  it('"the AI isn\'t sure" never fires, because the AI always sounds confident', () => {
    const t = getChallenge('history')!.tests.find((x) => x.id === 'h_date')!;
    const s: ScriptBlock[] = [{ uid: 'a', type: 'ask_ai' }, { uid: 'i', type: 'if', cond: 'ai_unsure', then: { uid: 'c', type: 'check_source' } }];
    expect(runProgram(s, t).failureKey).toBe('hallucination_unchecked');
  });
  it('IF blocks only cost usefulness when they fire', () => {
    const h = getChallenge('history')!;
    const always = runChallenge(lin(['remove_pii', 'ask_ai']), h).scores.usefulness;
    const onlyIf = runChallenge([{ uid: 'i', type: 'if', cond: 'numbers', then: { uid: 'p', type: 'remove_pii' } }, { uid: 'a', type: 'ask_ai' }], h).scores.usefulness;
    expect(onlyIf).toBeGreaterThan(always);
  });
});
