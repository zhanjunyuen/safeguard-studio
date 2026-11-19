import { useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import type { latestEffectiveness, serviceWorkloads } from '../engine/challengeEvidence';
import type { Desk, Phase } from '../engine/mission';
import WorkloadBar, { workloadFormula } from './WorkloadBar';

interface Props {
  phase: Phase;
  focus?: Desk;
  levelName: string;
  workloads: ReturnType<typeof serviceWorkloads>;
  used: number;
  budget: number;
  completed: Desk[];
  effectiveness: ReturnType<typeof latestEffectiveness>;
  current?: ReturnType<typeof latestEffectiveness>;
  finished: boolean;
  onService: (desk: Desk) => void;
  onOverview: () => void;
  onRelease: () => void;
}

export default function AssessmentTracker({
  phase, focus, levelName, workloads, used, budget, completed, effectiveness, current,
  finished, onService, onOverview, onRelease,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const service = workloads.find(row => row.id === focus);
  const stage = phase === 'build' ? 'Build' : phase === 'attack' ? 'Attack' : phase === 'revise' ? 'Revise' : 'Review';
  const task = service ? service.title : phase === 'release' ? 'Release decision' : 'Whole-helper overview';

  function close() {
    setExpanded(false);
    toggle.current?.focus({ preventScroll: true });
  }

  return <nav aria-label="Assessment progress and tasks"
    className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper-card pb-[env(safe-area-inset-bottom)] shadow-lg"
    onKeyDown={e => { if (expanded && e.key === 'Escape') close(); }}>
    <div className="mx-auto max-w-5xl px-4">
      <button ref={toggle} type="button" aria-expanded={expanded} aria-controls="assessment-tracker-details"
        className="flex w-full min-h-16 items-center justify-between gap-3 py-2 text-left"
        onClick={() => setExpanded(!expanded)}>
        <span className="min-w-0">
          <span className="label block text-ink-2">Current task{service && ' · ' + stage}</span>
          <strong className="block leading-tight">{task}</strong>
        </span>
        <span className="shrink-0 text-right">
          <span className="label block text-ink-2">All six services</span>
          <strong aria-live="polite" aria-atomic="true" className={used > budget ? 'text-fail' : ''}>{used} / {budget} credits</strong>
        </span>
        <ChevronUp aria-hidden="true" size={20} className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
        <span className="sr-only">Workload breakdown and task switching</span>
      </button>
      <div id="assessment-tracker-details" aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className={`max-h-[60dvh] overflow-y-auto overscroll-contain border-t border-line py-3 space-y-3 transition-[visibility] motion-reduce:transition-none ${expanded ? 'visible' : 'invisible delay-200'}`}>
            <WorkloadBar used={used} budget={budget} />
            <p className="text-sm">Each projection multiplies safeguard credits per request by service volume. Test runs are free.</p>
            <ul aria-label="Switch service" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {workloads.map(row => <li key={row.id}><button type="button" aria-current={row.id === focus ? 'step' : undefined}
                className={`w-full rounded border px-3 py-2 text-left ${row.id === focus ? 'bg-signal-soft border-ink' : 'border-line hover:border-ink'}`}
                onClick={() => { close(); onService(row.id); }}>
                <b className="block">{row.title}{completed.includes(row.id) && ' · Complete'}</b>
                <span className="text-sm">{workloadFormula(row.perRequest, row.volume, row.credits)}</span>
              </button></li>)}
            </ul>
            <div className="text-sm">
              <b data-testid="assessment-level">{levelName}</b> · {completed.length} of {workloads.length} services ready for release
              <progress aria-label="Challenges completed" className="block w-full h-2 my-1 accent-green-700"
                value={completed.length} max={workloads.length} />
              {effectiveness.tested > 0 && <p>{effectiveness.passed} of {effectiveness.tested} tests passed across your latest builds.</p>}
              {!!current?.tested && <p>This task passed {current.passed} of {current.tested} tests on its latest run.</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn bg-paper" onClick={() => { close(); onOverview(); }}>Whole-helper overview</button>
              {finished && <button className="btn bg-paper" onClick={() => { close(); onRelease(); }}>Release decision</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>;
}
