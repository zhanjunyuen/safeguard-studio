import { useState } from 'react';
import { OUTCOME_STYLE } from './RunPanel';
import { labelOf } from '../engine/scriptText';
import type { PupilRun, runFacts } from '../engine/pupilResults';
import type { Outcome } from '../types';

type Facts = ReturnType<typeof runFacts>;
export interface BuildPair { before: Facts; after: Facts; runs: [PupilRun, PupilRun] }

export default function BuildComparison({ before, after, runs }: BuildPair) {
  const [expanded, setExpanded] = useState(false);
  const caseIds = [...new Set([...before.cases, ...after.cases].map(c => c.id))];
  const rows = caseIds.map(id => {
    const a = before.cases.find(c => c.id === id);
    const b = after.cases.find(c => c.id === id);
    return { id, title: (b ?? a)!.title, a, b };
  });
  const visible = expanded ? rows : rows.filter(r => r.a?.outcome !== r.b?.outcome);
  const passed = (f: Facts) => f.cases.filter(c => c.outcome === 'pass').length + ' of ' + f.cases.length;
  const status = (outcome?: string) => outcome ? OUTCOME_STYLE[outcome as Outcome]?.label ?? outcome : 'Not tested';
  return <section className="my-4 rounded border border-line p-3" aria-label="Build comparison">
    <h3 className="font-extrabold">What changed between builds?</h3>
    <table className="w-full mt-2 table-fixed text-sm text-left">
      <caption className="sr-only">Recorded outcomes for {before.task}</caption>
      <thead><tr><th className="w-1/2" scope="col">Measure</th><th scope="col">{before.run}</th><th scope="col">{after.run}</th></tr></thead>
      <tbody className="divide-y divide-line">
        <tr><th className="py-2" scope="row">Tests passed</th><td>{passed(before)}</td><td>{passed(after)}</td></tr>
        {(before.blockQualityOutOf100 !== undefined || after.blockQualityOutOf100 !== undefined) && <tr>
          <th className="py-2" scope="row">Block quality /100</th>
          <td>{before.blockQualityOutOf100 ?? 'Unscored'}</td><td>{after.blockQualityOutOf100 ?? 'Unscored'}</td>
        </tr>}
        {runs[0].assessment && <tr><th className="py-2" scope="row">{runs[0].assessment.model === 'deployment' ? 'Max credits per live request' : runs[0].assessment.model === 'usage' ? 'Credits used this run' : 'Projected credits'}</th><td>{before.deploymentCreditsPerRequest ?? before.creditsUsed ?? before.projectedWorkloadCredits ?? 'Unavailable'}</td><td>{after.deploymentCreditsPerRequest ?? after.creditsUsed ?? after.projectedWorkloadCredits ?? 'Unavailable'}</td></tr>}
        {visible.map(r => <tr key={r.id}><th className="py-1 pr-2 font-normal" scope="row">{r.title}</th><td>{status(r.a?.outcome)}</td><td>{status(r.b?.outcome)}</td></tr>)}
      </tbody>
    </table>
    {visible.length === 0 && <p className="text-sm my-2">Every recorded test had the same outcome in both runs.</p>}
    {rows.some(r => r.a?.outcome === r.b?.outcome) && <button type="button" className="underline font-bold text-sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show changed tests' : 'Show all tests'}</button>}
    <details className="mt-2 text-sm"><summary className="font-bold cursor-pointer">Compare block order</summary>
      <div className="grid grid-cols-2 gap-2 mt-2">{runs.map(r => <div key={r.id}><b>{r.label}</b><ol className="list-decimal ml-5">{r.script.map((b, i) => <li key={i}>{labelOf(b)}</li>)}</ol></div>)}</div>
    </details>
  </section>;
}
