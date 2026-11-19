import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { BLOCKS } from '../data/blocks';
import type { BlockType } from '../types';
import Block from './Block';

function PaletteItem({ type, used, onAdd, onHover }: { type: BlockType; used: boolean; onAdd: () => void; onHover: (t: BlockType | null) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}`, data: { from: 'palette', type }, disabled: used });
  const def = BLOCKS[type];
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={used ? `${def.label} (already in your helper)` : `Add ${def.label}`}
      aria-disabled={used}
      onClick={() => !used && onAdd()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !used) { e.preventDefault(); onAdd(); }
        else listeners?.onKeyDown?.(e);
      }}
      onMouseEnter={() => onHover(type)}
      onFocus={() => onHover(type)}
      className={`rounded ${used ? 'cursor-not-allowed' : 'touch-none cursor-grab active:cursor-grabbing hover:translate-x-1'} transition-transform ${isDragging ? 'opacity-30' : ''}`}
      data-testid={`palette-${type}`}
    >
      <Block kind={type} label={def.label} color={def.color} textColor={def.effect === 'control' ? '#16161A' : undefined} width={250} dim={used} />
    </div>
  );
}

export default function Palette({ blocks, used, onAdd, credits, control = [] }: { blocks: BlockType[]; used: Set<BlockType>; onAdd: (t: BlockType) => void; credits?: (t: BlockType) => number; control?: BlockType[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'palette' });
  const [hover, setHover] = useState<BlockType | null>(null);
  const info = hover ? BLOCKS[hover] : null;
  return (
    <aside id="workbench-palette" tabIndex={-1} ref={setNodeRef} className={`rounded-md border-1.5 p-4 transition-colors ${isOver ? 'border-fail bg-fail-soft' : 'border-ink bg-paper-card'}`} aria-label="Safeguard blocks">
      <h2 className="text-lg font-extrabold">Blocks</h2>
      <p className="text-sm text-ink-2 mb-4">Drag a block into your helper, or click it. Drag it back here to take it out.</p>
      {control.length > 0 && (
        <div className="mb-4 pb-4 border-b-1.5 border-dashed border-line">
          <h3 className="label text-ink-2 mb-2">Control (Level 2)</h3>
          <div className="flex flex-col gap-2.5">
            {control.map((t) => (
              <PaletteItem key={t} type={t} used={false} onAdd={() => onAdd(t)} onHover={setHover} />
            ))}
          </div>
          <p className="text-xs text-ink-2 mt-2 leading-snug">Drop a safeguard inside an IF (or click it to fill the newest empty IF) so it only runs when it is needed.</p>
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {blocks.map((t) => (
          <div key={t}><PaletteItem type={t} used={used.has(t)} onAdd={() => onAdd(t)} onHover={setHover} />
            {credits && <span className="text-xs font-mono">{credits(t)} credits</span>}</div>
        ))}
      </div>
      {/* Fixed height: a hint box that resized on hover made the page jump. */}
      <div className="mt-4 h-[150px] overflow-hidden border-t-1.5 border-dashed border-line pt-3 text-sm" aria-live="polite" data-testid="block-hint">
        {info ? (
          <>
            <div className="font-bold">{info.label}</div>
            <div className="text-ink-2 mt-0.5 leading-snug">{info.hint}</div>
          </>
        ) : (
          <div className="text-ink-3 leading-snug">Point at a block to see what it does. Think about where in the order it should go.</div>
        )}
      </div>
    </aside>
  );
}
