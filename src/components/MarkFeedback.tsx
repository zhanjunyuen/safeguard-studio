import { useEffect, useState } from 'react';
import { CRITERION_NAME, FOLLOW_UPS, getFollowUpProvider, getMarkingProvider, type Mark, type MarkRequest } from '../engine/marking';

/**
 * Feedback on one written response, from whichever marker is connected.
 * Today that is the offline keyword preview; the trained AI marker replaces it
 * through setMarkingProvider without changing this component.
 */
export default function MarkFeedback({ request }: { request: MarkRequest }) {
  const key = JSON.stringify(request);
  const [mark, setMark] = useState<Mark | null>(null);
  const [failed, setFailed] = useState(false);
  const [asked, setAsked] = useState<{ q: string; a: string | null }[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    setMark(null); setFailed(false); setAsked([]);
    getMarkingProvider()(JSON.parse(key) as MarkRequest, ctrl.signal)
      .then((m) => { if (!ctrl.signal.aborted) setMark(m); })
      .catch(() => { if (!ctrl.signal.aborted) setFailed(true); });
    return () => ctrl.abort();
  }, [key]);

  async function ask(q: string) {
    if (!mark || asked.some((x) => x.q === q)) return;
    setAsked((a) => [...a, { q, a: null }]);
    const answer = await getFollowUpProvider()(mark, q).catch(() => 'The marker could not answer just now. Ask your teacher.');
    setAsked((a) => a.map((x) => (x.q === q ? { q, a: answer } : x)));
  }

  if (failed) return <p className="rounded border border-line p-3 text-sm">Feedback is not available right now. Your teacher can still see your answer.</p>;
  if (!mark) return <p className="rounded border border-line p-3 text-sm text-ink-2" aria-live="polite">Reading your answer…</p>;
  const offline = mark.marker.startsWith('offline');
  return (
    <section className="rounded-md border-1.5 border-ink bg-paper-card p-4 space-y-3" aria-label={`Feedback: ${CRITERION_NAME[mark.criterion]}`} data-testid={`mark-${mark.criterion}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-extrabold">Feedback · {CRITERION_NAME[mark.criterion]}</h3>
        <span className="font-mono text-sm" data-testid="mark-level">{mark.level === null ? 'Not enough evidence yet' : `Level ${mark.level} of 2`}</span>
      </div>
      {offline && <p className="text-xs text-ink-3">Offline preview marker: it looks for key words, so it can miss what you meant. The trained AI marker will plug in here and read for meaning. Your teacher sees your full answer.</p>}
      <ul className="space-y-1.5">
        {mark.concepts.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            <span aria-hidden className={`mt-0.5 inline-block w-4 h-4 shrink-0 rounded-sm border-1.5 ${c.present ? 'bg-pass border-pass' : 'border-line'}`} />
            <span><span className="sr-only">{c.present ? 'Shown: ' : 'Not yet: '}</span>{c.label}{c.computed && <span className="text-ink-3"> (checked against the simulator)</span>}
              {c.evidence && <span className="block text-ink-2 italic">“{c.evidence}”</span>}</span>
          </li>
        ))}
      </ul>
      <p>{mark.feedback}</p>
      <p className="font-bold">Next: {mark.nextStep}</p>
      {mark.reviewFlag && <p className="text-sm rounded bg-partial-soft p-2">Sent to your teacher to review.</p>}
      <div className="flex flex-wrap gap-2" aria-label="Ask about this feedback">
        {FOLLOW_UPS.map((q) => <button key={q} className="btn bg-paper text-sm" disabled={asked.some((x) => x.q === q)} onClick={() => ask(q)}>{q}</button>)}
      </div>
      {asked.map((x) => <div key={x.q} className="text-sm border-l-4 border-line pl-3" aria-live="polite"><b>{x.q}</b><p>{x.a ?? '…'}</p></div>)}
    </section>
  );
}
