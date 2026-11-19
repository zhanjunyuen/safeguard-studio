import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ATTACK_HINT_LIMIT, hintAvailable } from '../engine/attackHints';
import { WEIGHTS } from '../engine/finalScore';
import type { Desk } from '../engine/mission';
import { useMission } from '../store/mission';

export default function AttackHintPanel({ desk }: { desk: Desk }) {
  const { mission, requestHint } = useMission();
  const inFlight = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => inFlight.current?.abort(), []);
  const hints = mission.attackHints ?? [];
  const shown = hints.filter(h => h.desk === desk);
  const remaining = ATTACK_HINT_LIMIT - hints.length;
  const launched = mission.launches?.some(round => round.desk === desk);
  async function ask() {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setFailed(false);
    try {
      await requestHint(desk, controller.signal);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      inFlight.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const canAsk = hintAvailable(mission, desk);
  const offered = mission.phase !== 'attack' || !launched;
  return <section aria-label="AI hints" className="rounded-md border-1.5 border-ink bg-paper-card p-4 space-y-2" data-testid="hint-panel">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h4 className="font-bold flex items-center gap-2"><Sparkles size={16} aria-hidden /> AI hints</h4>
      <p className="font-mono text-sm">{remaining} of {ATTACK_HINT_LIMIT} left</p>
    </div>
    <p className="text-sm text-ink-2">A hint is a guiding question, never the answer. <b className="text-ink">Each hint you use lowers your Independence score</b> ({Math.round(100 / ATTACK_HINT_LIMIT)} points of it, worth {WEIGHTS.independence}% of your final score). Hints you already have are free to reread.</p>
    {shown.length > 0 && <ol className="space-y-1.5" aria-live="polite">{shown.map((h, i) =>
      <li key={i} className="rounded border-l-4 border-signal bg-paper px-3 py-1.5"><span className="label text-ink-3 mr-1">{h.stage === 'build' ? 'Build' : 'Attack'}</span>{h.text}</li>)}</ol>}
    {offered && <button className="btn bg-paper" disabled={loading || !canAsk} onClick={ask} data-testid="ask-hint">
      {loading ? 'Thinking…' : remaining > 0 ? 'Use a hint' : 'No hints left'}
    </button>}
    {failed && offered && <p role="alert">The hint could not be loaded. Nothing was used up, so you can try again.</p>}
  </section>;
}
