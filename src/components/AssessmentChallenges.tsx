import { drawAssignment } from '../data/mission';
import { Trace } from './MissionReport';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { allChallengesComplete, assignedDesks, challengeIdFor, newAssessment, type AssessmentLevel, type Desk } from '../engine/mission';
import { blockKey } from '../engine/scriptText';
import Builder from '../pages/Builder';
import Breaker from '../pages/Breaker';
import { useMission } from '../store/mission';
import { useAssessmentSession } from '../store/session';
import { usefulnessTarget } from '../engine/targets';
import { evaluateDesk, latestEffectiveness } from '../engine/challengeEvidence';
import CurveballCard from './CurveballCard';
import { submitCurveball } from '../engine/curveball';
import { CURVEBALLS } from '../data/curveballs';

export default function AssessmentChallenges() {
  const { mission: m, update, launch } = useMission();
  const work = useAssessmentSession(s => s.progress);
  const desk = m.focus;
  const desks = assignedDesks(m);
  const level2 = m.level === 2;
  const levelName = level2 ? 'Level 2 · IF blocks' : 'Level 1';
  const complete = m.completed?.length ?? 0;
  const finished = allChallengesComplete(m);
  const current = desk ? latestEffectiveness(work[desk]) : undefined;
  const effectiveness = desks.reduce((sum, d) => {
    const latest = latestEffectiveness(work[d.id]);
    return { passed: sum.passed + latest.passed, tested: sum.tested + latest.tested };
  }, { passed: 0, tested: 0 });
  const menu = () => update({ phase: 'menu', focus: undefined, first: null });
  function open(id: Desk) {
    if (!desks.some(d => d.id === id)) return;
    if (m.completed?.includes(id)) { update({ phase: 'menu', focus: id, first: null }); return; }
    const frozen = m.frozen?.[id];
    update({ focus: id, first: frozen ?? null, phase: m.revising?.[id] ? 'revise' : frozen ? 'attack' : 'build' });
  }
  function finish(id: Desk) {
    if (!m.launches?.some(l => l.desk === id) || (CURVEBALLS[id] && !m.curveballs?.[id]) || m.completed?.includes(id)) return;
    update({ completed: [...(m.completed ?? []), id], phase: 'menu', focus: undefined, first: null });
  }
  const tracker = <nav aria-label="Assessment progress and tasks" className="sticky top-0 z-20 rounded-md border-1.5 border-ink bg-paper-card px-4 py-3 shadow-sm">
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="min-w-36"><p className="label text-ink-3" data-testid="assessment-level">{levelName}</p><b>{complete} of {desks.length} challenges complete</b>
        <progress aria-label="Challenges completed" className="block w-full h-2 accent-green-700" value={complete} max={desks.length} />
      </div>
      <div className="flex-1 text-sm"><b>Helper effectiveness</b><p aria-live="polite">{effectiveness.tested
        ? effectiveness.passed + ' of ' + effectiveness.tested + ' tests passed across your latest builds'
        : 'Run a build to see how many tests your helper passes.'}</p>
        {current && current.tested > 0 && <p>This task passed {current.passed} of {current.tested} tests on its latest run.</p>}
      </div>
      <label className="text-sm font-bold">Jump to task
        <select className="block max-w-full rounded border border-line bg-white px-2 py-1" value={m.phase === 'release' ? 'release' : desk ?? ''} onChange={e => {
          if (e.target.value === 'release' && finished) update({ phase: 'release', focus: undefined, first: null });
          else if (e.target.value) open(e.target.value);
          else menu();
        }}>
          <option value="">Assessment checklist</option>
          {desks.map(d => <option key={d.id} value={d.id}>{d.title} · {m.completed?.includes(d.id) ? 'Complete' : work[d.id] ? 'In progress' : 'Not started'}</option>)}
          {finished && <option value="release">Release decision</option>}
        </select>
      </label>
    </div>
  </nav>;
  if (m.phase === 'release') return tracker;
  if (desk && m.completed?.includes(desk)) {
    const last = work[desk]?.attempts.slice(-1)[0];
    return <>{tracker}<section className="rounded-md border border-line p-5 space-y-3">
      <h2 className="text-2xl font-extrabold">{getChallenge(desk)!.title} · Complete</h2>
      <h3 className="font-bold">Latest build results</h3>
      {last && evaluateDesk(desk, last.script, m.level).map(row => <Trace key={row.id} run={row} />)}
      <button className="btn bg-paper" onClick={menu}>Assessment checklist</button>
    </section></>;
  }
  if (desk && (m.phase === 'build' || m.phase === 'revise')) {
    const revising = m.phase === 'revise';
    const notes = revising ? 'revisionNotes' : 'designNotes';
    return <>{tracker}<Builder key={desk} assessment={{ id: desk, level2: level2, onMenu: menu, revising,
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
    {launched && hasCurveball && <CurveballCard key={'cb-' + desk} desk={desk} challengeId={challengeIdFor(m, desk)} rules={rules} answer={m.curveballs?.[desk]}
      onSubmit={answer => update(submitCurveball(useMission.getState().mission, desk, answer))} />}</>;
  }
  if (m.phase === 'brief') return <section className="rounded-md border-1.5 border-ink bg-paper-card p-6 space-y-4">
    <h2 className="text-2xl font-extrabold">Six challenges, one from each theme</h2>
    <p>Your assessment draws six challenges from the {CHALLENGES.length} in the catalogue. You choose which one to work on first. For each one, build with the blocks for that problem, run its hidden tests, and attack the build you evaluated. Each challenge then throws a curveball: a request your helper has never seen, often one no block can fully catch. You predict what will happen and explain why. Your written answers get feedback, and you can ask about it. You can return to the checklist and resume a challenge later.</p>
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
  </section>;
  return <>{tracker}<section className="space-y-4">
    <h2 className="text-2xl font-extrabold">Your six challenges · {levelName}</h2>
    <p>Build and test a helper, then attack that build to finish a challenge. Your work is saved when you switch tasks.
      {level2 && ' At Level 2 each challenge has seven tests, including an edge case, and you need IF blocks to reach the usefulness target.'}</p>
    <div className="grid md:grid-cols-2 gap-4">{desks.map(d => {
      const c = getChallenge(d.id)!;
      const done = m.completed?.includes(d.id);
      const stage = m.revising?.[d.id] ? 'revision' : m.frozen?.[d.id] ? 'Attack' : 'Build';
      const latest = latestEffectiveness(work[d.id]);
      return <article className="flex flex-col rounded-md border-1.5 border-ink bg-paper-card p-5" key={d.id}>
        <h3 className="text-xl font-extrabold">{c.title}</h3><p className="font-bold text-sm">{c.audience}</p>
        <p className="my-3 flex-1">{c.story}</p>
        {level2 && <p className="text-sm mb-2">Usefulness target: {usefulnessTarget(d.id + '@2')} (Level 1: {usefulnessTarget(d.id)})</p>}
        {latest.tested > 0 && <p className="text-sm mb-2">Latest build passed {latest.passed} of {latest.tested} tests.</p>}
        <button className="btn bg-paper self-start" onClick={() => open(d.id)} data-testid={'assess-' + d.id}>
          {done ? 'Review completed task' : work[d.id] ? 'Resume ' + stage : 'Start challenge'}
        </button>
      </article>;
    })}</div>
    <button className="btn bg-signal" disabled={!finished} onClick={() => update({ phase: 'release' })}>Continue to release decision</button>
  </section></>;
}
