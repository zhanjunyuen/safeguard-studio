import { baseId, getChallenge, isLevel2 } from '../data/challenges';
import { LEVEL2, toScript } from '../data/level2';
import type { ScriptBlock } from '../types';
import { runChallenge } from './run';

const cache = new Map<string, number>();

/** A helper that passes everything for this challenge id (Level 1 or "id@2"). */
export function idealScript(id: string): ScriptBlock[] {
  if (isLevel2(id)) return toScript(LEVEL2[baseId(id)].ideal);
  return getChallenge(id)!.ideal.map((type, i) => ({ uid: `ideal-${type}-${i}`, type }));
}

/**
 * The usefulness a helper needs to pass. Set 1 point below the ideal helper,
 * so adding safeguards "just in case" pushes you under it. Level 2's ideal uses
 * IF blocks, so its target is higher than any always-on helper can reach.
 */
export function usefulnessTarget(id: string): number {
  if (!cache.has(id)) {
    const ch = getChallenge(id)!;
    cache.set(id, runChallenge(idealScript(id), ch).scores.usefulness - 1);
  }
  return cache.get(id)!;
}
