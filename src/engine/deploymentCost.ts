import { BLOCKS } from '../data/blocks';
import type { CondId, ScriptBlock } from '../types';
import { roundCredits, safeguardRate } from './mission';
import { keyToBlock } from './scriptText';

/** Maximum compute reserved for a single live request. Repeated IFs see the same request cues. */
export function deploymentCost(script: ScriptBlock[]): number {
  const conditions = [...new Set(script.flatMap(block =>
    block.type === 'if' || block.type === 'ifelse' ? [block.cond ?? 'person'] : []))];
  const bits = new Map<CondId, number>(conditions.map((condition, i) => [condition, 1 << i]));
  let maximum = 0;
  for (let mask = 0; mask < 2 ** conditions.length; mask++) {
    let cost = 0;
    let answered = false;
    for (const step of script) {
      let block: ScriptBlock | undefined | null = step;
      if (step.type === 'if' || step.type === 'ifelse') {
        const matches = mask & bits.get(step.cond ?? 'person')!;
        block = matches ? step.then : step.type === 'ifelse' ? step.else : null;
      }
      if (!block) continue;
      const def = BLOCKS[block.type];
      if (def.position === 'after' && !answered) continue;
      cost += safeguardRate(block.type, 'deployment');
      if (def.effect === 'ai') answered = true;
      if (def.effect === 'block_all') break;
    }
    maximum = Math.max(maximum, cost);
  }
  return roundCredits(maximum);
}

export function savedDeploymentCost(keys: string[]) {
  return deploymentCost(keys.map((key, i) => keyToBlock(key, String(i))));
}
