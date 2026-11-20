import { useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import type { latestEffectiveness, serviceWorkloads } from '../engine/challengeEvidence';
import type { Desk, Mission, Phase } from '../engine/mission';
import WorkloadBar, { workloadFormula } from './WorkloadBar';

interface Props {
  phase: Phase;
  serviceCount: number;
  workloadModel?: Mission['workloadModel'];
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
  phase, serviceCount, workloadModel, focus, levelName, workloads, used, budget, completed, effectiveness, current,
  finished, onService, onOverview, onRelease,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const service = workloads.find(row => row.id === focus);
  const stage = phase === 'build' ? 'Build' : phase === 'attack' ? 'Attack' : phase === 'revise' ? 'Revise' : 'Review';
  const setup = phase === 'brief';
  const ended = phase === 'complete' || phase === 'expired';
  const task = setup ? 'Assessment setup' : ended ? 'Assessment evidence'
    : service?.title ?? (phase === 'release' ? 'Release decision' : 'Whole-helper overview');

  function close() {
    setExpanded(false);
    toggle.current?.focus({ preventScroll: true });
  }

  return <nav aria-label="Assessment progress and tasks"
    className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper-card pb-[env(safe-area-inset-bottom)] shadow-lg"
    onKeyDown={e => { if (expanded && e.key === 'Escape') close(); }}>
    <div className="mx-auto max-w-5xl px-3 sm:px-4">
      <button ref={toggle} type="button" aria-expanded={expanded} aria-controls="assessment-tracker-details"
        className="grid min-h-[var(--tracker-height)] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 text-left"
        onClick={() => setExpanded(!expanded)}>
        <span className="min-w-0">
          <strong className="block truncate text-base leading-tight sm:text-xl" title={task}>
            {service && !ended && <span className="font-normal text-ink-2">{stage} · </span>}{task}
          </strong>
          <span className="mt-1 block text-sm leading-tight text-ink-2" aria-live="polite" aria-atomic="true">
            <b className={used > budget ? 'text-fail' : 'text-ink'}>{setup ? '0' : `${used} / ${budget}`} credits{workloadModel === 'deployment' ? ' deployed' : workloadModel === 'usage' && ' used'}</b> · {serviceCount} {serviceCount === 1 ? 'service' : 'services'}
          </span>
        </span>
        <span className="btn bg-signal">
          <ChevronUp aria-hidden="true" size={20} className={`transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Collapse' : 'Expand'}<span className="hidden sm:inline"> tracker</span>
        </span>
        <span aria-hidden="true" className="col-span-2 block h-2.5 overflow-hidden rounded-sm border border-line bg-paper-deep">
          <span className={`block h-full ${used > budget ? 'bg-fail' : 'bg-pass'}`}
            style={{ width: `${setup || !budget ? 0 : Math.min(100, used / budget * 100)}%` }} />
        </span>
      </button>
      <div id="assessment-tracker-details" aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className={`max-h-[60dvh] overflow-y-auto overscroll-contain border-t border-line py-3 space-y-3 transition-[visibility] motion-reduce:transition-none ${expanded ? 'visible' : 'invisible delay-200'}`}>
            {setup ? <p className="text-sm">Start the assessment to see the budget for your assigned services and switch between them here.</p> : <>
              <WorkloadBar used={used} budget={budget} deployment={workloadModel === 'deployment'} />
              {workloadModel === 'compute' && <p className="text-sm">The budget covers a working reference build for each assigned service at your level. Each service starts with Ask AI. Generating an answer takes 12 credits. A simple refusal takes 1 and saves the AI call if it stops the request first.</p>}
              {workloadModel === 'deployment' ? <p className="text-sm">Finishing a task adds the maximum cost of one live request to that helper. The shared budget covers one request per assigned helper. Deploying a revision replaces its previous cost. All tests, attacks and curveballs are free.</p> : workloadModel === 'usage' ? <p className="text-sm">Only submitted work spends credits. Each AI answer costs 1 credit and a simple filter costs 0.1. A written attack costs 1 credit when the AI judge returns its result. The budget allows two working builds, three attacks and a curveball per task. Editing and replaying results are free.</p> : <p className="text-sm">{workloadModel ? 'Each case counts equally. We average the cost of the blocks that run, multiply by service volume and round up once per service.' : 'Each projection multiplies safeguard credits per request by service volume.'} Test runs are free.</p>}
              <ul aria-label={ended ? 'Service costs' : 'Switch service'} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {workloads.map(row => {
                  const summary = <><b className="block">{row.title}{completed.includes(row.id) && ' · Complete'}</b>
                    <span className="text-sm">{workloadModel === 'deployment' ? row.deployed ? `Deployed · up to ${row.credits} credits/request` : 'Awaiting deployment · 0 credits' : row.spending ? `${row.credits} credits used · Builds ${row.spending.builds} · Attacks ${row.spending.attacks} · Curveball ${row.spending.curveball}` : workloadFormula(row.perRequest, row.volume, row.credits)}</span></>;
                  return <li key={row.id}>{ended ? <div className="px-3 py-2">{summary}</div> :
                    <button type="button" aria-current={row.id === focus ? 'step' : undefined}
                      className={`w-full rounded border px-3 py-2 text-left ${row.id === focus ? 'bg-signal-soft border-ink' : 'border-line hover:border-ink'}`}
                      onClick={() => { close(); onService(row.id); }}>{summary}</button>}</li>;
                })}
              </ul>
              <div className="text-sm">
                <b data-testid="assessment-level">{levelName}</b> · {completed.length} of {workloads.length} services ready for release
                <progress aria-label="Challenges completed" className="block w-full h-2 my-1 accent-green-700"
                  value={completed.length} max={workloads.length} />
                {effectiveness.tested > 0 && <p>{effectiveness.passed} of {effectiveness.tested} tests passed across your latest builds.</p>}
                {!!current?.tested && <p>This task passed {current.passed} of {current.tested} tests on its latest run.</p>}
              </div>
              {!ended && <div className="flex flex-wrap gap-3">
                <button className="btn bg-paper" onClick={() => { close(); onOverview(); }}>Whole-helper overview</button>
                {finished && <button className="btn bg-paper" onClick={() => { close(); onRelease(); }}>Release decision</button>}
              </div>}
            </>}
          </div>
        </div>
      </div>
    </div>
  </nav>;
}
