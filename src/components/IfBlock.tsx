import { useDroppable } from '@dnd-kit/core';
import { X } from 'lucide-react';
import { BLOCK_COLORS, BLOCKS } from '../data/blocks';
import { COND_ORDER, CONDITIONS } from '../engine/conditions';
import type { CondId, ScriptBlock, StepStatus } from '../types';
import Block from './Block';
import { BLOCK_ICON } from './icons';

const C = BLOCK_COLORS.control;
/** Geometry matches Block.tsx so notches and tabs line up exactly. */
const ARM = 20; // width of the C's left arm
const HEAD = 46; // header bar (and the height of one inner block)
const MOUTH = 46; // one inner block fits exactly
const ELSE_BAR = 30;
const FOOT = 22;
const R = 5;

const GLOW: Record<StepStatus, string> = { ok: '#16161A', acted: '#1F7A3E', warn: '#E0A100', stop: '#C2362B', skip: '#9CA3AF' };

/** One Scratch-style C shape: notched top, a tab dropping into each mouth, an indent for each inner block's tab, and a tab at the bottom. */
function cPath(w: number, twoMouths: boolean) {
  const tabDown = (y: number) => `H${ARM + 36} L${ARM + 32} ${y + 4} H${ARM + 16} L${ARM + 12} ${y} H${ARM}`; // going left
  const notchIn = (y: number) => `H${ARM + 12} L${ARM + 16} ${y + 4} H${ARM + 32} L${ARM + 36} ${y}`; // going right
  const barRight = (top: number, bottom: number) => `H${w - R} Q${w} ${top} ${w} ${top + R} V${bottom - R} Q${w} ${bottom} ${w - R} ${bottom}`;
  let d = `M0 ${R} Q0 0 ${R} 0 H12 L16 4 H32 L36 0 H${w - R} Q${w} 0 ${w} ${R} V${HEAD - R} Q${w} ${HEAD} ${w - R} ${HEAD} ${tabDown(HEAD)}`;
  let y = HEAD + MOUTH;
  d += ` V${y}`;
  if (twoMouths) {
    d += ` ${notchIn(y)} ${barRight(y, y + ELSE_BAR)} ${tabDown(y + ELSE_BAR)}`;
    y += ELSE_BAR + MOUTH;
    d += ` V${y}`;
  }
  const total = y + FOOT;
  d += ` ${notchIn(y)} H${w - R} Q${w} ${y} ${w} ${y + R} V${total - R} Q${w} ${total} ${w - R} ${total} H36 L32 ${total + 4} H16 L12 ${total} H${R} Q0 ${total} 0 ${total - R} Z`;
  return { d, total };
}

function Slot({ id, child, top, width, highlight, onClear, locked }: { id: string; child?: ScriptBlock | null; top: number; width: number; highlight: StepStatus | null; onClear: () => void; locked: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="absolute" style={{ left: ARM, top, width, height: MOUTH }} data-testid={id}>
      {child ? (
        <Block
          kind={child.type}
          label={BLOCKS[child.type].label}
          color={BLOCKS[child.type].color}
          width={width}
          highlight={highlight}
          right={
            !locked && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onClick={onClear}
                className="grid place-items-center w-8 h-8 -mr-1 rounded text-white/70 hover:text-white hover:bg-black/25"
                aria-label={`Take ${BLOCKS[child.type].label} out of the IF`}
              >
                <X size={16} aria-hidden />
              </button>
            )
          }
        />
      ) : (
        <div
          className={`absolute inset-x-1.5 inset-y-1 rounded border-1.5 border-dashed grid place-items-center text-sm font-bold ${isOver ? 'border-ink bg-signal-soft text-ink' : 'border-ink/50 bg-paper-card/90 text-ink-2'}`}
        >
          Drop a safeguard here
        </div>
      )}
      {child && isOver && <div className="absolute inset-0 rounded outline outline-2 outline-dashed outline-ink pointer-events-none" />}
    </div>
  );
}

export default function IfBlock({
  b,
  width,
  highlights,
  onCond,
  onClear,
  onRemove,
  locked,
}: {
  b: ScriptBlock;
  width: number;
  highlights: Record<string, StepStatus>;
  onCond: (c: CondId) => void;
  onClear: (which: 'then' | 'else') => void;
  onRemove: () => void;
  locked: boolean;
}) {
  const Icon = BLOCK_ICON[b.type];
  const hl = highlights[b.uid] ?? null;
  const two = b.type === 'ifelse';
  const { d, total } = cPath(width, two);
  const inner = width - ARM;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="relative select-none" style={{ width, height: total }}>
      <svg width={width} height={total + 5} className="absolute inset-0 overflow-visible" aria-hidden>
        {hl && <path d={d} fill="none" stroke={GLOW[hl]} strokeWidth={9} strokeLinejoin="round" className="glow" />}
        <path d={d} fill={C} stroke="#16161A" strokeOpacity={0.55} strokeWidth={1.5} />
      </svg>

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 font-bold text-[15px] text-ink" style={{ height: HEAD }}>
        <Icon size={18} strokeWidth={2.25} aria-hidden className="shrink-0" />
        <span>IF</span>
        <select
          value={b.cond ?? 'person'}
          disabled={locked}
          onPointerDown={stop}
          onKeyDown={stop}
          onChange={(e) => onCond(e.target.value as CondId)}
          className="min-w-0 flex-1 rounded bg-white/85 border border-ink/40 px-1.5 py-1 text-[14px] font-bold text-ink"
          aria-label="Condition"
          data-testid="if-cond"
        >
          {COND_ORDER.map((c) => (
            <option key={c} value={c}>{CONDITIONS[c].label}</option>
          ))}
        </select>
        <span>THEN</span>
        {!locked && (
          <button onPointerDown={stop} onKeyDown={stop} onClick={onRemove} className="grid place-items-center w-7 h-7 -mr-1 rounded hover:bg-black/10" aria-label="Remove this IF block">
            <X size={16} aria-hidden />
          </button>
        )}
      </div>

      <Slot id={`slot:${b.uid}:then`} child={b.then} top={HEAD} width={inner} highlight={b.then ? highlights[b.then.uid] ?? null : null} onClear={() => onClear('then')} locked={locked} />

      {two && (
        <>
          <div className="absolute flex items-center font-bold text-[15px] text-ink" style={{ top: HEAD + MOUTH, height: ELSE_BAR, left: ARM + 12 }}>
            ELSE
          </div>
          <Slot
            id={`slot:${b.uid}:else`}
            child={b.else}
            top={HEAD + MOUTH + ELSE_BAR}
            width={inner}
            highlight={b.else ? highlights[b.else.uid] ?? null : null}
            onClear={() => onClear('else')}
            locked={locked}
          />
        </>
      )}
    </div>
  );
}
