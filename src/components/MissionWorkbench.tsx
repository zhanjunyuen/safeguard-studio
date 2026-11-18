import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, type ReactNode } from 'react';
import { DESKS, PALETTE, missionCase } from '../data/mission';
import { BLOCKS } from '../data/blocks';
import { getChallenge } from '../data/challenges';
import { ATTACK_BUDGET } from '../engine/breaker';
import { blockCredits, evaluate, handled, type Desk, type Rule } from '../engine/mission';
import { useMission } from '../store/mission';
import type { BlockType } from '../types';
import AttackHintPanel from './AttackHintPanel';
import { AttackItem, Plan } from './AttackBlocks';
import Block from './Block';
import Palette from './Palette';
import ScriptStack from './ScriptStack';
import { Trace } from './MissionReport';

export function ProblemMenu({ focus, completed = [], choose }: { focus?: Desk; completed?: Desk[]; choose: (desk: Desk) => void }) {
  return <nav aria-label="School problems" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
    {DESKS.map(d => <button key={d.id} aria-pressed={focus === d.id} onClick={() => choose(d.id)}
      className={'btn text-left ' + (focus === d.id ? 'bg-signal' : 'bg-paper-card')}>
      {d.title}{completed.includes(d.id) && ' ✓'}
    </button>)}
  </nav>;
}

const collision: CollisionDetection = args => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function RuleEditor({ rules, focus, change }: { rules: Rule[]; focus: Desk; change: (r: Rule[]) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [dragging, setDragging] = useState<BlockType | null>(null);
  const script = rules.map(r => ({ type: r.type, uid: r.type }));
  const used = new Set(rules.map(r => r.type));
  const add = (type: BlockType, index: number) => {
    if (used.has(type)) return;
    const next = rules.slice();
    next.splice(index, 0, { type, scope: focus });
    change(next);
  };
  const remove = (uid: string) => { if (uid !== 'ask_ai') change(rules.filter(r => r.type !== uid)); };
  function drop({ active, over }: DragEndEvent) {
    setDragging(null);
    if (!over) return;
    const fromPalette = active.data.current?.from === 'palette';
    if (over.id === 'palette') { if (!fromPalette) remove(String(active.id)); return; }
    const target = rules.findIndex(r => r.type === over.id);
    if (target < 0 && over.id !== 'stack-start' && over.id !== 'stack-end') return;
    const index = over.id === 'stack-start' ? 0 : over.id === 'stack-end' ? rules.length : target;
    if (fromPalette) {
      const rect = active.rect.current.translated;
      const below = target >= 0 && rect && rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2;
      add(active.data.current!.type, index + (below ? 1 : 0));
    } else {
      const from = rules.findIndex(r => r.type === active.id);
      if (from >= 0) change(arrayMove(rules, from, Math.min(index, rules.length - 1)));
    }
  }
  return <DndContext sensors={sensors} collisionDetection={collision} onDragEnd={drop} onDragCancel={() => setDragging(null)}
    onDragStart={({ active }) => setDragging(active.data.current?.type ?? active.id)}>
    <div className="grid lg:grid-cols-[282px_1fr] gap-4">
      <Palette blocks={PALETTE} used={used} credits={blockCredits} onAdd={t => add(t, rules.length)} />
      <div className="graph p-4 border rounded overflow-x-auto"><h3 className="font-bold mb-3">Your helper, in order</h3>
        <ScriptStack script={script} locked={false} onRemove={remove} highlights={{}} />
        <h3 className="font-bold">Block settings</h3>
        {rules.map((r,i) => <div key={r.type} className="mt-3 text-sm"><b>{BLOCKS[r.type].label}</b> · {blockCredits(r.type)} credits
          {r.type !== 'ask_ai' && <select aria-label={'Requests using ' + BLOCKS[r.type].label} className="block p-1 border" value={r.scope}
            onChange={e => change(rules.map((v,j) => i === j ? { ...v, scope: e.target.value as Rule['scope'] } : v))}>
            <option value="all">All school services</option>{DESKS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
          <div className="flex gap-4">{[-1,1].map(step => <button key={step} className="underline disabled:opacity-40"
            disabled={!rules[i + step]} onClick={() => change(arrayMove(rules, i, i + step))}>{step < 0 ? 'Move up' : 'Move down'}</button>)}</div>
        </div>)}
      </div>
    </div>
    <DragOverlay>{dragging && <Block kind={dragging} label={BLOCKS[dragging].label} color={BLOCKS[dragging].color} />}</DragOverlay>
  </DndContext>;
}

export function AttackWorkbench({ companion }: { companion: ReactNode }) {
  const { mission: m, launch, update } = useMission();
  const desk = DESKS.find(d => d.id === m.focus) ?? DESKS[0];
  const cases = getChallenge(desk.id)!.tests;
  const labels = Object.fromEntries(cases.map(t => [t.id, t.attackLabel]));
  const plan = m.attackPlans?.[desk.id] ?? [];
  const rounds = m.launches ?? [];
  const round = rounds.find(r => r.desk === desk.id);
  const setPlan = (ids: string[]) => update({ attackPlans: { ...m.attackPlans, [desk.id]: ids } });
  const add = (id: string) => {
    if (!round && labels[id] && !plan.includes(id) && plan.length < ATTACK_BUDGET) setPlan([...plan, id]);
  };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  return <>
    <p>Test your submitted helper in all six school settings. Pick up to {ATTACK_BUDGET} attack blocks for each setting and launch them to see where its safeguards hold or fail.</p>
    <ProblemMenu focus={desk.id} completed={rounds.map(r => r.desk)} choose={focus => update({ focus })} />
    <h3 className="font-bold text-xl">{desk.title}</h3>
    <div className="mission-header">{companion}</div>
    <AttackHintPanel key={desk.id} desk={desk.id} />
    <details><summary className="cursor-pointer font-bold">Blocks running for this service</summary>
      <ol className="list-decimal ml-6">{m.first!.filter(r => r.scope === 'all' || r.scope === desk.id).map(r => <li key={r.type}>{BLOCKS[r.type].label}</li>)}</ol>
    </details>
    {round ? <div><h4 className="font-bold">Attack results</h4>
      {round.ids.map(id => {
        const run = evaluate(m.first!, id);
        return <div key={id} className="py-2"><b>{handled(run) ? 'Helper held' : 'Weak spot exposed'} · {missionCase(id).test.attackLabel}</b>
          <blockquote className="pl-3 border-l-4 my-2">{run.result.reply}</blockquote><Trace run={run} /></div>;
      })}
      <p>{rounds.length} of {DESKS.length} settings tested.</p>
      {rounds.length === DESKS.length ? <button className="btn bg-signal" onClick={() => update({ phase: 'revise' })}>Revise your helper</button>
        : <p>Choose another problem from the menu.</p>}
    </div> : <DndContext sensors={sensors} collisionDetection={collision} onDragEnd={({active,over}) => { if (over?.id === 'plan') add(active.data.current?.testId); }}>
      <div className="grid lg:grid-cols-2 gap-4"><div className="space-y-2"><h4 className="font-bold">Attack blocks</h4>
        {cases.map(t => <AttackItem key={t.id} id={t.id} label={t.attackLabel} used={plan.includes(t.id)} full={plan.length >= ATTACK_BUDGET} onAdd={() => add(t.id)} />)}</div>
        <div className="space-y-3 overflow-x-auto"><Plan plan={plan} labels={labels} locked={false} onRemove={id => setPlan(plan.filter(t => t !== id))} />
          <button className="btn bg-signal" disabled={!plan.length} onClick={launch}>Launch attack plan</button></div>
      </div></DndContext>}
  </>;
}
