import WorkloadBar, { workloadFormula } from './WorkloadBar';
import { challengeEvidence } from '../engine/challengeEvidence';
import { useAssessmentSession } from '../store/session';
import { Link } from 'react-router-dom';
import { COMPETENCY_META, BLOCKS } from '../data/blocks';
import { BUDGET, LEGACY_BUDGET, evaluate, evaluateBuild, evidence, handled, totalCost, type Desk, type Mission } from '../engine/mission';
import { ASSIGNMENT, DESKS, missionCase } from '../data/mission';
import { usePresenter } from '../store/presenter';
import { useMission } from '../store/mission';
import MarkFeedback from './MarkFeedback';
import FinalResult from './FinalResult';
import AiBadge from './AiBadge';
import { savedMark } from '../engine/aiProviders';
import { challengeMarkRequests } from '../engine/challengeEvidence';
import { useState } from 'react';
import type { MarkRequest } from '../engine/marking';
import { CRITERION_NAME, type Mark } from '../engine/marking';

function PreviewMark({ mark }: { mark: Mark }) {
  return <p className="text-sm text-ink-2">Preview mark ({CRITERION_NAME[mark.criterion]}, {mark.marker}): {mark.level === null ? 'not enough evidence' : 'level ' + mark.level + ' of 2'}
    {' · '}{mark.concepts.filter(c => c.present).map(c => c.id).join(', ') || 'no concepts'} shown{mark.reviewFlag ? ' · flagged for review' : ''}</p>;
}

/** One written answer's mark in the report: the AI mark if it was already made, else the offline
 *  preview, with a button that opens the full AI feedback (and asks the AI only then). */
function AnswerMark({ request, preview }: { request?: MarkRequest; preview?: Mark }) {
  const [open, setOpen] = useState(false);
  if (!request) return preview ? <PreviewMark mark={preview} /> : null;
  const ai = savedMark(request);
  const shown = ai ?? preview;
  return <div className="space-y-2">
    {shown && !open && <p className="text-sm text-ink-2 flex flex-wrap items-center gap-2"><AiBadge ai={!!ai} />
      {CRITERION_NAME[shown.criterion]} · {shown.level === null ? 'not enough evidence' : 'level ' + shown.level + ' of 2'} · {shown.concepts.filter(c => c.present).map(c => c.id).join(', ') || 'no concepts'} shown{shown.reviewFlag ? ' · flagged for review' : ''}</p>}
    {open ? <MarkFeedback request={request} /> : <button className="text-sm font-bold underline underline-offset-2" onClick={() => setOpen(true)}>{ai ? 'Show the feedback' : 'Get AI feedback'}</button>}
  </div>;
}

function RisksMet({ risks }: { risks: { risk: string; title: string; handled: boolean; predictionCorrect: boolean }[] }) {
  if (!risks.length) return null;
  return <section className="rounded-md border-1.5 border-ink p-4"><h3 className="font-bold">AI risks met in the curveballs</h3>
    <ul className="mt-2 space-y-1">{risks.map(r => <li key={r.title}><b>{r.risk}</b> · {r.title} · helper {r.handled ? 'coped' : 'did not cope'} · prediction {r.predictionCorrect ? 'right' : 'wrong'}</li>)}</ul>
    <p className="text-sm mt-2">{risks.filter(r => r.predictionCorrect).length} of {risks.length} predictions right.</p></section>;
}

export function Trace({ run }: { run: ReturnType<typeof evaluate> }) {
  return <details className="border-t border-line py-2">
    <summary className="cursor-pointer font-bold">{missionCase(run.id).test.title} · {handled(run) ? 'Handled' : 'Needs attention'}</summary>
    <p className="mt-2">{missionCase(run.id).test.question}</p>
    <blockquote className="my-2 border-l-4 border-line pl-3">{run.result.reply}</blockquote>
    <p>{run.result.explanation}</p>
    <ol className="ml-6 my-3 list-decimal">{run.result.steps.map(s => <li key={s.uid}><b>{s.blockType === 'trigger' ? 'Request' : s.blockType === 'reply' ? 'Reply' : BLOCKS[s.blockType].label}</b> — {s.message}</li>)}</ol>
    <p className="text-sm">Operating cost if every request follows this path · ({run.charges.map(c => BLOCKS[c.block].label + ' (' + c.unit + ')').join(' + ') || '0'}) × {run.volume} requests = {run.credits} credits</p>
  </details>;
}

export function BuildReport({ rules, legacy = false }: { rules: NonNullable<Mission['first']>; legacy?: boolean }) {
  const rows = evaluateBuild(rules, legacy);
  const budget = legacy ? LEGACY_BUDGET : BUDGET;
  const allHandled = rows.every(handled);
  const credits = totalCost(rows);
  return <div className="space-y-2">
    <p><b>{rows.filter(handled).length} of {rows.length}</b> cases handled · <b>{credits} / {budget}</b> workload credits</p>
    <p>{allHandled ? (credits <= budget ? 'Efficiency target met.' : 'All cases handled. The design exceeds the reference budget.') : 'Efficiency credit requires a useful, safe response to every common case.'}</p>
    <ul className="flex flex-wrap gap-x-5 gap-y-1 py-2">{Object.entries(COMPETENCY_META).map(([key, meta]) => {
      const cases = rows.filter(r => r.result.category === key);
      return <li key={key}>{meta.short} · {cases.filter(handled).length}/{cases.length}</li>;
    })}</ul>
    {rows.map(row => <Trace key={row.id} run={row} />)}
  </div>;
}

function exportEvidence(packet: ReturnType<typeof evidence | typeof challengeEvidence>) {
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'school-community-evidence.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MissionReport({ mission: m }: { mission: Mission }) {
  if (m.form === 4) return <ChallengeReport mission={m} />;
  const packet = evidence(m);
  return <div className="space-y-4">
    <p>{m.minutes ? m.minutes + '-minute limit' : 'Untimed'} · {Math.floor(m.elapsed / 60)}m {m.elapsed % 60}s active · {m.phase === 'expired' ? 'Time ended. Missing submissions are unattempted.' : 'Submitted'}</p>
    <p><b>School assignment</b> · {packet.project}</p>
    <p><b>Anticipated risk</b> · {packet.anticipation || 'Unattempted'}</p>
    <details><summary className="cursor-pointer font-bold">First build</summary>{m.first ? <BuildReport rules={m.first} legacy={!m.form} /> : 'Unattempted'}</details>
    {packet.attackRounds && <div><h3 className="font-bold">Attack results</h3>
      <p>{packet.attackRounds.length} of {DESKS.length} settings tested.</p>
      {packet.attackHints && <details><summary className="cursor-pointer">Companion hints used · {packet.attackHints.length}</summary>
        <ul>{packet.attackHints.map((h,i) => <li key={i}><b>{DESKS.find(d => d.id === h.desk)?.title}</b> · {h.text}</li>)}</ul>
      </details>}
      {packet.attackRounds.map(round => <div key={round.desk}><b>{DESKS.find(d => d.id === round.desk)?.title}</b>
        {round.runs.map(run => <Trace key={run.id} run={run} />)}</div>)}</div>}
    {(m.form !== 3 || packet.probes.length > 0) && <div><h3 className="font-bold">Attack predictions</h3><p>{packet.probes.filter(p => p.correct).length} correct across {packet.probes.length} submitted · {m.form === 3 ? 'from the earlier format' : (packet.requiredPredictions - packet.probes.length) + ' unattempted'}</p>
      {packet.probes.map(p => <div key={p.id} className="my-2"><p>Predicted “{p.prediction}” · {p.reason}</p><Trace run={p.run} /></div>)}</div>}
    <details><summary className="cursor-pointer font-bold">Revised build</summary>{m.final ? <BuildReport rules={m.final} legacy={!m.form} /> : 'Unattempted'}</details>
    {!m.form && <p><b>Student-designed test</b> · {packet.authoredProbe || 'Unattempted'}</p>}
    <p><b>Revision decision</b> · {packet.revision || 'Unattempted'}</p>
    <p><b>Independent decision</b> · {m.phase === 'complete' ? m.decision + ' · ' + m.rationale : 'Unattempted'}</p>
    <p>Open responses await teacher review. The evidence file includes the prompts, scripts and replays for marking.</p>
    <button className="btn bg-paper" onClick={() => exportEvidence(packet)}>Download marking evidence</button>
  </div>;
}

function ChallengeReport({ mission }: { mission: Mission }) {
  const work = useAssessmentSession(s => s.progress);
  const packet = challengeEvidence(mission, work);
  const ended = mission.phase === 'complete' || mission.phase === 'expired';
  return <div className="space-y-4">
    {ended && <FinalResult mission={mission} progress={work} />}
    <p><b>{packet.level === 2 ? 'Level 2 · IF blocks' : 'Level 1'}</b> · {packet.completionOrder.length} of {packet.challenges.length} challenges complete · {mission.minutes ? mission.minutes + '-minute limit' : 'Untimed'} · {Math.floor(mission.elapsed / 60)}m {mission.elapsed % 60}s active</p>
    <WorkloadBar used={packet.workloadCredits} budget={packet.budget} />
    {packet.completionOrder.length === packet.challenges.length && <p>{packet.meetsEfficiencyTarget ? 'Efficiency target met.' : 'The efficiency target requires handling all cases safely and usefully within the budget.'}</p>}
    {packet.challenges.map(c => { const req = challengeMarkRequests(mission, work, c.id as Desk); return <details key={c.id}><summary className="cursor-pointer font-bold">{c.title} · {c.status}</summary>
      <p>{c.effectiveness.tested ? c.effectiveness.passed + " of " + c.effectiveness.tested + " tests passed on the latest build" : "No build tested yet"} · {c.attempts.length} build runs · {workloadFormula(c.creditsPerRequest, c.volume, c.workloadCredits)} · {(c.attack?.ids.length ?? 0) + Number(!!c.attack?.custom)} attack cases tested</p>
      {c.attack?.custom && <p><b>Pupil-written attack</b> · {c.attack.custom.question}<br /><b>AI judgement · {c.attack.custom.outcome}</b> · {c.attack.custom.explanation}</p>}
      {c.attempts.slice(-1)[0]?.cases.map(r => <Trace key={r.id} run={r} />)}
      {c.attack && <div><p><b>Attack prediction</b> · {c.attack.reason ?? 'Not recorded (earlier format)'}</p>
        <AnswerMark request={req.testing} preview={c.previewMarks?.testing} />
        <b>Attack results</b>{c.attack.cases.map(r => <Trace key={r.id} run={r} />)}</div>}
      {c.curveball && <div className="my-2"><p><b>Curveball · {c.curveball.title}</b> ({c.curveball.risk}) · predicted {c.curveball.prediction === 'handles' ? 'handled' : 'gets through'},
        actual {c.curveball.handled ? 'handled' : c.curveball.outcome} · prediction {c.curveball.predictionCorrect ? 'correct' : 'incorrect'}</p>
        <p>{c.curveball.reason}</p><AnswerMark request={req.anticipation} preview={c.curveball.previewMark} /></div>}
      {c.revisionNote && <div><p><b>Revision note</b> · {c.revisionNote}</p><AnswerMark request={req.revision} preview={c.previewMarks?.revision} /></div>}
    </details>; })}
    <details><summary className="cursor-pointer">Companion hints used · {packet.attackHints.length}</summary>
      {packet.attackHints.map((h, i) => <p key={i}>{h.desk} · {h.text}</p>)}</details>
    <p><b>Release decision</b> · {packet.transfer.decision ? packet.transfer.decision + ' · ' + packet.transfer.rationale : 'Unsubmitted'}</p>
    {packet.transfer.previewMark && <MarkFeedback request={{ criterion: 'judgement', text: packet.transfer.rationale!, decision: packet.transfer.decision! }} />}
    <RisksMet risks={packet.challenges.flatMap(c => c.curveball ? [c.curveball] : [])} />
    <button className="btn bg-paper" onClick={() => exportEvidence(packet)}>Download marking evidence</button>
  </div>;
}

export function MissionResultLink() {
  const m = useMission(s => s.mission);
  const presenting = usePresenter(s => s.active);
  if (presenting || m.phase === 'brief') return null;
  const ended = ['complete', 'expired'].includes(m.phase);
  return <section className="rounded-md border-1.5 border-ink p-5 bg-paper-card my-4">
    <h2 className="font-bold text-xl">School community assessment</h2>
    <p className="mt-1">{m.form ? ASSIGNMENT : m.project}</p>
    {m.finalResult && <p className="mt-2 flex flex-wrap items-center gap-2"><span className="font-mono text-2xl font-bold">{m.finalResult.score.total}/100</span>
      <span className="font-bold">{m.finalResult.score.band}</span><AiBadge ai={m.finalResult.ai} /></p>}
    {m.finalResult && <p className="mt-1 text-ink-2">{m.finalResult.verdict}</p>}
    <Link to="/mission" className="underline font-bold">{ended ? 'View assessment evidence' : 'Resume assessment'}</Link>
  </section>;
}
