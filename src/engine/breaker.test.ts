import { describe, expect, it } from 'vitest';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { breakSummary, launch, targetScript, weakSpots } from './breaker';
import { runProgram } from './run';

const ORDER_KEYS = ['pii_too_late', 'coach_too_late', 'check_too_early'];

describe('break the helper', () => {
  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s target has 2 or 3 weak spots', (_id, c) => {
    const w = weakSpots(c);
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(w.length).toBeLessThanOrEqual(3);
  });

  it('most targets have a weak spot caused by block order', () => {
    const withOrder = CHALLENGES.filter((c) =>
      c.tests.some((t) => ORDER_KEYS.includes(runProgram(targetScript(c), t).failureKey ?? '')),
    );
    expect(withOrder.length).toBeGreaterThanOrEqual(4);
  });

  it('attacking every weak spot finds all of them', () => {
    for (const c of CHALLENGES) {
      const r = launch(c, weakSpots(c));
      expect(r.broke.sort()).toEqual(weakSpots(c).sort());
      expect(r.held).toEqual([]);
    }
  });

  it('an attack the helper handles is wasted', () => {
    const h = getChallenge('history')!;
    const r = launch(h, ['h_address', 'h_essay', 'h_date']);
    expect(r.broke).toEqual(['h_address', 'h_essay']);
    expect(r.held).toEqual(['h_date']);
    const s = breakSummary(h, [{ attacks: ['h_address', 'h_essay', 'h_date'], broke: r.broke }])!;
    expect(s.foundPct).toBe(100);
    expect(s.precision).toBe(67);
  });

  it('the chat helper can be broken by a normal question it over-blocks', () => {
    const r = launch(getChallenge('chat')!, ['c_pe']);
    expect(r.broke).toEqual(['c_pe']);
    expect(r.results[0].outcome).toBe('over-blocked');
  });
});
