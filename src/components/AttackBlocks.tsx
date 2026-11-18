import { useDraggable, useDroppable } from '@dnd-kit/core';
import { X, Zap } from 'lucide-react';
import { ATTACK_BUDGET } from '../engine/breaker';
import Block from './Block';
import { STACK_W } from './ScriptStack';

export const ATTACK_COLOR = '#2A2A33';
export const ATTACK_ICON_COLOR = '#FFC629';

export function AttackItem({ id, label, used, full, onAdd }: { id: string; label: string; used: boolean; full: boolean; onAdd: () => void }) {
  const disabled = used || full;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `attack:${id}`, data: { testId: id }, disabled });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={used ? `${label} (in your plan)` : `Add attack: ${label}`}
      aria-disabled={disabled}
      onClick={() => !disabled && onAdd()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !disabled) { e.preventDefault(); onAdd(); }
        else listeners?.onKeyDown?.(e);
      }}
      className={`rounded ${disabled ? 'cursor-not-allowed' : 'touch-none cursor-grab hover:translate-x-1'} transition-transform ${isDragging ? 'opacity-30' : ''}`}
      data-testid={`attack-${id}`}
    >
      <Block kind="attack" icon={Zap} iconColor={ATTACK_ICON_COLOR} label={label} color={ATTACK_COLOR} width={250} dim={used} />
    </div>
  );
}

export function Plan({ plan, labels, onRemove, locked }: { plan: string[]; labels: Record<string, string>; onRemove: (id: string) => void; locked: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'plan' });
  return (
    <div ref={setNodeRef} className={`w-full rounded-md border-1.5 border-dashed p-3 transition-colors ${isOver ? 'border-ink bg-signal-soft' : 'border-ink/40 bg-paper-card/70'}`} style={{ maxWidth: STACK_W + 24 }}>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-extrabold">Your attack plan</h2>
        <span className="font-mono text-sm text-ink-2">{plan.length}/{ATTACK_BUDGET}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {plan.map((id) => (
          <div key={id} data-testid={`plan-${id}`}>
            <Block
              kind="attack"
              icon={Zap}
              iconColor={ATTACK_ICON_COLOR}
              label={labels[id]}
              color={ATTACK_COLOR}
              width={STACK_W}
              right={
                !locked && (
                  <button onClick={() => onRemove(id)} className="grid place-items-center w-8 h-8 -mr-1 rounded text-white/70 hover:text-white hover:bg-white/15" aria-label={`Remove ${labels[id]}`}>
                    <X size={16} aria-hidden />
                  </button>
                )
              }
            />
          </div>
        ))}
        {Array.from({ length: ATTACK_BUDGET - plan.length }).map((_, i) => (
          <div key={i} className={`h-[46px] rounded border-1.5 border-dashed grid place-items-center text-sm text-ink-3 transition-colors ${isOver && i === 0 ? 'border-ink bg-signal-soft' : 'border-line'}`}>Drop an attack here</div>
        ))}
      </div>
    </div>
  );
}
