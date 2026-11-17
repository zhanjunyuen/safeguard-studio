import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { BLOCKS, REPLY_COLOR, TRIGGER_COLOR } from '../data/blocks';
import type { ScriptBlock, StepStatus } from '../types';
import Block from './Block';

export const STACK_W = 320;

function SortableBlock({ b, highlight, onRemove, locked }: { b: ScriptBlock; highlight: StepStatus | null; onRemove: () => void; locked: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: b.uid, data: { from: 'stack' }, disabled: locked });
  const def = BLOCKS[b.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -30, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 30, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
        {...attributes}
        {...listeners}
        className={`group ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
        data-testid={`stack-${b.type}`}
      >
        <Block
          label={def.label}
          icon={def.icon}
          color={def.color}
          width={STACK_W}
          highlight={highlight}
          right={
            def.removable && !locked ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onRemove}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-black/25 hover:bg-black/40 text-white text-sm leading-none transition"
                aria-label={`Remove ${def.label}`}
              >
                ×
              </button>
            ) : b.type === 'ask_ai' ? (
              <span className="text-[10px] uppercase tracking-wider opacity-80">movable</span>
            ) : null
          }
        />
      </div>
    </motion.div>
  );
}

function Cap({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`relative rounded-xl transition ${isOver ? 'ring-4 ring-violet-300/70' : ''}`}>
      {children}
    </div>
  );
}

export default function ScriptStack({
  script,
  highlights,
  onRemove,
  locked,
}: {
  script: ScriptBlock[];
  highlights: Record<string, StepStatus>;
  onRemove: (uid: string) => void;
  locked: boolean;
}) {
  return (
    <div className="flex flex-col items-start">
      <Cap id="stack-start">
        <Block shape="hat" label="When someone asks…" icon="💬" color={TRIGGER_COLOR} textColor="#3b2a00" width={STACK_W} highlight={highlights.trigger ?? null} />
      </Cap>
      <SortableContext items={script.map((b) => b.uid)} strategy={verticalListSortingStrategy}>
        <AnimatePresence initial={false}>
          {script.map((b) => (
            <SortableBlock key={b.uid} b={b} highlight={highlights[b.uid] ?? null} onRemove={() => onRemove(b.uid)} locked={locked} />
          ))}
        </AnimatePresence>
      </SortableContext>
      <Cap id="stack-end">
        <Block shape="cap" label="Reply to them" icon="📤" color={REPLY_COLOR} width={STACK_W} highlight={highlights.reply ?? null} />
        <div className="h-16 w-full" />
      </Cap>
    </div>
  );
}
