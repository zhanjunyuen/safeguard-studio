import { Sparkles } from 'lucide-react';

/** Marks who wrote a piece of feedback: the Adaption AI or the offline preview. Used on every AI feature. */
export default function AiBadge({ ai, className = '' }: { ai: boolean; className?: string }) {
  return ai
    ? <span className={`inline-flex items-center gap-1 rounded-sm border-1.5 border-ink bg-signal px-1.5 py-0.5 text-xs font-bold ${className}`}><Sparkles size={12} aria-hidden /> AI marker</span>
    : <span className={`inline-flex items-center rounded-sm border-1.5 border-line bg-paper px-1.5 py-0.5 text-xs font-bold text-ink-2 ${className}`}>Offline preview</span>;
}
