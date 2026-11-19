import { useState } from 'react';
import { latestMarkRequests } from '../engine/challengeEvidence';
import { CRITERION_NAME, getMarkingProvider, getSkillsSummaryProvider, scoreOf, SKILL_ORDER, type Mark } from '../engine/marking';
import type { Mission } from '../engine/mission';
import type { ChallengeProgress } from '../store/session';

/**
 * The pupil's skills summary: marks the latest answer for each skill, shows the score from the
 * fixed rules (each skill 0–2, out of 8) and a short summary in plain words. The AI writes the
 * summary when connected; it can explain the score but never change it.
 */
export default function SkillsSummary({ mission, progress }: { mission: Mission; progress: Record<string, ChallengeProgress> }) {
  const [state, setState] = useState<{ marks: Mark[]; summary: string } | 'loading' | null>(null);
  const requests = latestMarkRequests(mission, progress);
  if (!requests.length) return null;

  async function run() {
    setState('loading');
    try {
      const marks = await Promise.all(requests.map((r) => getMarkingProvider()(r)));
      setState({ marks, summary: await getSkillsSummaryProvider()(marks) });
    } catch {
      setState(null);
    }
  }

  if (state === null || state === 'loading') {
    return <section className="rounded-md border-1.5 border-ink p-4 space-y-2" aria-label="Skills summary">
      <h3 className="font-bold">Skills summary</h3>
      <p className="text-sm">Marks your latest answer for each skill and sums them up.</p>
      <button className="btn bg-paper-card" disabled={state === 'loading'} onClick={run}>{state === 'loading' ? 'Reading your answers…' : 'Summarise my skills'}</button>
    </section>;
  }
  const score = scoreOf(state.marks);
  return <section className="rounded-md border-1.5 border-ink p-4 space-y-2" aria-label="Skills summary" data-testid="skills-summary">
    <h3 className="font-bold">Skills summary · {score.total} out of 8 · {score.band}</h3>
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">{SKILL_ORDER.map((c) => <li key={c}>{CRITERION_NAME[c]} · {score.scores[c] === null ? 'not enough evidence' : `${score.scores[c]} of 2`}</li>)}</ul>
    <p aria-live="polite">{state.summary}</p>
    <p className="text-xs text-ink-3">The score comes from fixed rules about which points each answer shows. {state.marks.some((m) => m.marker.startsWith('offline')) ? 'Some answers were read by the offline preview marker.' : 'The AI wrote the summary from your marks only.'}</p>
  </section>;
}
