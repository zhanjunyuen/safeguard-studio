import { useEffect, useMemo, type ReactNode } from 'react';
import { ASSIGNMENT, ASSIGNED_CASES, BRIEF, DESKS, PALETTE, missionCase, SOURCE_PACK, TRANSFER } from '../data/mission';
import { BLOCKS } from '../data/blocks';
import { BUDGET, blockCredits, estimateCost, evaluate, nextAssignedCase, type Rule, type Phase } from '../engine/mission';
import { useMission } from '../store/mission';
import TrainingCompanion from '../components/TrainingCompanion';
import { BuildReport, MissionReport, Trace } from '../components/MissionReport';

const field = 'block mt-1 w-full rounded border-1.5 border-line p-2 bg-white text-ink';
const primary = 'btn bg-signal';
const phases: Record<Phase, string> = {
  brief: 'Meet your helper', build: 'Build', attack: 'Attack', revise: 'Revise', release: 'Release decision',
  complete: 'Assessment evidence', expired: 'Assessment evidence',
};

function Writing({ label, value, change, hint }: { label: string; value: string; change: (v: string) => void; hint?: string }) {
  return <label className="block"><b>{label}</b>{hint && <span className="block text-sm text-ink-2">{hint}</span>}
    <textarea className={field} rows={3} value={value} onChange={e => change(e.target.value)} /></label>;
}
function Panel({ children, title }: { children: ReactNode; title: string }) {
  return <section className="bg-paper-card border-1.5 border-ink rounded-md p-5 md:p-7 space-y-4"><h2 className="text-2xl font-extrabold">{title}</h2>{children}</section>;
}

function RuleEditor({ rules, change }: { rules: Rule[]; change: (r: Rule[]) => void }) {
  function move(from: number, to: number) {
    const next = rules.slice();
    next.splice(to, 0, ...next.splice(from, 1));
    change(next);
  }
  return <div className="grid md:grid-cols-2 gap-5">
    <div><h3 className="font-bold mb-2">Available blocks</h3>
      <ul className="space-y-2">{PALETTE.map(t => <li key={t}><button className="w-full text-left border rounded p-2 disabled:opacity-50"
        disabled={rules.some(b => b.type === t)} onClick={() => change([...rules, { type: t, scope: 'all' }])}>
        <b>{BLOCKS[t].label}</b> · {blockCredits(t)} credits<br /><span className="text-sm">{BLOCKS[t].hint}</span>
      </button></li>)}</ul></div>
    <div><h3 className="font-bold mb-2">Your helper, in order</h3><ol className="space-y-2">{rules.map((r, i) => {
      const label = BLOCKS[r.type].label;
      return <li className="border-l-4 rounded bg-paper p-3" style={{ borderColor: BLOCKS[r.type].color }} key={r.type}>
        <b>{i + 1}. {label}</b> · {blockCredits(r.type)} credits
        {r.type !== 'ask_ai' && <select className={field} aria-label={'Requests using ' + label} value={r.scope}
          onChange={e => change(rules.map((v, j) => i === j ? { ...v, scope: e.target.value as Rule['scope'] } : v))}>
          <option value="all">All requests</option>{DESKS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
        <div className="flex flex-wrap gap-4 mt-2 text-sm font-bold">
          <button disabled={i === 0} className="underline disabled:opacity-30" aria-label={'Move up ' + label} onClick={() => move(i, i - 1)}>Move up</button>
          <button disabled={i === rules.length - 1} className="underline disabled:opacity-30" aria-label={'Move down ' + label} onClick={() => move(i, i + 1)}>Move down</button>
          {r.type !== 'ask_ai' && <button className="underline" aria-label={'Remove ' + label} onClick={() => change(rules.filter((_, j) => j !== i))}>Remove</button>}
        </div></li>;
    })}</ol></div>
  </div>;
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
  const { mission: m, pending, setPending, update, submitProbe, restart } = useMission();
  const ended = m.phase === 'complete' || m.phase === 'expired';
  useActiveClock(!ended && m.phase !== 'brief');
  const rules = m.phase === 'attack' && m.first ? m.first : m.draft;
  const companionScript = useMemo(() => rules.map(({ type }) => ({ type, uid: type })), [rules]);
  const remaining = m.minutes * 60 - m.elapsed;
  const probeId = nextAssignedCase(m.probes);
  const assigned = probeId ? missionCase(probeId) : null;
  const previousProbe = m.probes.at(-1);
  return <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
    <header className="mission-header"><p className="label">AI literacy assessment</p><h1 className="text-4xl font-extrabold mt-1">School community helper</h1>
      <div className="flex justify-between items-baseline gap-4 mt-3"><p className="font-bold">{phases[m.phase]}</p>
        {!ended && m.phase !== 'brief' && <span className="font-mono">{m.minutes ? Math.floor(remaining / 60) + 'm ' + (remaining % 60) + 's left' : 'Untimed'}</span>}</div>
      <TrainingCompanion id="community" script={companionScript} />
    </header>
    {!ended && <details open={m.phase === 'brief'} className="rounded-md border border-line p-4">
      <summary className="cursor-pointer font-bold">Your agent’s brief and source pack</summary><p className="my-3">{BRIEF}</p>
      <ul className="space-y-1">{SOURCE_PACK.map(([name, detail]) => <li key={name}><b>{name}</b> · {detail}</li>)}</ul>
    </details>}
    {m.phase === 'brief' && <Panel title="Your assigned task">
      <p>{ASSIGNMENT} You will test your helper on {ASSIGNED_CASES.length} requests in this order.</p>
      <ol className="list-decimal ml-6">{DESKS.map(d => <li key={d.id}>{d.title} · {d.cases.length} requests</li>)}</ol>
      <label className="block font-bold">Time allowance<select className={field} value={m.minutes} onChange={e => update({ minutes: Number(e.target.value) })}>
        <option value={0}>Untimed</option>{[15, 25, 40, 60].map(n => <option key={n} value={n}>{n} active minutes</option>)}</select></label>
      <p className="text-sm">Choose the allowance agreed with your teacher. Both modes use the same tasks and marking criteria.</p>
      <button className={primary} onClick={() => update({ phase: 'build' })}>Start building</button>
    </Panel>}
    {(m.phase === 'build' || m.phase === 'revise') && <>
      {m.phase === 'revise' && <Panel title="Review your first build"><BuildReport rules={m.first!} /></Panel>}
      <Panel title={m.phase === 'build' ? 'Build your helper' : 'Revise your helper'}>
        <p>Arrange the blocks in the order they should run. Give a block a specific service if only those requests need it.</p>
        <details open><summary className="font-bold cursor-pointer">Workload and budget · {BUDGET} credits</summary>
          <p className="my-2">Each case uses the workload of its school service. For each case, multiply the cost of the blocks that run by the number of requests below. The target is to handle all cases within budget.</p>
          <ul className="grid sm:grid-cols-2 gap-x-5">{DESKS.map(d => <li key={d.id}>{d.name} × {d.volume}</li>)}</ul>
        </details>
        <p className="font-bold">Estimated workload · {estimateCost(m.draft)} / {BUDGET} credits if every selected block runs</p>
        <RuleEditor rules={m.draft} change={draft => update({ draft })} />
        {m.phase === 'build' ? <>
          <Writing label="Predict a risk in the assigned school requests. Which decision in your build addresses it?" value={m.anticipation} change={anticipation => update({ anticipation })} />
          <button className={primary} disabled={!m.anticipation.trim()} onClick={() => update({ first: m.draft.slice(), phase: 'attack' })}>Submit build and start Attack</button>
        </> : <>
          <Writing label="What will you change or keep, and why?" hint="Use a replay step and explain the cost of your choice." value={m.revision} change={revision => update({ revision })} />
          <button className={primary} disabled={!m.revision.trim()} onClick={() => update({ final: m.draft.slice(), phase: 'release' })}>Submit revision</button>
        </>}
      </Panel></>}
    {m.phase === 'attack' && <Panel title="Test the helper you built">
      <p>Your submitted blocks are locked. Work through the assigned requests in order. Record your prediction and reason before seeing each replay. A correct prediction earns credit whether the helper succeeds or struggles.</p>
      <ol className="list-decimal ml-6">{m.first!.map(r => <li key={r.type}>{BLOCKS[r.type].label} · {DESKS.find(d => d.id === r.scope)?.name || 'All requests'}</li>)}</ol>
      {previousProbe && <div><p className="font-bold">Previous prediction · {previousProbe.prediction}</p>
        <p>{previousProbe.reason}</p><Trace key={previousProbe.id} run={evaluate(m.first!, previousProbe.id)} /></div>}
      {assigned && probeId ? <>
        <h3 className="font-bold">Request {m.probes.length + 1} of {ASSIGNED_CASES.length} · {assigned.desk.title}</h3>
        <blockquote className="border-l-4 border-line pl-4">{assigned.test.question}</blockquote>
        <label className="block font-bold">What will happen?<select className={field} value={pending.prediction || ''} onChange={e => setPending({ prediction: e.target.value as 'handles' | 'struggles' })}>
          <option value="" disabled>Choose a prediction</option><option value="handles">Handles it safely and usefully</option><option value="struggles">Struggles or refuses unnecessarily</option></select></label>
        <Writing label="Which block or missing check makes you think so?" value={pending.reason || ''} change={reason => setPending({ reason })} />
        <button className={primary} disabled={!pending.prediction || !pending.reason?.trim()} onClick={() => submitProbe({ id: probeId, prediction: pending.prediction!, reason: pending.reason! })}>Commit prediction and see replay</button>
      </> : <button className={primary} onClick={() => update({ phase: 'revise' })}>Review and revise</button>}
    </Panel>}
    {m.phase === 'release' && <Panel title="Make an independent release decision">
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
