export function workloadFormula(perRequest: number, volume: number, credits: number) {
  if (!Number.isInteger(perRequest)) {
    return `about ${Number(perRequest.toFixed(2))} credits/request × ${volume} ${volume === 1 ? 'request' : 'requests'} → ${credits} credits (rounded up)`;
  }
  return `${perRequest} credits/request × ${volume} ${volume === 1 ? 'request' : 'requests'} = ${credits} credits`;
}

interface Props {
  used: number;
  budget: number;
}

export default function WorkloadBar({ used, budget }: Props) {
  const remaining = budget - used;
  const balance = remaining < 0 ? `${-remaining} over budget` : `${remaining} left`;
  return <div className="min-w-0" data-testid="shared-workload">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <b>Shared workload budget</b>
      <span className="font-mono text-sm">{used} / {budget} credits</span>
    </div>
    <progress aria-label="Shared workload budget" aria-valuetext={`${used} of ${budget} credits, ${balance}`}
      className={`block w-full h-3 my-1 ${remaining < 0 ? 'accent-red-700' : 'accent-green-700'}`}
      value={Math.min(used, budget)} max={budget} />
    <p className={`text-sm ${remaining < 0 ? 'font-bold text-fail' : 'text-ink-2'}`}>{balance} across assigned services</p>
  </div>;
}
