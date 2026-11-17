import type { ReactNode } from 'react';
import type { StepStatus } from '../types';

export type BlockShape = 'stack' | 'hat' | 'cap';

const H = 46;
const HAT = 14;

function path(w: number, shape: BlockShape) {
  const top = shape === 'hat' ? HAT : 0;
  const h = top + H;
  const r = 6;
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
  ok: '#ffffff',
  acted: '#22C55E',
  warn: '#F59E0B',
  stop: '#EF4444',
  skip: '#94A3B8',
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

interface Props {
  label: ReactNode;
  icon?: string;
  color: string;
  textColor?: string;
  width?: number;
  shape?: BlockShape;
  highlight?: StepStatus | null;
  dim?: boolean;
  right?: ReactNode;
  title?: string;
}

export default function Block({ label, icon, color, textColor = '#fff', width = 300, shape = 'stack', highlight, dim, right, title }: Props) {
  const { d, h, top } = path(width, shape);
  return (
    <div className="relative select-none" style={{ width, height: h, opacity: dim ? 0.4 : 1 }} title={title}>
      <svg width={width} height={h + 5} className="absolute inset-0 overflow-visible" aria-hidden>
        {highlight && (
          <path d={d} fill="none" stroke={GLOW[highlight]} strokeWidth={10} strokeLinejoin="round" className="glow" style={{ filter: `drop-shadow(0 0 8px ${GLOW[highlight]})` }} />
        )}
        <path d={d} fill={color} stroke={shade(color, -40)} strokeWidth={1.5} />
      </svg>
      <div
        className="absolute inset-x-0 flex items-center gap-2 px-3 font-bold text-[15px] leading-tight block-text"
        style={{ top, height: H, color: textColor, textShadow: textColor === '#fff' ? undefined : 'none' }}
      >
        {icon && <span className="text-lg shrink-0" aria-hidden>{icon}</span>}
        <span className="flex-1 min-w-0">{label}</span>
        {right}
      </div>
    </div>
  );
}
