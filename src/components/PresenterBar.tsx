import { ChevronLeft, ChevronRight, Presentation, RotateCcw, Wand2, X } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_STEPS } from '../data/demoScript';
import { usePresenter } from '../store/presenter';
import { useDemoSession } from '../store/session';

export default function PresenterBar() {
  const nav = useNavigate();
  const { active, step, speed, toggle, go, setSpeed, setActive } = usePresenter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  if (!active) return null;
  const s = DEMO_STEPS[step] ?? DEMO_STEPS[0];

  const goTo = (i: number) => {
    const target = DEMO_STEPS[i];
    if (!target) return;
    target.onEnter?.();
    go(i);
    nav(target.path);
  };

  const reset = () => {
    useDemoSession.getState().resetAll();
    go(0);
    nav('/');
  };

  return (
    <div role="region" aria-label="Presenter controls" className="fixed bottom-0 inset-x-0 z-40 bg-ink text-paper border-t-1.5 border-ink" data-testid="presenter">
      <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3">
        <Presentation size={18} aria-hidden className="text-signal shrink-0" />
        <div className="flex-1 min-w-[260px]">
          <div className="label text-paper/60">Demo · Step {step + 1} of {DEMO_STEPS.length} · {s.title}</div>
          <div className="text-[15px] leading-snug">{s.note}</div>
        </div>
        {s.action && (
          <button onClick={s.action.run} className="inline-flex items-center gap-1.5 rounded border-1.5 border-signal text-signal px-3 py-1.5 text-sm font-bold hover:bg-signal hover:text-ink" data-testid="presenter-action">
            <Wand2 size={15} aria-hidden /> {s.action.label}
          </button>
        )}
        <div className="flex items-center rounded border-1.5 border-paper/40 overflow-hidden text-sm font-mono" role="group" aria-label="Replay speed">
          {([1, 2, 4] as const).map((v) => (
            <button key={v} onClick={() => setSpeed(v)} aria-pressed={speed === v} className={`px-2 py-1 ${speed === v ? 'bg-paper text-ink' : 'hover:bg-paper/10'}`} data-testid={`speed-${v}`}>
              {v}×
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => goTo(step - 1)} disabled={step === 0} className="p-2 rounded hover:bg-paper/10 disabled:opacity-30" aria-label="Previous step"><ChevronLeft size={18} /></button>
          <button onClick={() => goTo(step + 1)} disabled={step >= DEMO_STEPS.length - 1} className="inline-flex items-center gap-1 rounded bg-signal text-ink px-3 py-1.5 font-bold disabled:opacity-30" data-testid="presenter-next">
            Next <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <button onClick={reset} className="inline-flex items-center gap-1 text-sm text-paper/80 hover:text-paper" data-testid="presenter-reset"><RotateCcw size={14} aria-hidden /> Reset demo</button>
        <button onClick={() => setActive(false)} className="p-1.5 rounded hover:bg-paper/10" aria-label="Close presenter mode (Shift+P)"><X size={16} /> Exit demo</button>
      </div>
    </div>
  );
}
