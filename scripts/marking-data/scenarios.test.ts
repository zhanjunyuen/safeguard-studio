import { describe, expect, it } from 'vitest';
import { markOffline, type JudgementAnchors } from '../../src/engine/marking';
import { TRANSFER } from '../../src/data/mission';
import scenarios from './transfer-scenarios.json';

/** Release-decision scenarios for training and evaluating the judgement marker (codebook C1–C4). */
const mark = (s: { anchors: JudgementAnchors }, text: string) => markOffline({ criterion: 'judgement', text, decision: 'Edit before publishing', anchors: s.anchors });

describe('transfer scenarios', () => {
  it('has 30+ scenarios with unique ids, and the first is the ecology club pupils see', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(30);
    expect(new Set(scenarios.map(s => s.id)).size).toBe(scenarios.length);
    expect(scenarios[0].source).toBe(TRANSFER.source);
    expect(scenarios.filter(s => s.holdOut).length).toBeGreaterThanOrEqual(4);
  });

  it.each(scenarios.map(s => [s.id, s] as const))('%s: the reference answer scores 2 and the draft scores below 2', (_, s) => {
    const ref = mark(s, s.reference);
    expect(ref.concepts.filter(c => !c.present).map(c => c.id)).toEqual([]);
    expect(ref.level).toBe(2);
    const draft = mark(s, s.reply);
    expect(draft.concepts.find(c => c.id === 'C4')?.present).toBe(false);
    expect(draft.level).toBeLessThan(2);
  });
});
