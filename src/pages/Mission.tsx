import { useEffect, useMemo, type ReactNode } from 'react';
import { ASSIGNED_CASES, BRIEF, DESKS, SOURCE_PACK, TRANSFER } from '../data/mission';
import { getChallenge } from '../data/challenges';
import { AttackWorkbench, ProblemMenu, RuleEditor } from '../components/MissionWorkbench';
import { allChallengesComplete, BUDGET, estimateCost, type Phase } from '../engine/mission';
import AssessmentChallenges from '../components/AssessmentChallenges';
import { useMission } from '../store/mission';
import TrainingCompanion from '../components/TrainingCompanion';
import { BuildReport, MissionReport } from '../components/MissionReport';

const field = 'block mt-1 w-full rounded border-1.5 border-line p-2 bg-white text-ink';
const primary = 'btn bg-signal';
const phases: Record<Phase, string> = {
  menu: 'Assessment checklist', brief: 'Meet your helper', build: 'Build', evaluation: 'Build evaluation', attack: 'Attack', revise: 'Revise', release: 'Release decision',
  complete: 'Assessment evidence', expired: 'Assessment evidence',
};

function Writing({ label, value, change, hint }: { label: string; value: string; change: (v: string) => void; hint?: string }) {
  return <label className="block"><b>{label}</b>{hint && <span className="block text-sm text-ink-2">{hint}</span>}
    <textarea className={field} rows={3} value={value} onChange={e => change(e.target.value)} /></label>;
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
  const sequence = m.form === 4 || m.phase === 'brief';
  const ended = m.phase === 'complete' || m.phase === 'expired';
  useActiveClock(!ended && m.phase !== 'brief');
  const rules = m.phase === 'attack' && m.first ? m.first : m.draft;
  const companionScript = useMemo(() => rules.map(({ type }) => ({ type, uid: type })), [rules]);
  const companion = <TrainingCompanion id="community" script={companionScript} hintCount={m.attackHints?.length} />;
  const remaining = m.minutes * 60 - m.elapsed;
  const focus = m.focus ?? DESKS[0].id;
  useEffect(() => { window.scrollTo(0, 0); }, [m.phase]);
  return <div className={`${sequence && ['build', 'revise', 'attack'].includes(m.phase) ? 'max-w-[1450px]' : 'max-w-5xl'} mx-auto px-4 py-8 space-y-5`}>
    <header className="mission-header"><p className="label">AI literacy assessment</p><h1 className="text-4xl font-extrabold mt-1">School community helper</h1>
      <div className="flex justify-between items-baseline gap-4 mt-3"><p className="font-bold">{phases[m.phase]}</p>
        {!ended && m.phase !== 'brief' && <span className="font-mono">{m.minutes ? Math.floor(remaining / 60) + 'm ' + (remaining % 60) + 's left' : 'Untimed'}</span>}</div>
      {(sequence ? m.phase === 'brief' : m.phase !== 'attack') && companion}
    </header>
    {!ended && <details open={m.phase === 'brief'} className="rounded-md border border-line p-4">
      <summary className="cursor-pointer font-bold">Your agent’s brief and source pack</summary><p className="my-3">{BRIEF}</p>
      <ul className="space-y-1">{SOURCE_PACK.map(([name, detail]) => <li key={name}><b>{name}</b> · {detail}</li>)}</ul>
    </details>}
    {sequence && !ended && m.phase !== 'release' && <AssessmentChallenges />}
    {!sequence && !ended && <details><summary className="cursor-pointer font-bold">Switch to the six-challenge assessment</summary>
      <p>This replaces your unfinished earlier attempt.</p><button className="btn bg-paper" onClick={restart}>Start a fresh assessment</button></details>}
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
    {m.phase === 'release' && (!sequence || allChallengesComplete(m)) && <Panel title="Make an independent release decision">
      <p>Everyone reviews this earlier exchange from the community helper. Use the current source and decide what a pupil should do next.</p>
      <p><b>Club request</b> · {TRANSFER.request}</p><blockquote className="border-l-4 border-line pl-4"><b>Helper draft</b> · {TRANSFER.reply}</blockquote>
      <p><b>Current source</b> · {TRANSFER.source}</p>
      <label className="block font-bold">Your decision<select className={field} value={m.decision} onChange={e => update({ decision: e.target.value })}>
        <option disabled value="">Choose a decision</option>{['Publish', 'Edit before publishing', 'Ask a person first'].map(d => <option key={d}>{d}</option>)}</select></label>
      <Writing label="What should the club tell families? Use the source and explain who should settle any uncertainty." value={m.rationale} change={rationale => update({ rationale })} />
      <button className={primary} disabled={!m.decision || !m.rationale.trim()} onClick={() => update({ phase: 'complete' })}>Submit assessment</button>
    </Panel>}
    {ended && <Panel title={m.phase === 'expired' ? 'Time ended' : 'Your assessment evidence'}><MissionReport mission={m} />
      <details><summary className="font-bold cursor-pointer">Start a fresh assessment</summary><p className="my-2">Download the evidence first if you want to keep this attempt.</p>
        <button className="btn bg-paper" onClick={restart}>Replace this attempt</button></details></Panel>}
  </div>;
}
