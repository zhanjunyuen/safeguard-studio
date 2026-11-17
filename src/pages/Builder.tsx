import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Block from '../components/Block';
import Palette from '../components/Palette';
import ReflectModal from '../components/ReflectModal';
import RunPanel from '../components/RunPanel';
import ScriptStack, { STACK_W } from '../components/ScriptStack';
import { BLOCKS } from '../data/blocks';
import { getChallenge } from '../data/challenges';
import { runChallenge } from '../engine/run';
import { describeAdd, freshProgress, newUid, useSession } from '../store/session';
import type { BlockType, FailureKey, RunReport, StepStatus } from '../types';

const STEP_MS = 520;
const TEST_PAUSE_MS = 1500;

const collision: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  return p.length ? p : rectIntersection(args);
};

export default function Builder() {
  const { id = '' } = useParams();
  const challenge = getChallenge(id);
  const progress = useSession((s) => s.progress[id]) ?? freshProgress();
  const { setScript, recordRun, reflect, reset } = useSession();
  const script = progress.script;

  const [report, setReport] = useState<RunReport | null>(null);
  const [replay, setReplay] = useState<{ testIdx: number; stepIdx: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<BlockType | null>(null);
  const [reflectFor, setReflectFor] = useState<{ testId: string; expected: FailureKey } | null>(null);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number>();

  // make sure the challenge has a progress entry persisted
  useEffect(() => {
    if (challenge && !useSession.getState().progress[id]) setScript(id, script);
    setReport(null);
    setReplay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---- replay animation ----
  useEffect(() => {
    if (!replay || !report) return;
    const r = report.results[replay.testIdx];
    const lastStep = r.steps.length - 1;
    let next: typeof replay | null;
    let delay = STEP_MS;
    if (replay.stepIdx < lastStep) next = { ...replay, stepIdx: replay.stepIdx + 1 };
    else if (replay.testIdx < report.results.length - 1) {
      next = { testIdx: replay.testIdx + 1, stepIdx: 0 };
      delay = r.outcome === 'pass' ? TEST_PAUSE_MS * 0.6 : TEST_PAUSE_MS;
    } else {
      next = null;
      delay = TEST_PAUSE_MS;
    }
    timer.current = window.setTimeout(() => (next ? setReplay(next) : finishReplay()), delay);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, report]);

  const finishReplay = () => {
    window.clearTimeout(timer.current);
    setReplay(null);
    if (!report) return;
    const firstBad = report.results.find((r) => r.outcome !== 'pass');
    setSelected(firstBad?.testId ?? report.results[0].testId);
    const pending = useSession.getState().progress[id]?.pendingReflection;
    if (pending) setReflectFor(pending);
  };

  const highlights = useMemo(() => {
    const h: Record<string, StepStatus> = {};
    if (replay && report) {
      const step = report.results[replay.testIdx].steps[replay.stepIdx];
      if (step) h[step.uid] = step.status;
    }
    return h;
  }, [replay, report]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!challenge) return <Navigate to="/" />;
  const locked = !!replay;
  const used = new Set(script.map((b) => b.type));
  const mustReflect = !!progress.pendingReflection;

  const update = (next: typeof script, event: { kind: 'add' | 'remove' | 'move'; text: string }) => {
    setScript(id, next, event);
    setDirty(true);
  };

  const addAt = (type: BlockType, index: number) => {
    if (used.has(type)) return;
    const next = [...script];
    next.splice(index, 0, { uid: newUid(type), type });
    update(next, { kind: 'add', text: describeAdd(type, index) });
  };

  const remove = (uid: string) => {
    const b = script.find((x) => x.uid === uid);
    if (!b || !BLOCKS[b.type].removable) return;
    update(script.filter((x) => x.uid !== uid), { kind: 'remove', text: `Removed “${BLOCKS[b.type].label}”` });
  };

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { from: string; type?: BlockType } | undefined;
    if (d?.from === 'palette') setActiveDrag(d.type!);
    else setActiveDrag(script.find((b) => b.uid === e.active.id)?.type ?? null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDrag(null);
    if (!over) return;
    const d = active.data.current as { from: string; type?: BlockType } | undefined;
    const overId = String(over.id);
    const overIdx = script.findIndex((b) => b.uid === overId);
    const below = (() => {
      const a = active.rect.current.translated;
      if (!a) return false;
      return a.top + a.height / 2 > over.rect.top + over.rect.height / 2;
    })();

    if (d?.from === 'palette') {
      if (overId === 'palette') return;
      const idx = overId === 'stack-start' ? 0 : overId === 'stack-end' ? script.length : overIdx + (below ? 1 : 0);
      if (idx >= 0) addAt(d.type!, idx);
      return;
    }
    // moving a block already in the stack
    const from = script.findIndex((b) => b.uid === active.id);
    if (from < 0) return;
    if (overId === 'palette') return remove(String(active.id));
    const to = overId === 'stack-start' ? 0 : overId === 'stack-end' ? script.length - 1 : overIdx;
    if (to < 0 || to === from) return;
    const label = BLOCKS[script[from].type].label;
    update(arrayMove(script, from, to), { kind: 'move', text: `Moved “${label}” to position ${to + 1}` });
  };

  const run = () => {
    if (mustReflect || locked) return;
    const rep = runChallenge(script, challenge);
    recordRun(id, rep);
    setReport(rep);
    setDirty(false);
    setSelected(null);
    setReplay({ testIdx: 0, stepIdx: 0 });
  };

  const skip = () => {
    window.clearTimeout(timer.current);
    finishReplay();
  };

  const attemptNo = progress.attempts.length;
  const reflectTest = reflectFor && challenge.tests.find((t) => t.id === reflectFor.testId);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex flex-wrap items-start gap-4 mb-5">
        <Link to="/" className="mt-1 text-sm font-bold text-indigo-900/60 hover:text-indigo-900">← Challenges</Link>
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{challenge.emoji}</span>
            <h1 className="text-3xl font-extrabold leading-none">{challenge.title}</h1>
          </div>
          <p className="text-indigo-900/70 mt-1 max-w-3xl">{challenge.story}</p>
        </div>
        <button
          onClick={() => { reset(id); setReport(null); setReplay(null); }}
          className="text-sm font-bold px-3 py-1.5 rounded-full border-2 border-indigo-100 hover:border-rose-300 bg-white"
        >
          ↺ Start over
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveDrag(null)}>
        <div className="grid gap-5 lg:grid-cols-[282px_minmax(360px,1fr)_420px]">
          <Palette used={used} onAdd={(t) => addAt(t, script.length)} />

          <section className="workspace rounded-3xl border-2 border-indigo-100 p-6 flex flex-col items-center min-h-[560px]">
            <div className="w-full flex items-center justify-between mb-5" style={{ maxWidth: STACK_W + 40 }}>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-900/50">Your helper</div>
                <div className="text-sm text-indigo-900/60">{attemptNo ? `Attempt ${attemptNo + (dirty ? 1 : 0)}` : 'First attempt'}</div>
              </div>
              <button
                onClick={run}
                disabled={locked || mustReflect}
                title={mustReflect ? 'Explain the last failure first' : undefined}
                className="relative px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-lg font-extrabold shadow-lg shadow-emerald-200 transition active:scale-95"
                data-testid="run"
              >
                {locked ? 'Running…' : '▶ Run tests'}
              </button>
            </div>
            <ScriptStack script={script} highlights={highlights} onRemove={remove} locked={locked} />
            {mustReflect && !reflectFor && !locked && (
              <button onClick={() => setReflectFor(progress.pendingReflection)} className="mt-2 text-sm font-bold text-violet-700 underline">
                Explain the last failure to unlock Run
              </button>
            )}
          </section>

          <RunPanel challenge={challenge} report={report} replay={replay} selected={selected} onSelect={setSelected} seen={progress.seen} onSkip={skip} />
        </div>

        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeDrag ? (
            <div className="rotate-2 drop-shadow-xl">
              <Block label={BLOCKS[activeDrag].label} icon={BLOCKS[activeDrag].icon} color={BLOCKS[activeDrag].color} width={STACK_W} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {reflectFor && reflectTest && (
        <ReflectModal
          testTitle={reflectTest.title}
          question={reflectTest.question}
          expected={reflectFor.expected}
          seed={`${reflectFor.testId}-${attemptNo}`}
          onSubmit={(chosen, text) => reflect(id, chosen, text)}
          onClose={() => setReflectFor(null)}
        />
      )}
    </div>
  );
}
