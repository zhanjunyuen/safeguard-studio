import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { BLOCKS, REPLY_COLOR, TRIGGER_COLOR } from '../data/blocks';
import type { CondId, ScriptBlock, StepStatus } from '../types';
import Block from './Block';
import IfBlock from './IfBlock';

export const STACK_W = 320;

export interface IfHandlers {
  onCond: (uid: string, c: CondId) => void;
  onClearSlot: (uid: string, which: 'then' | 'else') => void;
}

function SortableBlock({ b, highlight, highlights, onRemove, locked, ifh }: { b: ScriptBlock; highlight: StepStatus | null; highlights: Record<string, StepStatus>; onRemove: () => void; locked: boolean; ifh?: IfHandlers }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: b.uid, data: { from: 'stack' }, disabled: locked });
  const def = BLOCKS[b.type];
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
    >
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
        {...attributes}
        {...listeners}
        aria-label={`${def.label}. Drag to reorder.`}
        className={`group rounded ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
        data-testid={`stack-${b.type}`}
      >
        {(b.type === 'if' || b.type === 'ifelse') && ifh ? (
          <IfBlock
            b={b}
            width={STACK_W}
            highlights={highlights}
            onCond={(c) => ifh.onCond(b.uid, c)}
            onClear={(w) => ifh.onClearSlot(b.uid, w)}
            onRemove={onRemove}
            locked={locked}
          />
        ) : (
          <Block
            kind={b.type}
            label={def.label}
            color={def.color}
            width={STACK_W}
            highlight={highlight}
            right={
              def.removable && !locked ? (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={onRemove}
                  className="grid place-items-center w-8 h-8 -mr-1 rounded text-white/70 hover:text-white hover:bg-black/25 focus-visible:text-white"
                  aria-label={`Remove ${def.label}`}
                >
                  <X size={16} aria-hidden />
                </button>
              ) : b.type === 'ask_ai' ? (
                <span className="label text-white/75 text-[10px]">can move</span>
              ) : null
            }
          />
        )}
      </div>
    </motion.div>
  );
}

function Cap({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`relative rounded transition ${isOver ? 'outline outline-2 outline-dashed outline-ink outline-offset-4' : ''}`}>
      {children}
    </div>
  );
}

export default function ScriptStack({
  script,
  highlights,
  onRemove,
  locked,
  ifh,
}: {
  script: ScriptBlock[];
  highlights: Record<string, StepStatus>;
  onRemove: (uid: string) => void;
  locked: boolean;
  ifh?: IfHandlers;
}) {
  return (
    <div className="flex flex-col items-start" aria-label="Your helper, in order">
      <Cap id="stack-start">
        <Block kind="trigger" shape="hat" label="When someone asks…" color={TRIGGER_COLOR} textColor="#16161A" width={STACK_W} highlight={highlights.trigger ?? null} />
      </Cap>
      <SortableContext items={script.map((b) => b.uid)} strategy={verticalListSortingStrategy}>
        <AnimatePresence initial={false}>
          {script.map((b) => (
            <SortableBlock key={b.uid} b={b} highlight={highlights[b.uid] ?? null} highlights={highlights} onRemove={() => onRemove(b.uid)} locked={locked} ifh={ifh} />
          ))}
        </AnimatePresence>
      </SortableContext>
      <Cap id="stack-end">
        <Block kind="reply" shape="cap" label="Reply to them" color={REPLY_COLOR} width={STACK_W} highlight={highlights.reply ?? null} />
        <div className="h-16 w-full" />
      </Cap>
    </div>
  );
}
