import { DESKS } from '../data/mission';
import { getChallenge } from '../data/challenges';
import { allChallengesComplete, newAssessment, type Desk } from '../engine/mission';
import Builder from '../pages/Builder';
import Breaker from '../pages/Breaker';
import { useMission } from '../store/mission';
import { useAssessmentSession } from '../store/session';
import { CHALLENGE_BUDGET } from '../engine/challengeEvidence';
import CurveballCard from './CurveballCard';
import { submitCurveball } from '../engine/curveball';

export default function AssessmentChallenges() {
  const { mission: m, update, launch } = useMission();
  const work = useAssessmentSession(s => s.progress);
  const desk = m.focus;
  const menu = () => update({ phase: 'menu', focus: undefined, first: null });
  function open(id: Desk) {
    const frozen = m.frozen?.[id];
    update({ focus: id, first: frozen ?? null, phase: m.revising?.[id] ? 'revise' : frozen ? 'attack' : 'build' });
  }
  function finish(id: Desk) {
    if (!m.launches?.some(l => l.desk === id) || !m.curveballs?.[id] || m.completed?.includes(id)) return;
    update({ completed: [...(m.completed ?? []), id], phase: 'menu', focus: undefined, first: null });
  }
  if (desk && (m.phase === 'build' || m.phase === 'revise')) {
    const revising = m.phase === 'revise';
    const notes = revising ? 'revisionNotes' : 'designNotes';
    return <Builder key={desk} assessment={{ id: desk, onMenu: menu, revising,
      note: m[notes]?.[desk] ?? '', onNote: value => update({ [notes]: { ...m[notes], [desk]: value } }),
      onAttack: () => {
        const progress = work[desk];
        const last = progress?.attempts.slice(-1)[0];
        if (!last || progress.pendingReflection || last.script.join() !== progress.script.map(b => b.type).join()) return;
        if (revising) { finish(desk); return; }
        const rules = last.script.map(type => ({ type, scope: desk }));
        update({ phase: 'attack', first: rules, frozen: { ...m.frozen, [desk]: rules } });
      },
    }} />;
  }
  if (desk && m.phase === 'attack' && m.frozen?.[desk]) {
    const launched = m.launches?.some(l => l.desk === desk);
    const rules = m.frozen[desk];
    return <><Breaker key={desk} assessment={{ id: desk, rules, hintCount: m.attackHints?.length ?? 0, curveballPending: !m.curveballs?.[desk],
      plan: m.attackPlans?.[desk] ?? [], submitted: m.launches?.find(l => l.desk === desk)?.ids,
      changePlan: ids => update({ attackPlans: { ...m.attackPlans, [desk]: ids } }), submit: launch,
      reason: m.launches?.find(l => l.desk === desk)?.reason ?? m.attackReasons?.[desk] ?? '',
      changeReason: value => update({ attackReasons: { ...m.attackReasons, [desk]: value } }),
      onMenu: menu, onFinish: () => finish(desk),
      onRevise: () => update({ phase: 'revise', revising: { ...m.revising, [desk]: true } }),
    }} />
    {launched && <CurveballCard key={'cb-' + desk} desk={desk} rules={rules} answer={m.curveballs?.[desk]}
      onSubmit={answer => update(submitCurveball(useMission.getState().mission, desk, answer))} />}</>;
  }
  if (m.phase === 'brief') return <section className="rounded-md border-1.5 border-ink bg-paper-card p-6 space-y-4">
    <h2 className="text-2xl font-extrabold">Six challenges, in your order</h2>
    <p>Use the school community helper for the six assigned challenges. For each one, build with the blocks for that problem, run the six hidden tests, and attack the build you evaluated. Then your helper meets one curveball: a request it has never seen, often one no block can fully catch. You predict what will happen and explain why. Your written answers get feedback, and you can ask about it. You can return to the checklist and resume a challenge later.</p>
    <label className="block font-bold">Time allowance
      <select className="block mt-1 rounded border border-line p-2" value={m.minutes} onChange={e => update({ minutes: Number(e.target.value) })}>
        <option value={0}>Untimed</option>{[15, 25, 40, 60].map(n => <option key={n} value={n}>{n} active minutes</option>)}
      </select>
    </label>
    <button className="btn bg-signal" onClick={() => update({ ...newAssessment(), minutes: m.minutes, phase: 'menu' })}>Choose my first challenge</button>
  </section>;
  return <section className="space-y-4">
    <h2 className="text-2xl font-extrabold">{m.completed?.length ?? 0} of {DESKS.length} challenges complete</h2>
    <p>Choose any unfinished challenge. Each uses its own blocks and workload multiplier. The target for all six builds together is {CHALLENGE_BUDGET} credits.</p>
    <div className="grid md:grid-cols-2 gap-4">{DESKS.map(d => {
      const c = getChallenge(d.id)!;
      const done = m.completed?.includes(d.id);
      const stage = m.revising?.[d.id] ? 'revision' : m.frozen?.[d.id] ? 'Attack' : 'Build';
      return <article className="flex flex-col rounded-md border-1.5 border-ink bg-paper-card p-5" key={d.id}>
        <h3 className="text-xl font-extrabold">{c.title}</h3><p className="font-bold text-sm">{c.audience} · Workload × {d.volume}</p>
        <p className="my-3 flex-1">{c.story}</p>
        <button disabled={done} className="btn bg-paper self-start" onClick={() => open(d.id)} data-testid={'assess-' + d.id}>
          {done ? 'Completed' : work[d.id] ? 'Resume ' + stage : 'Start challenge'}
        </button>
      </article>;
    })}</div>
    <button className="btn bg-signal" disabled={!allChallengesComplete(m)} onClick={() => update({ phase: 'release' })}>Continue to release decision</button>
  </section>;
}
