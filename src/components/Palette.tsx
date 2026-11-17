import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import { BLOCKS, PALETTE_ORDER } from '../data/blocks';
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
      onClick={() => !used && onAdd()}
      onMouseEnter={() => onHover(type)}
      onMouseLeave={() => onHover(null)}
      className={`${used ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5'} transition-transform ${isDragging ? 'opacity-30' : ''}`}
      data-testid={`palette-${type}`}
    >
      <Block label={def.label} icon={def.icon} color={def.color} width={250} dim={used} />
    </div>
  );
}

export default function Palette({ used, onAdd }: { used: Set<BlockType>; onAdd: (t: BlockType) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'palette' });
  const [hover, setHover] = useState<BlockType | null>(null);
  const info = hover ? BLOCKS[hover] : null;
  return (
    <aside ref={setNodeRef} className={`rounded-3xl bg-white border-2 p-4 transition ${isOver ? 'border-rose-300 bg-rose-50' : 'border-indigo-100'}`}>
      <h3 className="font-display text-lg font-extrabold">Safeguard blocks</h3>
      <p className="text-xs text-indigo-900/60 mb-3">Drag into your helper, or click to add. Drag back here to remove.</p>
      <div className="flex flex-col gap-2.5">
        {PALETTE_ORDER.map((t) => (
          <PaletteItem key={t} type={t} used={used.has(t)} onAdd={() => onAdd(t)} onHover={setHover} />
        ))}
      </div>
      <div className="mt-4 min-h-[88px] rounded-2xl bg-indigo-50/70 p-3 text-sm">
        {info ? (
          <>
            <div className="font-extrabold">{info.icon} {info.label}</div>
            <div className="text-indigo-900/75 mt-0.5">{info.hint}</div>
          </>
        ) : (
          <div className="text-indigo-900/50">Hover a block to see what it does. Think about <b>where</b> in the flow it should go.</div>
        )}
      </div>
    </aside>
  );
}
