import ReasoningField from '../components/ReasoningField';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ASSIGNED_CASES, BRIEF, DESKS, SOURCE_PACK, TRANSFER } from '../data/mission';
import { getChallenge } from '../data/challenges';
import { AttackWorkbench, ProblemMenu, RuleEditor } from '../components/MissionWorkbench';
import { allChallengesComplete, BUDGET, estimateCost, type Phase } from '../engine/mission';
import AssessmentChallenges from '../components/AssessmentChallenges';
import { useMission } from '../store/mission';
import { isRequired } from '../engine/assessmentSettings';
import AssessmentSteps from '../components/AssessmentSteps';
import { useSession } from '../store/session';
import TrainingCompanion from '../components/TrainingCompanion';
import { BuildReport, MissionReport } from '../components/MissionReport';

const field = 'block mt-1 w-full rounded border-1.5 border-line p-2 bg-white text-ink';
const primary = 'btn bg-signal';
const phases: Record<Phase, string> = {
  menu: 'Whole-helper overview', brief: 'Meet your helper', build: 'Build', evaluation: 'Build evaluation', attack: 'Attack', revise: 'Revise', release: 'Release decision',
  complete: 'Assessment evidence', expired: 'Assessment evidence',
};

function Writing({ label, value, change, hint }: { label: string; value: string; change: (v: string) => void; hint?: string }) {
  return <ReasoningField label={<>{label}{hint && <span className="block text-sm font-normal">{hint}</span>}</>} value={value} change={change} />;
}
function Panel({ children, title }: { children: ReactNode; title: string }) {
  return <section className="bg-paper-card border-1.5 border-ink rounded-md p-5 md:p-7 space-y-4"><h2 className="text-2xl font-extrabold">{title}</h2>{children}</section>;
}

// Count time on visible assessment screens. Replays are instant, user-opened trace text.
function useActiveClock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    let visible = !document.hidden;
    function flush() {
      const now = performance.now();
      const seconds = Math.floor((now - last) / 1000);
      if (visible && seconds > 0) useMission.getState().tick(seconds);
      last = visible ? last + seconds * 1000 : now;
    }
    function visibility() { flush(); visible = !document.hidden; }
    const timer = window.setInterval(flush, 500);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', flush);
    return () => { flush(); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', flush); };
  }, [active]);
}

export default function Mission() {
  const { mission: m, update, restart } = useMission();
  const joinedClass = useSession(s => s.classCode);
  const sequence = m.form === 4 || m.phase === 'brief';
  const ended = m.phase === 'complete' || m.phase === 'expired';
  useActiveClock(!ended && m.phase !== 'brief');
  const rules = m.phase === 'attack' && m.first ? m.first : m.draft;
  const companionScript = useMemo(() => rules.map(({ type }) => ({ type, uid: type })), [rules]);
  const companion = <TrainingCompanion id="community" script={companionScript} hintCount={m.attackHints?.length} />;
  const remaining = m.minutes * 60 - m.elapsed;
  const focus = m.focus ?? DESKS[0].id;
  const restartDialog = useRef<HTMLDialogElement>(null);
  const briefDialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { stage.current?.scrollTo(0, 0); }, [m.phase, m.focus]);
  return <div className={`assessment-workspace ${sequence ? 'current-assessment' : ''}`}>
    <header className="assessment-heading">
      <div>
        <p className="label hidden sm:block">AI literacy assessment · {phases[m.phase]}</p>
        <h1 className="text-xl sm:text-2xl font-extrabold" ref={heading} tabIndex={-1}><span className="hidden sm:inline">School community helper</span><span className="sm:hidden">Assessment</span></h1>
      </div>
      <div className="assessment-tools">
        {!ended && m.phase !== 'brief' && <span className={`font-mono text-sm ${m.minutes ? '' : 'hidden sm:inline'}`}>{m.minutes ? Math.floor(remaining / 60) + 'm ' + (remaining % 60) + 's left' : 'Untimed'}</span>}
        <button className="btn bg-paper-card text-sm" onClick={() => briefDialog.current?.showModal()} aria-label="Brief and sources">Brief<span className="hidden sm:inline"> &amp; sources</span></button>
        {m.phase !== 'brief' && <button className="btn bg-paper-card text-sm" onClick={() => restartDialog.current?.showModal()} aria-label="Restart assessment">Restart<span className="hidden sm:inline"> assessment</span></button>}
      </div>
    </header>
    <dialog ref={briefDialog} aria-labelledby="brief-heading" className="assessment-dialog">
      <h2 id="brief-heading" className="text-xl font-extrabold">Brief and source pack</h2>
      {sequence && <AssessmentSteps mission={m} needsName={!!m.classCode && joinedClass !== m.classCode} />}
      <p>{BRIEF}</p>
      <ul className="space-y-2">{SOURCE_PACK.map(([name, detail]) => <li key={name}><b>{name}</b> · {detail}</li>)}</ul>
      {m.phase === 'brief' && companion}
      <form method="dialog"><button className="btn bg-paper-card">Close brief</button></form>
    </dialog>
    <dialog ref={restartDialog} aria-labelledby="restart-heading" aria-describedby="restart-description" className="assessment-dialog">
      <h2 id="restart-heading" className="text-xl font-extrabold">Restart this assessment?</h2>
      <p id="restart-description">This clears this assessment’s builds, answers and evidence on this device and takes you back to setup. Your practice progress is kept.</p>
      {ended && <p>You can download this attempt’s evidence before restarting.</p>}
      <div className="flex flex-wrap gap-3">
        <form method="dialog"><button className="btn bg-paper-card" autoFocus>Cancel</button></form>
        <button className="btn bg-signal" onClick={() => {
          restartDialog.current?.close();
          restart();
          heading.current?.focus();
        }}>Restart now</button>
      </div>
    </dialog>
    <div className="assessment-content" ref={stage}>
    {sequence && <AssessmentChallenges />}
    {!sequence && (m.phase === 'build' || m.phase === 'revise') && <>

      <Panel title={m.phase === 'build' ? 'Build your helper' : 'Revise your helper'}>
        <ProblemMenu focus={focus} choose={focus => update({ focus })} />
        <p>{getChallenge(focus)!.story}</p>
        <p>Add and order safeguards for this problem. To reuse a block across services, set it to “All school services”.</p>
        <details open><summary className="font-bold cursor-pointer">Workload and budget · {BUDGET} credits</summary>
          <p className="my-2">Each case uses the workload of its school service. For each case, multiply the cost of the blocks that run by the number of requests below. The target is to handle all cases within budget.</p>
          <ul className="grid sm:grid-cols-2 gap-x-5">{DESKS.map(d => <li key={d.id}>{d.name} × {d.volume}</li>)}</ul>
        </details>
        <p className="font-bold">Estimated workload · {estimateCost(m.draft)} / {BUDGET} credits if every selected block runs</p>
        <RuleEditor focus={focus} rules={m.draft} change={draft => update({ draft })} />
        {m.phase === 'build' ? <>
          <Writing label="Design note (optional): which risk did you plan for?" value={m.anticipation} change={anticipation => update({ anticipation })} />
          <button className={primary} onClick={() => update({ first: m.draft.slice(), phase: 'evaluation' })}>Run build evaluation</button>
        </> : <>
          <Writing label="What will you change or keep, and why?" hint="Use a replay step and explain the cost of your choice." value={m.revision} change={revision => update({ revision })} />
          <button className={primary} disabled={!m.revision.trim()} onClick={() => update({ final: m.draft.slice(), phase: 'release' })}>Submit revision</button>
        </>}
      </Panel></>}
    {m.phase === 'evaluation' && <Panel title="Your build evaluation">
      <p>Your submitted stack ran against all {ASSIGNED_CASES.length} assigned requests. Open a case to see the reply, which blocks ran and what they cost.</p>
      <button className={primary} onClick={() => update({ phase: 'attack' })}>Start Attack with this helper</button>
      <BuildReport rules={m.first!} />
    </Panel>}
    {!sequence && m.phase === 'attack' && <Panel title="Attack your helper"><AttackWorkbench companion={companion} /></Panel>}
    {m.phase === 'release' && (!sequence || allChallengesComplete(m)) && <Panel title="Review your helper for release">
      <p>{sequence && 'Review your services and their projected operating cost in the tracker. '}Read this exchange and decide what the ecology club can safely share with families.</p>
      <p><b>Club request</b> · {TRANSFER.request}</p><blockquote className="border-l-4 border-line pl-4"><b>Helper draft</b> · {TRANSFER.reply}</blockquote>
      <p><b>Current source</b> · {TRANSFER.source}</p>
      <label className="block font-bold">Your decision<select className={field} value={m.decision} onChange={e => update({ decision: e.target.value })}>
        <option disabled value="">Choose a decision</option>{['Publish', 'Edit before publishing', 'Ask a person first'].map(d => <option key={d}>{d}</option>)}</select></label>
      <Writing label={`What should the club tell families?${isRequired(m, 'release') ? '' : ' (optional)'}`} hint="State your decision, point to the evidence, and identify who should check any uncertainty." value={m.rationale} change={rationale => update({ rationale })} />
      <button className={primary} disabled={!m.decision || (isRequired(m, 'release') && !m.rationale.trim())} onClick={() => update({ phase: 'complete' })}>Submit assessment</button>
    </Panel>}
    {ended && <Panel title={m.phase === 'expired' ? 'Time ended' : 'Your assessment evidence'}><MissionReport mission={m} />
    </Panel>}
    </div>
  </div>;
}
