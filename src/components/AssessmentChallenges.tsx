import { ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { joinClass } from '../lib/sync';
import { useTeacherSettings } from '../store/teacherSettings';
import { THEMES } from '../data/themes';
import AssessmentIntro from './AssessmentIntro';
import AssessmentTracker from './AssessmentTracker';
import { Trace } from './MissionReport';
import { getChallenge } from '../data/challenges';
import { allChallengesComplete, challengeIdFor, newAssessment, type AssessmentLevel, type Desk } from '../engine/mission';
import { coreTestsPassed, ATTACK_PASS_MIN } from '../engine/breaker';
import { blockKey } from '../engine/scriptText';
import Builder from '../pages/Builder';
import Breaker from '../pages/Breaker';
import { useMission } from '../store/mission';
import { useAssessmentSession, useSession } from '../store/session';
import { usefulnessTarget } from '../engine/targets';
import { assessmentBudget, evaluateDesk, latestEffectiveness, serviceWorkloads } from '../engine/challengeEvidence';
import CurveballCard from './CurveballCard';
import { assignmentFor, isRequired, QUESTIONS, TIME_OPTIONS } from '../engine/assessmentSettings';
import { submitCurveball } from '../engine/curveball';

/** Pupils who started with a class code type their first name once to join the class. */
function JoinName({ code }: { code: string }) {
  const joined = useSession(s => s.joined);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await joinClass(code, name.trim());
    setBusy(false);
    if ('error' in res) setError(res.error); else joined(res.code, res.className, res.id, name.trim());
  }
  return <form onSubmit={submit} className="rounded-md border-1.5 border-ink bg-paper-card p-4 sm:p-6 space-y-4 shadow-hard" data-testid="join-name">
    <p className="label text-ink-3">Class {code}</p>
    <h2 className="text-3xl font-extrabold">What's your first name?</h2>
    <p className="text-ink-2">Your teacher sees your results under this name. Your class results include the blocks you tested and how they performed.</p>
    <div className="flex flex-wrap gap-3">
      <input value={name} onChange={e => setName(e.target.value)} required maxLength={30} autoFocus aria-label="First name"
        className="w-56 rounded border-1.5 border-ink bg-paper px-3 py-2.5 text-lg" data-testid="first-name" />
      <button disabled={busy || !name.trim()} className="btn bg-signal text-lg">{busy ? 'Joining…' : 'Join class'} <ArrowRight size={18} aria-hidden /></button>
    </div>
    {error && <p className="text-fail font-bold" role="alert">{error}</p>}
  </form>;
}

export default function AssessmentChallenges() {
  const { mission: m, update, launch } = useMission();
  const joinedClass = useSession(s => s.classCode);
  const studentId = useSession(s => s.studentId);
  const className = useSession(s => s.className);
  const deviceSettings = useTeacherSettings(s => s.settings);
  const needsName = !!m.classCode && joinedClass !== m.classCode;
  const work = useAssessmentSession(s => s.progress);
  const desk = m.focus;
  const { assigned, level, workloadModel } = m;
  const budget = useMemo(() => assessmentBudget({ assigned, level, workloadModel }), [assigned, level, workloadModel]);
  const workloads = useMemo(() => serviceWorkloads({ assigned, level, workloadModel }, work), [assigned, level, workloadModel, work]);
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
    if (!m.launches?.some(l => l.desk === id) || !m.curveballs?.[id] || m.completed?.includes(id)) return;
    update({ completed: [...(m.completed ?? []), id], revising: { ...m.revising, [id]: false }, phase: 'menu', focus: undefined, first: null });
  }
  const tracker = <AssessmentTracker key={m.phase === 'brief' ? 'setup' : 'assigned'} serviceCount={m.phase === 'brief' ? (m.settings ?? deviceSettings).challenges?.length ?? (m.settings ?? deviceSettings).taskCount ?? THEMES.length : workloads.length} phase={m.phase} focus={desk} levelName={levelName}
    workloadModel={workloadModel} workloads={workloads} used={used} budget={budget} completed={m.completed ?? []}
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
      {last?.blockQuality && <p>Block quality · {last.blockQuality.score}/100</p>}
      {last && evaluateDesk(desk, last.script, m.level, workloadModel, !!last.blockQuality).map(row => <Trace key={row.id} run={row} />)}
      <button className="btn bg-paper" onClick={menu}>Whole-helper overview</button>
    </section></>;
  }
  if (desk && service && (m.phase === 'build' || m.phase === 'revise')) {
    const revising = m.phase === 'revise';
    const notes = revising ? 'revisionNotes' : 'designNotes';
    return <>{tracker}<Builder key={desk} assessment={{ id: desk, level2: level2, onMenu: menu, revising, workload: service, workloadModel,
      classStudentId: m.classCode && m.classCode === joinedClass ? studentId : null,
      noteRequired: isRequired(m, revising ? 'revision' : 'design'),
      note: m[notes]?.[desk] ?? '', onNote: value => update({ [notes]: { ...m[notes], [desk]: value } }),
      onAttack: () => {
        const progress = work[desk];
        const last = progress?.attempts.slice(-1)[0];
        if (!last?.blockQuality || progress.pendingReflection || last.script.join() !== progress.script.map(blockKey).join()) return;
        if (revising) { finish(desk); return; }
        if (!last.blockQuality.designPassed || coreTestsPassed(desk, last.results) < ATTACK_PASS_MIN) return;
        const rules = last.script.map(type => ({ type, scope: desk }));
        update({ phase: 'attack', first: rules, frozen: { ...m.frozen, [desk]: rules } });
      },
    }} /></>;
  }
  if (desk && m.phase === 'attack' && m.frozen?.[desk]) {
    const launched = m.launches?.some(l => l.desk === desk);
    const rules = m.frozen[desk];
    return <>{tracker}<Breaker key={desk} assessment={{ id: desk, level2, rules, hintCount: m.attackHints?.length ?? 0, curveballPending: !m.curveballs?.[desk],
      curveball: launched && <CurveballCard key={'cb-' + desk} desk={desk} challengeId={challengeIdFor(m, desk)} reasonRequired={isRequired(m, 'curveball')} rules={rules} answer={m.curveballs?.[desk]}
        onSubmit={answer => update(submitCurveball(useMission.getState().mission, desk, answer))} />,
      customDraft: m.customDrafts?.[desk] ?? '', customResult: m.launches?.find(l => l.desk === desk)?.custom,
      changeCustom: text => update({ customDrafts: { ...m.customDrafts, [desk]: text } }),
      plan: m.attackPlans?.[desk] ?? [], submitted: m.launches?.find(l => l.desk === desk)?.ids,
      changePlan: ids => update({ attackPlans: { ...m.attackPlans, [desk]: ids } }), submit: launch,
      reason: m.launches?.find(l => l.desk === desk)?.reason ?? m.attackReasons?.[desk] ?? '',
      changeReason: value => update({ attackReasons: { ...m.attackReasons, [desk]: value } }),
      reasonRequired: isRequired(m, 'attack'),
      onMenu: menu, onFinish: () => finish(desk),
      onRevise: () => update({ phase: 'revise', revising: { ...m.revising, [desk]: true } }),
    }} />
    </>;
  }
  if (m.phase === 'brief') {
    if (needsName) return <JoinName code={m.classCode!} />;
    const settings = m.settings ?? deviceSettings;
    const count = settings.challenges?.length ?? settings.taskCount ?? THEMES.length;
    const levelFixed = settings.level !== null, timeFixed = settings.minutes !== null;
    const chosenLevel = settings.level ?? m.level ?? 1;
    const required = QUESTIONS.filter(q => settings.questions[q.key] === 'required');
    return <>{tracker}<section className="assessment-setup rounded-md border-1.5 border-ink bg-paper-card p-4 sm:p-6 space-y-3" data-testid="assessment-brief">
      <div>
        <p className="label text-ink-3">{className ? `${className} · ` : ''}Your brief</p>
        <h2 className="text-3xl font-extrabold mt-1">One helper for {count === 1 ? 'one school service' : `${count} school services`}</h2>
      </div>
      <p>Your services share a compute budget. Credits estimate the work your blocks do on incoming requests. Test your safeguards, predict an attack and a curveball, then decide what to release.</p>
      {settings.challenges && <p><b>Your teacher chose:</b> {settings.challenges.map(id => getChallenge(id)?.title).join(', ')}.</p>}
      <p className="text-sm text-ink-2"><b className="text-ink">Written answers you must give:</b> {required.length ? required.map(q => q.label.toLowerCase()).join(', ') : 'none (all are optional)'}. The AI marker gives feedback on each one.</p>
      {levelFixed ? <p><b>Level:</b> {chosenLevel === 2 ? 'Level 2 · IF blocks' : 'Level 1'} (set by your teacher)</p> : <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-2 font-bold">Choose your level</legend>
        {([[1, 'Level 1', 'Order safeguards to handle six hidden tests per service.'],
          [2, 'Level 2 · IF blocks (harder)', "Use conditions to handle an extra edge case and reach a higher usefulness target."]] as [AssessmentLevel, string, string][])
          .map(([value, title, text]) => <label key={value} className={`flex gap-3 rounded border-1.5 p-3 cursor-pointer ${chosenLevel === value ? 'border-ink bg-signal-soft' : 'border-line'}`}>
            <input type="radio" name="assessment-level" className="mt-1" checked={chosenLevel === value} onChange={() => update({ level: value })} data-testid={'choose-level-' + value} />
            <span><b>{title}</b><span className="block text-sm">{text}</span></span>
          </label>)}
      </fieldset>}
      {timeFixed ? <p><b>Time:</b> {settings.minutes ? `${settings.minutes} active minutes` : 'Untimed'} (set by your teacher)</p> : <label className="block font-bold">Time allowance
        <select className="block mt-1 rounded border-1.5 border-ink bg-paper-card p-2" value={m.minutes} onChange={e => update({ minutes: Number(e.target.value) })}>
          {TIME_OPTIONS.map(n => <option key={n} value={n}>{n ? `${n} active minutes` : 'Untimed'}</option>)}
        </select>
      </label>}
      <AssessmentIntro onContinue={() => {
        useAssessmentSession.getState().resetAll();
        update({ ...newAssessment(), owner: studentId, classCode: m.classCode, settings, assigned: assignmentFor(settings),
          minutes: settings.minutes ?? m.minutes, level: chosenLevel, phase: 'menu' });
      }}>Start {chosenLevel === 2 ? 'Level 2' : 'Level 1'} <ArrowRight size={18} aria-hidden /></AssessmentIntro>
    </section></>;
  }
  return <>{tracker}<section className="assessment-overview">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h2 className="text-2xl font-extrabold">Your services</h2><p className="text-sm text-ink-2">Choose a service to build, test or revise.</p></div>
      <b className="text-sm">{m.completed?.length ?? 0} of {workloads.length} ready</b>
    </div>
    <ul className="assessment-services">
      {workloads.map(d => {
        const done = m.completed?.includes(d.id);
        const stage = m.revising?.[d.id] ? 'revision' : m.frozen?.[d.id] ? 'attack' : 'build';
        const latest = latestEffectiveness(work[d.id]);
        const action = done ? 'Review service' : work[d.id] ? 'Resume ' + stage : 'Build service';
        return <li key={d.id}><button className="service-choice" onClick={() => open(d.id)} data-testid={'assess-' + d.id}>
          <strong>{d.title}</strong>
          <span className="text-sm text-ink-2">{done && 'Ready · '}{d.credits} credits{latest.tested ? ` · ${latest.passed}/${latest.tested} tests passed` : ''}{level2 && ` · Target ${usefulnessTarget(d.id + '@2')}`}</span>
          <span className="service-action"><span className="sr-only sm:not-sr-only">{action} </span>→</span>
        </button></li>;
      })}
    </ul>
    {finished && <button className="btn bg-signal" onClick={() => update({ phase: 'release' })}>Continue to release decision</button>}
  </section></>;
}
