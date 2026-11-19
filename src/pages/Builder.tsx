import WorkbenchNavigation from '../components/WorkbenchNavigation';
import ReasoningField from '../components/ReasoningField';
import { stackCollision } from '../components/stackCollision';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Lock, Play, RotateCcw } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Block from '../components/Block';
import TrainingCompanion from '../components/TrainingCompanion';
import Palette from '../components/Palette';
import ReflectModal from '../components/ReflectModal';
import RunPanel from '../components/RunPanel';
import ScriptStack, { STACK_W } from '../components/ScriptStack';
import { BLOCKS } from '../data/blocks';
import { getChallenge } from '../data/challenges';
import { runChallenge } from '../engine/run';
import { buildStatus } from '../engine/progress';
import { blockKey, keyToBlock, labelOf } from '../engine/scriptText';
import { usefulnessTarget } from '../engine/targets';
import { describeAdd, freshProgress, newUid, useAssessmentSession, usePracticeStore } from '../store/session';
import { usePresenter, useReplaySpeed } from '../store/presenter';
import type { BlockType, CondId, FailureKey, RunReport, ScriptBlock, StepStatus } from '../types';

import { blockCredits, type Desk } from '../engine/mission';
import AttackHintPanel from '../components/AttackHintPanel';
import { evaluateDesk, type serviceWorkloads } from '../engine/challengeEvidence';
import { Trace } from '../components/MissionReport';
import { workloadFormula } from '../components/WorkloadBar';

const BASE_STEP_MS = 520;
const BASE_PAUSE_MS = 1500;

const isControl = (t: string) => t === 'if' || t === 'ifelse';

interface AssessmentBuild {
  id: Desk;
  /** Level 2 assessment: the IF-block version of the challenge (edge case, higher usefulness target) */
  level2?: boolean;
  revising: boolean;
  workload: ReturnType<typeof serviceWorkloads>[number];
  note: string;
  onNote: (value: string) => void;
  /** whether the note must be written (the teacher's setting for this question) */
  noteRequired?: boolean;
  onMenu: () => void;
  onAttack: () => void;
}
export default function Builder({ assessment }: { assessment?: AssessmentBuild }) {
  const route = useParams();
  const baseCid = assessment?.id ?? route.id ?? '';
  const isL2 = assessment ? !!assessment.level2 : route.level === '2';
  const cid = isL2 ? baseCid + '@2' : baseCid;
  // Assessment work is saved per challenge (the level is fixed for the whole assessment); practice keeps Level 1 and 2 apart.
  const id = assessment ? baseCid : cid;
  const usePractice = usePracticeStore();
  const useWork = assessment ? useAssessmentSession : usePractice;
  const challenge = getChallenge(cid);
  const l1Progress = useWork(s => s.progress[baseCid]);
  const progress = useWork((s) => s.progress[id]) ?? freshProgress();
  const { setScript, recordRun, reflect, reset } = useWork();
  const script = progress.script;

  const [report, setReport] = useState<RunReport | null>(null);
  const [ranScript, setRanScript] = useState<ScriptBlock[] | null>(null);
  const [replay, setReplay] = useState<{ testIdx: number; stepIdx: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<BlockType | null>(null);
  const [reflectFor, setReflectFor] = useState<{ testId: string; expected: FailureKey } | null>(null);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number>();
  const runRef = useRef<() => void>();

  // make sure the challenge has a progress entry persisted
  useEffect(() => {
    if (challenge && !useWork.getState().progress[id]) setScript(id, script);
    const latest = progress.attempts.slice(-1)[0];
    setReport(assessment && latest && challenge ? runChallenge(latest.script.map((key, i) => keyToBlock(key, `saved-${i}`)), challenge) : null);
    setReplay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cid]);

  // ---- replay animation ----
  const speed = useReplaySpeed();
  const STEP_MS = BASE_STEP_MS / speed;
  const TEST_PAUSE_MS = BASE_PAUSE_MS / speed;
  const pending = usePresenter((st) => st.pending);
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

  // presenter-mode command (one-shot)
  useEffect(() => {
    if (pending !== 'run') return;
    usePresenter.getState().command(null);
    setTimeout(() => runRef.current?.(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const finishReplay = () => {
    window.clearTimeout(timer.current);
    setReplay(null);
    if (!report) return;
    const firstBad = report.results.find((r) => r.outcome !== 'pass');
    setSelected(firstBad?.testId ?? report.results[0].testId);
    const pending = useWork.getState().progress[id]?.pendingReflection;
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
  const l1 = buildStatus(baseCid, getChallenge(baseCid)!.tests.length, l1Progress);
  const target = usefulnessTarget(cid);
  const locked = !!replay;
  const used = new Set(script.filter((b) => !isControl(b.type)).map((b) => b.type));
  const mustReflect = !!progress.pendingReflection;

  const update = (next: typeof script, event: { kind: 'add' | 'remove' | 'move'; text: string }) => {
    if (locked) return;
    setScript(id, next, event);
    setDirty(true);
  };

  const addAt = (type: BlockType, index: number) => {
    if (used.has(type)) return;
    const next = [...script];
    const block: ScriptBlock = isControl(type) ? { uid: newUid(type), type, cond: 'person', then: null, else: null } : { uid: newUid(type), type };
    next.splice(index, 0, block);
    update(next, { kind: 'add', text: describeAdd(type, index) });
  };

  const setSlot = (uid: string, which: 'then' | 'else', child: ScriptBlock | null, base = script) => {
    const next = base.map((b) => (b.uid === uid ? { ...b, [which]: child } : b));
    const ifb = next.find((b) => b.uid === uid)!;
    update(next, { kind: 'add', text: child ? `Put “${BLOCKS[child.type].label}” inside ${labelOf(blockKey(ifb)).split(' THEN')[0]}` : 'Emptied an IF block' });
  };

  // Clicking a safeguard fills the newest empty IF slot (keyboard-friendly); otherwise it goes at the end.
  const clickAdd = (type: BlockType) => {
    if (!isControl(type) && type !== 'ask_ai') {
      for (let i = script.length - 1; i >= 0; i--) {
        const b = script[i];
        if (!isControl(b.type)) continue;
        if (!b.then) return setSlot(b.uid, 'then', { uid: newUid(type), type });
        if (b.type === 'ifelse' && !b.else) return setSlot(b.uid, 'else', { uid: newUid(type), type });
      }
    }
    addAt(type, script.length);
  };

  const ifh = {
    onCond: (uid: string, cond: CondId) => {
      const next = script.map((b) => (b.uid === uid ? { ...b, cond } : b));
      update(next, { kind: 'move', text: `Changed an IF condition to “${cond}”` });
    },
    onClearSlot: (uid: string, which: 'then' | 'else') => setSlot(uid, which, null),
  };

  const remove = (uid: string) => {
    const b = script.find((x) => x.uid === uid);
    if (!b || !BLOCKS[b.type].removable) return;
    update(script.filter((x) => x.uid !== uid), { kind: 'remove', text: `Removed “${labelOf(blockKey(b))}”` });
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

    // dropping into an IF block's slot
    if (overId.startsWith('slot:')) {
      const [, ifUid, which] = overId.split(':') as [string, string, 'then' | 'else'];
      const type = d?.from === 'palette' ? d.type! : script.find((b) => b.uid === active.id)?.type;
      if (!type || isControl(type) || type === 'ask_ai') return;
      const base = d?.from === 'palette' ? script : script.filter((b) => b.uid !== active.id);
      setSlot(ifUid, which, { uid: newUid(type), type }, base);
      return;
    }

    if (d?.from === 'palette') {
      if (over.data.current?.insertion) return addAt(d.type!, over.data.current.index);
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
    const label = labelOf(blockKey(script[from]));
    update(arrayMove(script, from, to), { kind: 'move', text: `Moved “${label}” to position ${to + 1}` });
  };

  const run = () => {
    if (mustReflect || locked) return;
    const rep = runChallenge(script, challenge);
    recordRun(id, rep);
    setReport(rep);
    setRanScript(script);
    setDirty(false);
    setSelected(null);
    setReplay({ testIdx: 0, stepIdx: 0 });
  };

  runRef.current = run;
  const skip = () => {
    window.clearTimeout(timer.current);
    finishReplay();
  };

  const last = progress.attempts.slice(-1)[0];
  const costs = assessment && last && evaluateDesk(assessment.id, last.script, isL2 ? 2 : 1);
  const evaluated = last && last.script.join() === script.map(blockKey).join();

  const attemptNo = progress.attempts.length;
  const reflectTest = reflectFor && challenge.tests.find((t) => t.id === reflectFor.testId);

  return (
    <div className={`max-w-[1400px] mx-auto py-6 ${assessment ? 'sm:px-4' : 'px-4'}`}>
      <div className="flex flex-wrap items-start gap-4 mb-5">
        <div className="flex-1 min-w-[min(100%,260px)]">
          {assessment ? <button onClick={assessment.onMenu} className="flex items-center gap-1 text-sm font-bold mb-2"><ArrowLeft size={16} /> Whole-helper overview</button> : <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-ink-2 hover:text-ink mb-2">
            <ArrowLeft size={16} aria-hidden /> All challenges
          </Link>}
          <h1 className="text-4xl font-extrabold leading-none">{challenge.title}</h1>
          <p className="text-ink-2 mt-2 max-w-3xl text-[17px]">{challenge.story}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {!assessment && <nav aria-label="Level" className="flex border-1.5 border-ink rounded overflow-hidden text-sm font-bold">
              <Link to={`/build/${baseCid}`} aria-current={!isL2 ? 'page' : undefined} className={`px-3 py-1.5 ${!isL2 ? 'bg-ink text-paper' : 'bg-paper-card hover:bg-paper-deep'}`} data-testid="level-1">
                Level 1
              </Link>
              <Link
                to={`/build/${baseCid}/2`}
                aria-current={isL2 ? 'page' : undefined}
                className={`px-3 py-1.5 flex items-center gap-1.5 border-l-1.5 border-ink ${isL2 ? 'bg-ink text-paper' : 'bg-paper-card hover:bg-paper-deep'}`}
                data-testid="level-2"
              >
                {l1.state !== 'done' && <Lock size={13} aria-hidden />} Level 2: IF blocks
              </Link>
            </nav>}
            <p className="text-sm text-ink-2" data-testid="goal">
              <b className="text-ink">Goal:</b> pass all {challenge.tests.length} tests <b className="text-ink">and</b> keep usefulness at {target} or more.
              {isL2 ? ' Use IF blocks so safeguards only run when they are needed.' : ' Every extra block slows the helper down.'}
            </p>
          </div>
        </div>
        {!assessment && <button onClick={() => { reset(id); setReport(null); setReplay(null); }} className="btn bg-paper-card text-sm">
          <RotateCcw size={16} aria-hidden /> Start again
        </button>}
      </div>

      {assessment && <div className="rounded-md border border-line p-4 mb-5 space-y-2">
        <p><b>Projected service cost</b> · {workloadFormula(assessment.workload.perRequest, assessment.workload.volume, assessment.workload.credits)}</p>
        <p className="text-sm text-ink-2">Ask AI and test runs are free.{isL2 && ' Each IF block budgets for its more expensive branch.'}</p>
        {costs && !locked && <details><summary className="cursor-pointer font-bold">Latest test results</summary>
          {costs.map(row => <Trace key={row.id} run={row} />)}
        </details>}
        <ReasoningField label={`${assessment.revising ? 'What did the attack show, and why keep or change your blocks?' : 'Which risk are you designing for?'} (${(assessment.noteRequired ?? assessment.revising) ? 'required' : 'optional'})`}
          value={assessment.note} change={assessment.onNote} required={assessment.noteRequired ?? assessment.revising} rows={2} />
        <AttackHintPanel desk={assessment.id as Desk} />
        <button disabled={((assessment.noteRequired ?? assessment.revising) && !assessment.note.trim()) || !evaluated || locked || mustReflect} className="btn bg-signal" onClick={assessment.onAttack}>{assessment.revising ? 'Finish challenge' : 'Continue to Attack with this build'}</button>
      </div>}
      {isL2 && !assessment && l1.state !== 'done' ? (
        <div className="rounded-md border-1.5 border-ink bg-paper-card p-10 text-center max-w-xl mx-auto" data-testid="l2-locked">
          <Lock size={28} aria-hidden className="mx-auto" />
          <h2 className="text-2xl font-extrabold mt-3">Level 2 is locked</h2>
          <p className="text-ink-2 mt-2">
            Finish Level 1 first: pass all {getChallenge(baseCid)!.tests.length} tests while keeping usefulness at {l1.target} or more.
            {l1.bestUseful !== null && ` Your best so far is ${l1.bestUseful}.`}
          </p>
          <Link to={`/build/${baseCid}`} className="btn bg-signal mt-5">Go to Level 1</Link>
        </div>
      ) : (
      <DndContext sensors={sensors} collisionDetection={stackCollision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveDrag(null)}>
        <WorkbenchNavigation mode="build" />
        <div className="workbench-grid">
          <Palette credits={assessment ? blockCredits : undefined} blocks={challenge.palette} control={isL2 ? ['if', 'ifelse'] : []} used={used} onAdd={clickAdd} />

          <section id="workbench-helper" tabIndex={-1} className="graph rounded-md border-1.5 border-ink p-2 sm:p-6 flex flex-col items-center min-h-[560px]" aria-label="Your helper">
            <div className="w-full flex items-center justify-between mb-6" style={{ maxWidth: STACK_W + 40 }}>
              <div>
                <h2 className="text-lg font-extrabold leading-none">Your helper</h2>
                <div className="text-sm text-ink-2 mt-1">{attemptNo ? `Run ${attemptNo + (dirty ? 1 : 0)}` : 'Not run yet'}</div>
              </div>
              <button
                onClick={run}
                disabled={locked || mustReflect}
                title={mustReflect ? 'Explain the last failure first' : undefined}
                className="btn bg-pass text-white text-lg px-5"
                data-testid="run"
              >
                <Play size={18} fill="currentColor" aria-hidden /> {locked ? 'Running…' : 'Run tests'}
              </button>
            </div>
            <ScriptStack script={script} highlights={highlights} onRemove={remove} locked={locked} ifh={ifh} />
            {mustReflect && !reflectFor && !locked && (
              <button onClick={() => setReflectFor(progress.pendingReflection)} className="mt-2 font-bold underline underline-offset-2">
                Explain the last failure to run again
              </button>
            )}
            <TrainingCompanion key={cid} id={baseCid} script={script} />
          </section>

          <div id="workbench-results" tabIndex={-1}><RunPanel challenge={challenge} report={report} replay={replay} selected={selected} onSelect={setSelected} seen={progress.seen} onSkip={skip} target={target} script={ranScript ?? script} level2={isL2} /></div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="rotate-2" style={{ filter: "drop-shadow(3px 3px 0 #16161A)" }}>
              <Block kind={activeDrag} label={BLOCKS[activeDrag].label} color={BLOCKS[activeDrag].color} textColor={isControl(activeDrag) ? '#16161A' : undefined} width={STACK_W} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

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
