import { useDroppable } from '@dnd-kit/core';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { BLOCK_COLORS, BLOCKS } from '../data/blocks';
import { COND_ORDER, CONDITIONS } from '../engine/conditions';
import type { CondId, ScriptBlock, StepStatus } from '../types';
import Block from './Block';
import { BLOCK_ICON } from './icons';

const C = BLOCK_COLORS.control;
const ARM = 18;

const GLOW: Record<StepStatus, string> = { ok: '#16161A', acted: '#1F7A3E', warn: '#E0A100', stop: '#C2362B', skip: '#9CA3AF' };

function Slot({ id, child, width, highlight, onClear, locked }: { id: string; child?: ScriptBlock | null; width: number; highlight: StepStatus | null; onClear: () => void; locked: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[50px] py-1 rounded-sm ${isOver ? 'outline outline-2 outline-dashed outline-ink' : ''}`} data-testid={id}>
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
        <div className="h-[46px] rounded border-1.5 border-dashed border-ink/50 bg-paper-card/80 grid place-items-center text-sm font-bold text-ink-2" style={{ width }}>
          Drop a safeguard here
        </div>
      )}
    </div>
  );
}

function Bar({ children, top, bottom, glow }: { children?: ReactNode; top?: boolean; bottom?: boolean; glow?: string | null }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 font-bold text-[15px] text-ink border-1.5 border-ink/55 ${top ? 'rounded-t-[5px] h-[46px]' : ''} ${bottom ? 'rounded-b-[5px] h-[18px]' : ''} ${!top && !bottom ? 'h-[36px] border-t-0 border-b-0' : ''}`}
      style={{ background: C, boxShadow: glow ? `0 0 0 4px ${glow}` : undefined }}
    >
      {children}
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
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div style={{ width }} className="select-none">
      <Bar top glow={hl ? GLOW[hl] : null}>
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
      </Bar>
      <div className="flex">
        <div style={{ width: ARM, background: C }} className="border-l-1.5 border-ink/55" />
        <div className="pl-1.5">
          <Slot id={`slot:${b.uid}:then`} child={b.then} width={width - ARM - 6} highlight={b.then ? highlights[b.then.uid] ?? null : null} onClear={() => onClear('then')} locked={locked} />
        </div>
      </div>
      {b.type === 'ifelse' && (
        <>
          <Bar>ELSE</Bar>
          <div className="flex">
            <div style={{ width: ARM, background: C }} className="border-l-1.5 border-ink/55" />
            <div className="pl-1.5">
              <Slot id={`slot:${b.uid}:else`} child={b.else} width={width - ARM - 6} highlight={b.else ? highlights[b.else.uid] ?? null : null} onClear={() => onClear('else')} locked={locked} />
            </div>
          </div>
        </>
      )}
      <Bar bottom />
    </div>
  );
}
