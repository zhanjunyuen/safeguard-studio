import { useEffect, useRef, useState } from 'react';
import { ATTACK_HINT_LIMIT, hintAvailable } from '../engine/attackHints';
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
  return <section aria-label="Companion hints" className="rounded-md border border-line p-4 space-y-2">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h4 className="font-bold">Hints from your helper</h4>
      <p>{remaining} of {ATTACK_HINT_LIMIT} hints left across all problems</p>
    </div>
    <ol className="space-y-1" aria-live="polite">{shown.map((h, i) => <li key={i}>{h.text}</li>)}</ol>
    {!launched && <button className="btn bg-paper-card" disabled={loading || !hintAvailable(mission, desk)} onClick={ask}>
      {loading ? 'Getting hint…' : 'Ask your helper for a hint'}
    </button>}
    {failed && !launched && <p role="alert">The hint could not be loaded. You can try again with the same allowance.</p>}
  </section>;
}
