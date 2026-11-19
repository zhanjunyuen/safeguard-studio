import { useMemo } from 'react';
import AssessmentTracker from './AssessmentTracker';
import { workloadFormula } from './WorkloadBar';
import { drawAssignment } from '../data/mission';
import { Trace } from './MissionReport';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { allChallengesComplete, newAssessment, type AssessmentLevel, type Desk } from '../engine/mission';
import { blockKey } from '../engine/scriptText';
import Builder from '../pages/Builder';
import Breaker from '../pages/Breaker';
import { useMission } from '../store/mission';
import { useAssessmentSession } from '../store/session';
import { usefulnessTarget } from '../engine/targets';
import { assessmentBudget, evaluateDesk, latestEffectiveness, serviceWorkloads } from '../engine/challengeEvidence';
import CurveballCard from './CurveballCard';
import { submitCurveball } from '../engine/curveball';
import { CURVEBALLS } from '../data/curveballs';

export default function AssessmentChallenges() {
  const { mission: m, update, launch } = useMission();
  const work = useAssessmentSession(s => s.progress);
  const desk = m.focus;
  const { assigned, level } = m;
  const budget = useMemo(() => assessmentBudget({ assigned, level }), [assigned, level]);
  const workloads = useMemo(() => serviceWorkloads({ assigned }, work), [assigned, work]);
  const used = workloads.reduce((total, service) => total + service.credits, 0);
  const service = workloads.find(service => service.id === desk);
  const level2 = m.level === 2;
  const levelName = level2 ? 'Level 2 · IF blocks' : 'Level 1';
  const finished = allChallengesComplete(m);
  const current = desk ? latestEffectiveness(work[desk]) : undefined;
  const effectiveness = workloads.reduce((sum, d) => {
    const latest = latestEffectiveness(work[d.id]);
    return { passed: sum.passed + latest.passed, tested: sum.tested + latest.tested };
  }, { passed: 0, tested: 0 });
  const menu = () => update({ phase: 'menu', focus: undefined, first: null });
  function open(id: Desk) {
    if (!workloads.some(d => d.id === id)) return;
    if (m.completed?.includes(id)) { update({ phase: 'menu', focus: id, first: null }); return; }
    const frozen = m.frozen?.[id];
    update({ focus: id, first: frozen ?? null, phase: m.revising?.[id] ? 'revise' : frozen ? 'attack' : 'build' });
  }
  function finish(id: Desk) {
    if (!m.launches?.some(l => l.desk === id) || (CURVEBALLS[id] && !m.curveballs?.[id]) || m.completed?.includes(id)) return;
    update({ completed: [...(m.completed ?? []), id], revising: { ...m.revising, [id]: false }, phase: 'menu', focus: undefined, first: null });
  }
  const tracker = <AssessmentTracker key={m.phase === 'brief' ? 'setup' : 'assigned'} phase={m.phase} focus={desk} levelName={levelName}
    workloads={workloads} used={used} budget={budget} completed={m.completed ?? []}
    effectiveness={effectiveness} current={current} finished={finished} onService={open}
    onOverview={menu} onRelease={() => update({ phase: 'release', focus: undefined, first: null })} />;
  if (m.phase === 'release' || m.phase === 'complete' || m.phase === 'expired') return tracker;
  if (desk && service && m.completed?.includes(desk)) {
    const last = work[desk]?.attempts.slice(-1)[0];
    return <>{tracker}<section className="rounded-md border border-line p-5 space-y-3">
      <h2 className="text-2xl font-extrabold">{getChallenge(desk)!.title} · Complete</h2>
      <p>This service contributes {service.credits} credits to the whole helper. You can revise it before the release decision.</p>
      <button className="btn bg-signal" onClick={() => update({
        phase: 'revise', completed: m.completed?.filter(id => id !== desk),
        revising: { ...m.revising, [desk]: true }, first: m.frozen?.[desk] ?? null,
      })}>Revise this service</button>
      <h3 className="font-bold">Latest build results</h3>
      {last && evaluateDesk(desk, last.script, m.level).map(row => <Trace key={row.id} run={row} />)}
      <button className="btn bg-paper" onClick={menu}>Whole-helper overview</button>
    </section></>;
  }
  if (desk && service && (m.phase === 'build' || m.phase === 'revise')) {
    const revising = m.phase === 'revise';
    const notes = revising ? 'revisionNotes' : 'designNotes';
    return <>{tracker}<Builder key={desk} assessment={{ id: desk, level2: level2, onMenu: menu, revising, workload: service,
      note: m[notes]?.[desk] ?? '', onNote: value => update({ [notes]: { ...m[notes], [desk]: value } }),
      onAttack: () => {
        const progress = work[desk];
        const last = progress?.attempts.slice(-1)[0];
        if (!last || progress.pendingReflection || last.script.join() !== progress.script.map(blockKey).join()) return;
        if (revising) { finish(desk); return; }
        const rules = last.script.map(type => ({ type, scope: desk }));
        update({ phase: 'attack', first: rules, frozen: { ...m.frozen, [desk]: rules } });
      },
    }} /></>;
  }
  if (desk && m.phase === 'attack' && m.frozen?.[desk]) {
    const launched = m.launches?.some(l => l.desk === desk);
    const rules = m.frozen[desk];
    const hasCurveball = !!CURVEBALLS[desk];
    return <>{tracker}<Breaker key={desk} assessment={{ id: desk, level2, rules, hintCount: m.attackHints?.length ?? 0, curveballPending: hasCurveball && !m.curveballs?.[desk],
      plan: m.attackPlans?.[desk] ?? [], submitted: m.launches?.find(l => l.desk === desk)?.ids,
      changePlan: ids => update({ attackPlans: { ...m.attackPlans, [desk]: ids } }), submit: launch,
      reason: m.launches?.find(l => l.desk === desk)?.reason ?? m.attackReasons?.[desk] ?? '',
      changeReason: value => update({ attackReasons: { ...m.attackReasons, [desk]: value } }),
      onMenu: menu, onFinish: () => finish(desk),
      onRevise: () => update({ phase: 'revise', revising: { ...m.revising, [desk]: true } }),
    }} />
    {launched && hasCurveball && <CurveballCard key={'cb-' + desk} desk={desk} rules={rules} answer={m.curveballs?.[desk]}
      onSubmit={answer => update(submitCurveball(useMission.getState().mission, desk, answer))} />}</>;
  }
  if (m.phase === 'brief') return <>{tracker}<section className="rounded-md border-1.5 border-ink bg-paper-card p-6 space-y-4">
    <h2 className="text-2xl font-extrabold">One helper for six school services</h2>
    <p>Your school needs one community helper. You design its safeguards for six services, drawn from {CHALLENGES.length} challenges. Each service has its own audience and set of blocks. All six share one workload budget. Work in any order, compare what each service costs, and revise your choices before releasing the helper.</p>
    <p>For each service, run its hidden tests, predict how your build will respond to an attack, and inspect the replay. Some services also get an unseen request. Your predictions and explanations go into one assessment report.</p>
    <fieldset className="space-y-2">
      <legend className="font-bold">Choose your level</legend>
      {([[1, 'Level 1', 'Build each helper from safeguard blocks and pass the six hidden tests. Every block you add runs on every message and slows the helper down.'],
        [2, 'Level 2 · IF blocks (harder)', "The same six challenges at their harder level. You get IF … THEN and IF … THEN … ELSE blocks, each challenge adds an edge case built to slip past the obvious condition, and the usefulness target is higher than any always-on helper can reach. Conditions only see the words in a message, and \"the AI isn't sure\" is never true."]] as [AssessmentLevel, string, string][])
        .map(([value, title, text]) => <label key={value} className={`flex gap-3 rounded border-1.5 p-3 cursor-pointer ${(m.level ?? 1) === value ? 'border-ink bg-signal-soft' : 'border-line'}`}>
          <input type="radio" name="assessment-level" className="mt-1" checked={(m.level ?? 1) === value} onChange={() => update({ level: value })} data-testid={'choose-level-' + value} />
          <span><b>{title}</b><span className="block text-sm">{text}</span></span>
        </label>)}
    </fieldset>
    <label className="block font-bold">Time allowance
      <select className="block mt-1 rounded border border-line p-2" value={m.minutes} onChange={e => update({ minutes: Number(e.target.value) })}>
        <option value={0}>Untimed</option>{[15, 25, 40, 60].map(n => <option key={n} value={n}>{n} active minutes</option>)}
      </select>
    </label>
    <button className="btn bg-signal" data-testid="start-assessment" onClick={() => {
      useAssessmentSession.getState().resetAll();
      update({ ...newAssessment(), assigned: drawAssignment(), minutes: m.minutes, level: m.level ?? 1, phase: 'menu' });
    }}>Start {levelName}</button>
  </section></>;
  return <>{tracker}<section className="space-y-4">
    <h2 className="text-2xl font-extrabold">Your community helper</h2>
    <p>Choose a service to work on. The tracker shows the projected operating cost of your six current designs. Test runs are free.
      When all six services are ready, review the whole helper and make your release decision.</p>
    <ol className="divide-y divide-line rounded-md border-1.5 border-ink bg-paper-card">
      {workloads.map(d => {
        const c = getChallenge(d.id)!;
        const done = m.completed?.includes(d.id);
        const stage = m.revising?.[d.id] ? 'Revision' : m.frozen?.[d.id] ? 'Attack' : 'Build';
        const latest = latestEffectiveness(work[d.id]);
        return <li key={d.id} className="grid items-center gap-3 p-4 md:grid-cols-[minmax(0,1fr)_13rem_10rem]">
          <div><h3 className="text-lg font-extrabold">{c.title}</h3>
            <p className="text-sm text-ink-2">{c.audience}</p>
            {level2 && <p className="text-sm">Usefulness target · {usefulnessTarget(d.id + '@2')}</p>}
          </div>
          <div className="text-sm"><b>{done ? 'Ready for release' : work[d.id] ? stage + ' in progress' : 'Awaiting build'}</b>
            <p>{latest.tested ? latest.passed + '/' + latest.tested + ' tests passed' : 'No tests run yet'}</p>
            <p>{workloadFormula(d.perRequest, d.volume, d.credits)}</p>
          </div>
          <button className="btn bg-paper justify-center justify-self-start md:justify-self-stretch" onClick={() => open(d.id)} data-testid={'assess-' + d.id}>
            {done ? 'Review service' : work[d.id] ? 'Resume ' + stage.toLowerCase() : 'Build service'}
          </button>
        </li>;
      })}
    </ol>
    <button className="btn bg-signal" disabled={!finished} onClick={() => update({ phase: 'release' })}>Continue to release decision</button>
  </section></>;
}
