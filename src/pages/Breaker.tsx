import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ArrowLeft, Lock, RotateCcw, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Block from '../components/Block';
import RunPanel from '../components/RunPanel';
import ScriptStack, { STACK_W } from '../components/ScriptStack';
import { getChallenge } from '../data/challenges';
import { ATTACK_BUDGET, breakSummary, launch, targetScript, weakSpots, type LaunchReport } from '../engine/breaker';
import { useSession } from '../store/session';
import { usePresenter, useReplaySpeed } from '../store/presenter';
import type { StepStatus } from '../types';

const BASE_STEP_MS = 520;
const BASE_PAUSE_MS = 1400;
const ATTACK_COLOR = '#2A2A33';
const ATTACK_ICON_COLOR = '#FFC629';

const collision: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  return p.length ? p : rectIntersection(args);
};

function AttackItem({ id, label, used, full, onAdd }: { id: string; label: string; used: boolean; full: boolean; onAdd: () => void }) {
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
      className={`rounded ${disabled ? 'cursor-not-allowed' : 'cursor-grab hover:translate-x-1'} transition-transform ${isDragging ? 'opacity-30' : ''}`}
      data-testid={`attack-${id}`}
    >
      <Block kind="attack" icon={Zap} iconColor={ATTACK_ICON_COLOR} label={label} color={ATTACK_COLOR} width={250} dim={used} />
    </div>
  );
}

function Plan({ plan, labels, onRemove, locked }: { plan: string[]; labels: Record<string, string>; onRemove: (id: string) => void; locked: boolean }) {
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
          <div key={i} className="h-[46px] rounded border-1.5 border-dashed border-line grid place-items-center text-sm text-ink-3">Drop an attack here</div>
        ))}
      </div>
    </div>
  );
}

export default function Breaker() {
  const { id = '' } = useParams();
  const challenge = getChallenge(id);
  const attempts = useSession((s) => s.breakProgress[id]) ?? [];
  const recordBreak = useSession((s) => s.recordBreak);

  const [plan, setPlan] = useState<string[]>([]);
  const [report, setReport] = useState<LaunchReport | null>(null);
  const [replay, setReplay] = useState<{ testIdx: number; stepIdx: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const timer = useRef<number>();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const speed = useReplaySpeed();
  const STEP_MS = BASE_STEP_MS / speed;
  const TEST_PAUSE_MS = BASE_PAUSE_MS / speed;
  const pending = usePresenter((st) => st.pending);
  useEffect(() => {
    if (!replay || !report) return;
    const r = report.results[replay.testIdx];
    let next: typeof replay | null = null;
    let delay = STEP_MS;
    if (replay.stepIdx < r.steps.length - 1) next = { ...replay, stepIdx: replay.stepIdx + 1 };
    else if (replay.testIdx < report.results.length - 1) {
      next = { testIdx: replay.testIdx + 1, stepIdx: 0 };
      delay = TEST_PAUSE_MS;
    }
    timer.current = window.setTimeout(() => (next ? setReplay(next) : finish()), next ? delay : 800);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, report]);

  // presenter-mode command (one-shot)
  useEffect(() => {
    if (pending !== 'fill-attacks') return;
    usePresenter.getState().command(null);
    if (challenge) {
      const weak = weakSpots(challenge);
      const decoy = challenge.tests.find((t) => !weak.includes(t.id));
      setPlan([...weak, ...(decoy ? [decoy.id] : [])].slice(0, ATTACK_BUDGET));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const highlights = useMemo(() => {
    const h: Record<string, StepStatus> = {};
    if (replay && report) {
      const step = report.results[replay.testIdx].steps[replay.stepIdx];
      if (step) h[step.uid] = step.status;
    }
    return h;
  }, [replay, report]);

  if (!challenge) return <Navigate to="/" />;
  const script = targetScript(challenge);
  const labels = Object.fromEntries(challenge.tests.map((t) => [t.id, t.attackLabel]));
  const summary = breakSummary(challenge, attempts);
  const weakTotal = summary?.total ?? report?.weak.length ?? null;
  const locked = !!replay;

  function finish() {
    window.clearTimeout(timer.current);
    setReplay(null);
    if (report) setSelected(report.broke[0] ?? report.results[0].testId);
  }

  const add = (tid: string) => setPlan((p) => (p.includes(tid) || p.length >= ATTACK_BUDGET ? p : [...p, tid]));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const tid = (active.data.current as { testId?: string } | undefined)?.testId;
    if (tid && over?.id === 'plan') add(tid);
  };

  const go = () => {
    if (!plan.length || locked) return;
    const rep = launch(challenge, plan);
    recordBreak(id, plan, rep.broke);
    setReport(rep);
    setSelected(null);
    setReplay({ testIdx: 0, stepIdx: 0 });
    setPlan([]);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="flex-1 min-w-[280px]">
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-ink-2 hover:text-ink mb-2">
            <ArrowLeft size={16} aria-hidden /> All challenges
          </Link>
          <p className="label text-ink-2">Break a helper · {challenge.title}</p>
          <h1 className="text-4xl font-extrabold leading-tight mt-1">Find the weak spots</h1>
          <p className="text-ink-2 mt-2 max-w-3xl text-[17px]">
            Another student built this helper. It has {weakTotal ?? 'some'} weak spots. Read its blocks, work out what it can't handle, then plan up to {ATTACK_BUDGET} attacks to prove it.
          </p>
        </div>
        <Link to={`/build/${id}`} className="btn bg-paper-card text-sm">Build your own instead</Link>
      </div>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={(e) => setDragging((e.active.data.current as { testId?: string })?.testId ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="grid gap-5 lg:grid-cols-[282px_minmax(360px,1fr)_420px]">
          <aside className="rounded-md border-1.5 border-ink bg-paper-card p-4" aria-label="Attacks">
            <h2 className="text-lg font-extrabold">Attacks</h2>
            <p className="text-sm text-ink-2 mb-4">Each one is a kind of question. Drag it into your plan, or click it.</p>
            <div className="flex flex-col gap-2.5">
              {challenge.tests.map((t) => (
                <AttackItem key={t.id} id={t.id} label={t.attackLabel} used={plan.includes(t.id)} full={plan.length >= ATTACK_BUDGET} onAdd={() => add(t.id)} />
              ))}
            </div>
          </aside>

          <section className="graph rounded-md border-1.5 border-ink p-6 flex flex-col items-center gap-6 min-h-[560px]">
            <div className="w-full flex items-center justify-between" style={{ maxWidth: STACK_W + 40 }}>
              <div>
                <h2 className="text-lg font-extrabold leading-none flex items-center gap-1.5"><Lock size={16} aria-hidden /> Their helper</h2>
                <div className="text-sm text-ink-2 mt-1">Locked. You can read it but not change it.</div>
              </div>
            </div>
            <ScriptStack script={script} highlights={highlights} onRemove={() => {}} locked />
            <Plan plan={plan} labels={labels} onRemove={(tid) => setPlan((p) => p.filter((x) => x !== tid))} locked={locked} />
            <button onClick={go} disabled={!plan.length || locked} className="btn bg-signal text-ink text-lg px-6" data-testid="launch">
              <Zap size={18} fill="currentColor" aria-hidden /> {locked ? 'Attacking…' : `Launch ${plan.length || ''} attack${plan.length === 1 ? '' : 's'}`}
            </button>
          </section>

          <div className="flex flex-col gap-4">
            <div className="rounded-md border-1.5 border-ink bg-ink text-paper p-5" data-testid="found">
              <div className="label text-paper/70">Weak spots found</div>
              <div className="flex items-center gap-3 mt-2">
                <span className="font-mono text-4xl font-bold">{summary?.found ?? 0}<span className="text-paper/60">/{weakTotal ?? '?'}</span></span>
                <div className="flex gap-1.5" aria-hidden>
                  {Array.from({ length: weakTotal ?? 3 }).map((_, i) => (
                    <span key={i} className={`w-4 h-4 rounded-sm border-1.5 border-paper ${i < (summary?.found ?? 0) ? 'bg-signal' : ''}`} />
                  ))}
                </div>
              </div>
              {summary && (
                <p className="text-paper/85 text-sm mt-2">
                  {summary.attempts} attempt{summary.attempts === 1 ? '' : 's'} · {summary.precision}% of your attacks broke it
                  {summary.found === summary.total && '. You found them all.'}
                </p>
              )}
            </div>
            {report ? (
              <RunPanel challenge={challenge} report={report} replay={replay} selected={selected} onSelect={setSelected} seen={[]} onSkip={finish} mode="break" />
            ) : (
              <div className="rounded-md border-1.5 border-ink bg-paper-card p-5">
                <h2 className="text-lg font-extrabold">How to find a weak spot</h2>
                <ul className="mt-2 space-y-2 text-ink-2 list-disc pl-5">
                  <li>Is a safeguard missing for one kind of question?</li>
                  <li>Is a block in the wrong place, like removing private details after the AI has already seen them?</li>
                  <li>Does a check only cover some kinds of claim?</li>
                  <li>Does it refuse normal questions it should answer?</li>
                </ul>
                <p className="text-sm text-ink-3 mt-3">Attacks the helper handles are wasted, so plan carefully.</p>
              </div>
            )}
          </div>
        </div>
        <DragOverlay dropAnimation={{ duration: 160 }}>
          {dragging ? (
            <div className="rotate-2" style={{ filter: 'drop-shadow(3px 3px 0 #16161A)' }}>
              <Block kind="attack" icon={Zap} iconColor={ATTACK_ICON_COLOR} label={labels[dragging]} color={ATTACK_COLOR} width={STACK_W} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {attempts.length > 0 && !locked && (
        <button onClick={() => { useSession.setState((s) => ({ breakProgress: { ...s.breakProgress, [id]: [] } })); setReport(null); }} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-ink-2 underline underline-offset-2">
          <RotateCcw size={14} aria-hidden /> Reset my attempts
        </button>
      )}
    </div>
  );
}
