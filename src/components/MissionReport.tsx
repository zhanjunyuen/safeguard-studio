import { Link } from 'react-router-dom';
import { COMPETENCY_META, BLOCKS } from '../data/blocks';
import { BUDGET, evaluate, evaluateBuild, evidence, handled, totalCost, type Mission } from '../engine/mission';
import { missionCase } from '../data/mission';
import { useMission } from '../store/mission';

export function Trace({ run }: { run: ReturnType<typeof evaluate> }) {
  return <details className="border-t border-line py-2">
    <summary className="cursor-pointer font-bold">{missionCase(run.id).test.title} · {handled(run) ? 'Handled' : 'Needs attention'} · {run.credits} credits</summary>
    <p className="mt-2">{missionCase(run.id).test.question}</p>
    <blockquote className="my-2 border-l-4 border-line pl-3">{run.result.reply}</blockquote>
    <p>{run.result.explanation}</p>
    <ol className="ml-6 my-3 list-decimal">{run.result.steps.map(s => <li key={s.uid}><b>{s.blockType === 'trigger' ? 'Request' : s.blockType === 'reply' ? 'Reply' : BLOCKS[s.blockType].label}</b> — {s.message}</li>)}</ol>
    <p className="text-sm">{run.charges.map(c => BLOCKS[c.block].label + ' (' + c.unit + ')').join(' + ') || '0'} × {run.volume} requests = {run.credits} credits</p>
  </details>;
}

export function BuildReport({ rules }: { rules: NonNullable<Mission['first']> }) {
  const rows = evaluateBuild(rules);
  const allHandled = rows.every(handled);
  const credits = totalCost(rows);
  return <div className="space-y-2">
    <p><b>{rows.filter(handled).length} of {rows.length}</b> cases handled · <b>{credits} / {BUDGET}</b> workload credits</p>
    <p>{allHandled ? (credits <= BUDGET ? 'Efficiency target met.' : 'All cases handled. The design exceeds the reference budget.') : 'Efficiency credit requires a useful, safe response to every common case.'}</p>
    <ul className="flex flex-wrap gap-x-5 gap-y-1 py-2">{Object.entries(COMPETENCY_META).map(([key, meta]) => {
      const cases = rows.filter(r => r.result.category === key);
      return <li key={key}>{meta.short} · {cases.filter(handled).length}/{cases.length}</li>;
    })}</ul>
    {rows.map(row => <Trace key={row.id} run={row} />)}
  </div>;
}

function exportEvidence(m: Mission) {
  const blob = new Blob([JSON.stringify(evidence(m), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'school-community-evidence.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MissionReport({ mission: m }: { mission: Mission }) {
  const packet = evidence(m);
  return <div className="space-y-4">
    <p>{m.minutes ? m.minutes + '-minute limit' : 'Untimed'} · {Math.floor(m.elapsed / 60)}m {m.elapsed % 60}s active · {m.phase === 'expired' ? 'Time ended. Missing submissions are unattempted.' : 'Submitted'}</p>
    <p><b>Community project</b> · {m.project}</p>
    <p><b>Anticipated risk</b> · {packet.anticipation || 'Unattempted'}</p>
    <details><summary className="cursor-pointer font-bold">First build</summary>{m.first ? <BuildReport rules={m.first} /> : 'Unattempted'}</details>
    <div><h3 className="font-bold">Attack predictions</h3><p>{packet.probes.filter(p => p.correct).length} correct across {packet.probes.length} submitted · {2 - packet.probes.length} unattempted</p>
      {packet.probes.map(p => <div key={p.id} className="my-2"><p>Predicted “{p.prediction}” · {p.reason}</p><Trace run={p.run} /></div>)}</div>
    <details><summary className="cursor-pointer font-bold">Revised build</summary>{m.final ? <BuildReport rules={m.final} /> : 'Unattempted'}</details>
    <p><b>Student-designed test</b> · {packet.authoredProbe || 'Unattempted'}</p>
    <p><b>Revision decision</b> · {packet.revision || 'Unattempted'}</p>
    <p><b>Independent decision</b> · {m.phase === 'complete' ? m.decision + ' · ' + m.rationale : 'Unattempted'}</p>
    <p>Open responses await teacher review. The evidence file includes the prompts, scripts and replays for marking.</p>
    <button className="btn bg-paper" onClick={() => exportEvidence(m)}>Download marking evidence</button>
  </div>;
}

export function MissionResultLink() {
  const m = useMission(s => s.mission);
  if (m.phase === 'brief') return null;
  const ended = ['complete', 'expired'].includes(m.phase);
  return <section className="rounded-md border-1.5 border-ink p-5 bg-paper-card my-4">
    <h2 className="font-bold text-xl">School community assessment</h2>
    <p className="mt-1">{m.project}</p>
    <Link to="/mission" className="underline font-bold">{ended ? 'View assessment evidence' : 'Resume assessment'}</Link>
  </section>;
}
