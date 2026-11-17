import type { ReactNode } from 'react';
import type { BlockType, StepStatus } from '../types';
import { BLOCK_ICON } from './icons';

export type BlockShape = 'stack' | 'hat' | 'cap';

const H = 46;
const HAT = 14;

function path(w: number, shape: BlockShape) {
  const top = shape === 'hat' ? HAT : 0;
  const h = top + H;
  const r = 5;
  const topEdge =
    shape === 'hat'
      ? `M0 ${top + 4} C 18 ${-4}, 74 ${-4}, 96 ${top} H${w - r} Q${w} ${top} ${w} ${top + r}`
      : `M0 ${r} Q0 0 ${r} 0 H12 L16 4 H32 L36 0 H${w - r} Q${w} 0 ${w} ${r}`;
  const bottomEdge =
    shape === 'cap'
      ? `V${h - r} Q${w} ${h} ${w - r} ${h} H${r} Q0 ${h} 0 ${h - r} Z`
      : `V${h - r} Q${w} ${h} ${w - r} ${h} H36 L32 ${h + 4} H16 L12 ${h} H${r} Q0 ${h} 0 ${h - r} Z`;
  return { d: `${topEdge} ${bottomEdge}`, h, top };
}

const GLOW: Record<StepStatus, string> = {
  ok: '#16161A',
  acted: '#1F7A3E',
  warn: '#E0A100',
  stop: '#C2362B',
  skip: '#9CA3AF',
};

interface Props {
  label: ReactNode;
  kind: BlockType | 'trigger' | 'reply';
  color: string;
  textColor?: string;
  width?: number;
  shape?: BlockShape;
  highlight?: StepStatus | null;
  dim?: boolean;
  right?: ReactNode;
}

export default function Block({ label, kind, color, textColor = '#fff', width = 300, shape = 'stack', highlight, dim, right }: Props) {
  const { d, h, top } = path(width, shape);
  const Icon = BLOCK_ICON[kind];
  return (
    <div className="relative select-none" style={{ width, height: h, opacity: dim ? 0.35 : 1 }}>
      <svg width={width} height={h + 5} className="absolute inset-0 overflow-visible" aria-hidden>
        {highlight && <path d={d} fill="none" stroke={GLOW[highlight]} strokeWidth={9} strokeLinejoin="round" className="glow" />}
        <path d={d} fill={color} stroke="#16161A" strokeOpacity={0.55} strokeWidth={1.5} />
      </svg>
      <div className="absolute inset-x-0 flex items-center gap-2.5 px-3 font-bold text-[15px] leading-tight" style={{ top, height: H, color: textColor }}>
        <Icon size={18} strokeWidth={2.25} aria-hidden className="shrink-0" />
        <span className="flex-1 min-w-0">{label}</span>
        {right}
      </div>
    </div>
  );
}
