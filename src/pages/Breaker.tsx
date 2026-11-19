import WorkbenchNavigation from '../components/WorkbenchNavigation';
import ReasoningField from '../components/ReasoningField';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ArrowLeft, Lock, RotateCcw, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AttackItem, Plan, ATTACK_COLOR, ATTACK_ICON_COLOR } from '../components/AttackBlocks';
import Block from '../components/Block';
import RunPanel from '../components/RunPanel';
import ScriptStack, { STACK_W } from '../components/ScriptStack';
import { getChallenge } from '../data/challenges';
import { ATTACK_BUDGET, breakSummary, launch, targetScript, weakSpots, type LaunchReport } from '../engine/breaker';
import TrainingCompanion from '../components/TrainingCompanion';
import AttackHintPanel from '../components/AttackHintPanel';
import MarkFeedback from '../components/MarkFeedback';
import type { Desk, Rule } from '../engine/mission';
import { usePracticeStore } from '../store/session';
import { usePresenter, useReplaySpeed } from '../store/presenter';
import type { StepStatus } from '../types';

const BASE_STEP_MS = 520;
const BASE_PAUSE_MS = 1400;


const collision: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  return p.length ? p : rectIntersection(args);
};

interface AssessmentAttack {
  id: Desk;
  /** Level 2 assessment: attack menu includes the Level 2 edge case */
  level2?: boolean;
  rules: Rule[];
  hintCount: number;
  plan: string[];
  submitted?: string[];
  changePlan: (plan: string[]) => void;
  /** Required written prediction for the plan; recorded with the launch. */
  reason: string;
  changeReason: (reason: string) => void;
  /** true until the pupil has answered this challenge's curveball */
  curveballPending?: boolean;
  submit: () => void;
  onMenu: () => void;
  onFinish: () => void;
  onRevise: () => void;
}
export default function Breaker({ assessment }: { assessment?: AssessmentAttack }) {
  const useSession = usePracticeStore();
  const route = useParams();
  const id = assessment?.id ?? route.id ?? '';
  const original = getChallenge(assessment?.level2 ? `${id}@2` : id);
  const challenge = useMemo(() => original && assessment
    ? { ...original, breakTarget: assessment.rules.map(r => r.type) } : original, [original, assessment?.rules]);
  const saved = useMemo(() => challenge && assessment?.submitted ? launch(challenge, assessment.submitted) : null, [challenge, assessment?.submitted]);
  const practiceAttempts = useSession(s => s.breakProgress[id]);
  const attempts = assessment ? (saved ? [{ attacks: assessment.submitted!, broke: saved.broke }] : []) : practiceAttempts ?? [];
  const recordBreak = useSession((s) => s.recordBreak);

  const [practicePlan, setPracticePlan] = useState<string[]>([]);
  const plan = assessment?.plan ?? practicePlan;
  const setPlan = (value: string[]) => assessment ? assessment.changePlan(value) : setPracticePlan(value);
  const [report, setReport] = useState<LaunchReport | null>(saved);
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
    if (pending !== 'fill-attacks' || assessment) return;
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

  const add = (tid: string) => {
    if (!locked && !assessment?.submitted && !plan.includes(tid) && plan.length < ATTACK_BUDGET) setPlan([...plan, tid]);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const tid = (active.data.current as { testId?: string } | undefined)?.testId;
    if (tid && over?.id === 'plan') add(tid);
  };

  const needsReason = !!assessment && !assessment.reason.trim();
  const go = () => {
    if (!plan.length || locked || assessment?.submitted || needsReason) return;
    const rep = launch(challenge, plan);
    if (assessment) assessment.submit();
    else recordBreak(id, plan, rep.broke);
    setReport(rep);
    setSelected(null);
    setReplay({ testIdx: 0, stepIdx: 0 });
    if (!assessment) setPlan([]);
  };

  return (
    <div className={`max-w-[1400px] mx-auto py-6 ${assessment ? 'sm:px-4' : 'px-4'}`}>
      <div className="workspace-intro flex flex-wrap items-start gap-4 mb-5">
        <div className="flex-1 min-w-[min(100%,260px)]">
          {assessment ? <button onClick={assessment.onMenu} className="flex items-center gap-1 text-sm font-bold mb-2"><ArrowLeft size={16} /> Whole-helper overview</button> : <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-ink-2 hover:text-ink mb-2">
            <ArrowLeft size={16} aria-hidden /> All challenges
          </Link>}
          <p className="label text-ink-2">Break a helper · {challenge.title}</p>
          <h1 className="text-4xl font-extrabold leading-tight mt-1">Find the weak spots</h1>
          <p className="text-ink-2 mt-2 max-w-3xl text-[17px]">
            {assessment ? 'This is the helper you just built and evaluated. Choose up to three cases for your attack plan and inspect how your blocks respond.' : <>Another student built this helper. It has {weakTotal ?? 'some'} weak spots. Read its blocks, work out what it can't handle, then plan up to {ATTACK_BUDGET} attacks to prove it.</>}
          </p>
        </div>
        {!assessment && <Link to={`/build/${id}`} className="btn bg-paper-card text-sm">Build your own instead</Link>}
      </div>

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={(e) => setDragging((e.active.data.current as { testId?: string })?.testId ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <WorkbenchNavigation mode="break" />
        <div className="workbench-grid">
          <aside id="workbench-palette" tabIndex={-1} className="rounded-md border-1.5 border-ink bg-paper-card p-4" aria-label="Attacks">
            <h2 className="text-lg font-extrabold">Attacks</h2>
            <p className="text-sm text-ink-2 mb-4">Each one is a kind of question. Drag it into your plan, or click it.</p>
            <div className="flex flex-col gap-2.5">
              {challenge.tests.map((t) => (
                <AttackItem key={t.id} id={t.id} label={t.attackLabel} used={plan.includes(t.id)} full={locked || !!assessment?.submitted || plan.length >= ATTACK_BUDGET} onAdd={() => add(t.id)} />
              ))}
            </div>
          </aside>

          <section id="workbench-helper" tabIndex={-1} className="graph rounded-md border-1.5 border-ink p-2 sm:p-6 flex flex-col items-center gap-6 min-h-[560px]">
            <div className="w-full flex items-center justify-between" style={{ maxWidth: STACK_W + 40 }}>
              <div>
                <h2 className="text-lg font-extrabold leading-none flex items-center gap-1.5"><Lock size={16} aria-hidden /> {assessment ? 'Your evaluated helper' : 'Their helper'}</h2>
                <div className="text-sm text-ink-2 mt-1">Locked. You can read it but not change it.</div>
              </div>
            </div>
            <ScriptStack script={script} highlights={highlights} onRemove={() => {}} locked />
            <Plan plan={plan} labels={labels} onRemove={(tid) => setPlan(plan.filter((x) => x !== tid))} locked={locked || !!assessment?.submitted} />
            {assessment && (assessment.submitted ? (
              <div className="w-full space-y-3" style={{ maxWidth: STACK_W + 40 }}>
                <div className="rounded border-1.5 border-line bg-paper-card p-3" data-testid="attack-reason-saved">
                  <div className="label text-ink-3">Your prediction</div>
                  <p className="mt-1">{assessment.reason || 'Not recorded'}</p>
                </div>
                {saved && !locked && assessment.reason.trim() && <MarkFeedback request={{
                  criterion: 'testing', text: assessment.reason, blocks: assessment.rules.map((r) => r.type), broke: saved.broke,
                  planned: assessment.submitted!.map((tid) => { const t = challenge.tests.find((x) => x.id === tid)!; return { id: tid, label: t.attackLabel, title: t.title, category: t.category }; }),
                }} />}
              </div>
            ) : (
              <div className="w-full" style={{ maxWidth: STACK_W + 40 }}>
                <ReasoningField id="attack-reason" required disabled={locked} value={assessment.reason} change={assessment.changeReason}
                  label="Why these attacks? Say which block you expect to fail, and why. (required)" />
              </div>
            ))}
            {!assessment?.submitted && <button onClick={go} disabled={!plan.length || locked || needsReason} className="btn bg-signal text-ink text-lg px-6" data-testid="launch">
              <Zap size={18} fill="currentColor" aria-hidden /> {locked ? 'Attacking…' : `Launch ${plan.length || ''} attack${plan.length === 1 ? '' : 's'}`}
            </button>}
            <TrainingCompanion id={id} script={script} hintCount={assessment?.hintCount} />
            {assessment && <>
              <AttackHintPanel desk={assessment.id} />
              {saved && !locked && (assessment.curveballPending
                ? <p className="rounded border-1.5 border-ink bg-signal-soft p-3 font-bold" data-testid="curveball-pending">One more case before you finish: answer the curveball below.</p>
                : <div className="flex flex-wrap gap-2">
                  <button className="btn bg-signal" onClick={assessment.onFinish}>Finish challenge</button>
                  <button className="btn bg-paper" onClick={assessment.onRevise}>Revise my build</button>
                </div>)}
            </>}
          </section>

          <div id="workbench-results" tabIndex={-1} className="flex flex-col gap-4">
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
                  {summary.total > 0 && summary.found === summary.total && '. You found them all.'}
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
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <div className="rotate-2" style={{ filter: 'drop-shadow(3px 3px 0 #16161A)' }}>
              <Block kind="attack" icon={Zap} iconColor={ATTACK_ICON_COLOR} label={labels[dragging]} color={ATTACK_COLOR} width={STACK_W} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {!assessment && attempts.length > 0 && !locked && (
        <button onClick={() => { useSession.setState((s) => ({ breakProgress: { ...s.breakProgress, [id]: [] } })); setReport(null); }} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-ink-2 underline underline-offset-2">
          <RotateCcw size={14} aria-hidden /> Reset my attempts
        </button>
      )}
    </div>
  );
}
