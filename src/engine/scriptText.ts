import { BLOCKS } from '../data/blocks';
import type { CondId, ScriptBlock } from '../types';
import { CONDITIONS } from './conditions';

/** One string per top-level block, used in saved attempts and the database. IF blocks keep their contents. */
export function blockKey(b: ScriptBlock): string {
  if (b.type === 'if' || b.type === 'ifelse') return `${b.type}:${b.cond ?? 'person'}:${b.then?.type ?? ''}:${b.else?.type ?? ''}`;
  return b.type;
}

/** Human-readable label for a saved block key. */
export function labelOf(key: string): string {
  if (key.startsWith('if:') || key.startsWith('ifelse:')) {
    const [kind, cond, then, els] = key.split(':');
    const c = CONDITIONS[cond as CondId]?.label ?? cond;
    const t = then ? BLOCKS[then]?.label ?? then : 'nothing';
    return kind === 'ifelse' ? `IF ${c} THEN ${t} ELSE ${els ? BLOCKS[els]?.label ?? els : 'nothing'}` : `IF ${c} THEN ${t}`;
  }
  return BLOCKS[key]?.label ?? key;
}

/**
 * The inverse of blockKey: rebuilds a runnable block from a saved key, so saved attempts and frozen
 * assessment builds keep their IF blocks. A plain block type passes straight through.
 */
export function keyToBlock(key: string, uid: string): ScriptBlock {
  if (key.startsWith('if:') || key.startsWith('ifelse:')) {
    const [kind, cond, then, els] = key.split(':');
    return {
      uid,
      type: kind as 'if' | 'ifelse',
      cond: (cond || 'person') as CondId,
      then: then ? { uid: `${uid}-then`, type: then as ScriptBlock['type'] } : null,
      else: kind === 'ifelse' && els ? { uid: `${uid}-else`, type: els as ScriptBlock['type'] } : null,
    };
  }
  return { uid, type: key as ScriptBlock['type'] };
}
