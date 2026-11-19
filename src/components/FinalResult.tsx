import { useEffect, useRef, useState } from 'react';
import { AI_MARKER, finalVerdict } from '../engine/aiProviders';
import { latestMarkRequests } from '../engine/challengeEvidence';
import { assessmentRadar, finalScore, WEIGHTS, type FinalResult as Result } from '../engine/finalScore';
import { CRITERION_NAME, getMarkingProvider, getSkillsSummaryProvider, SKILL_ORDER } from '../engine/marking';
import type { Mission } from '../engine/mission';
import { useMission } from '../store/mission';
import type { ChallengeProgress } from '../store/session';
import AiBadge from './AiBadge';
import CompetencyRadar from './Radar';

/** The three parts of the final score, with their maximum points. */
const PARTS: { key: keyof Result['score']['parts']; label: string; max: number; what: string }[] = [
  { key: 'answers', label: 'Written answers', max: WEIGHTS.answers, what: 'the four skills marked from what you wrote' },
  { key: 'tests', label: 'Blocks: tests handled', max: WEIGHTS.tests, what: 'tests your latest builds handle safely and usefully' },
  { key: 'workload', label: 'Blocks: workload', max: WEIGHTS.workload, what: 'staying within the credit budget with working builds' },
  { key: 'attempts', label: 'Attempts', max: WEIGHTS.attempts, what: 'getting each build working in one or two runs' },
];

/**
 * The final result of the assessment: marks the latest answer for each skill with the AI marker,
 * computes the final score from fixed weights (answers, blocks, attempts), and asks the AI for a
 * verdict and a skills summary that must state the same numbers. Saved on the mission, so
 * "My results" shows it too. Runs once when the report opens; the pupil can ask again.
 */
export default function FinalResult({ mission, progress }: { mission: Mission; progress: Record<string, ChallengeProgress> }) {
  const update = useMission((s) => s.update);
  const [step, setStep] = useState<string | null>(null);
  const started = useRef(false);
  const result = mission.finalResult;
  const radar = assessmentRadar(mission, progress);

  async function run() {
    started.current = true;
    const requests = latestMarkRequests(mission, progress);
    setStep(`Reading your answers (0 of ${requests.length})…`);
    let done = 0;
    const marks = await Promise.all(requests.map((r) => getMarkingProvider()(r).then((m) => { setStep(`Reading your answers (${++done} of ${requests.length})…`); return m; })));
    const score = finalScore(mission, progress, marks);
    setStep('Writing your verdict…');
    const [summary, verdict] = await Promise.all([getSkillsSummaryProvider()(marks).catch(() => ''), finalVerdict(score, marks)]);
    update({ finalResult: {
      score, verdict: verdict.text, summary,
      ai: verdict.ai && marks.every((m) => m.marker === AI_MARKER),
      markers: marks.map((m) => ({ criterion: m.criterion, marker: m.marker, level: m.level })),
      at: new Date().toISOString(),
    } });
    setStep(null);
  }

  useEffect(() => {
    if (!result && !started.current) run().catch(() => setStep(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) {
    return <section className="rounded-md border-1.5 border-ink bg-paper-card p-5 shadow-hard" aria-live="polite" data-testid="final-result">
      <h3 className="text-xl font-extrabold">Final result</h3>
      <p className="mt-2 text-ink-2">{step ?? 'Working out your final score…'}</p>
      {!step && <button className="btn bg-signal mt-3" onClick={() => run().catch(() => setStep(null))}>Work out my final score</button>}
    </section>;
  }

  const { score } = result;
  const markerOf = (c: string) => result.markers.find((m) => m.criterion === c);
  return <section className="rounded-md border-1.5 border-ink bg-paper-card shadow-hard overflow-hidden" data-testid="final-result" aria-label="Final result">
    <div className="grid md:grid-cols-[auto_1fr]">
      <div className="bg-ink text-paper p-5 md:p-6 flex flex-col justify-center">
        <div className="label text-paper/70">Final score</div>
        <div className="font-mono text-6xl font-bold mt-1" data-testid="final-score">{score.total}<span className="text-2xl text-paper/70">/100</span></div>
        <div className="mt-1 text-lg font-bold text-signal">{score.band}</div>
      </div>
      <div className="p-5 md:p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-extrabold flex-1">Your verdict</h3><AiBadge ai={result.ai} /></div>
        <p className="text-lg leading-snug" aria-live="polite">{result.verdict}</p>
        {result.summary && <p className="text-ink-2">{result.summary}</p>}
      </div>
    </div>

    <div className="grid lg:grid-cols-2 gap-6 p-5 md:p-6 border-t-1.5 border-line">
      <div className="space-y-3">
        <h4 className="font-bold">How the score is made</h4>
        {PARTS.map((p) => <div key={p.key}>
          <div className="flex justify-between text-sm"><span className="font-bold">{p.label}</span><span className="font-mono">{score.parts[p.key]} / {p.max}</span></div>
          <div className="h-2.5 rounded-sm bg-paper-deep mt-1 overflow-hidden" aria-hidden><div className="h-full bg-signal border-r-1.5 border-ink" style={{ width: `${100 * score.parts[p.key] / p.max}%` }} /></div>
          <p className="text-xs text-ink-3 mt-0.5">{p.what}</p>
        </div>)}
        <h4 className="font-bold pt-2">Skills from your answers · {score.skills.total} of 8</h4>
        <ul className="space-y-1 text-sm">{SKILL_ORDER.map((c) => { const m = markerOf(c); return <li key={c} className="flex items-center gap-2">
          <span className="flex-1">{CRITERION_NAME[c]}</span>
          <span className="font-mono">{score.skills.scores[c] === null ? 'not enough evidence' : `${score.skills.scores[c]} / 2`}</span>
          {m && <AiBadge ai={m.marker === AI_MARKER} />}
        </li>; })}</ul>
        <details className="text-sm"><summary className="cursor-pointer font-bold">Builds and attempts by challenge</summary>
          <ul className="mt-2 space-y-1">{score.challenges.map((c) => <li key={c.id}>{c.title} · {c.tested ? `${c.passed} of ${c.tested} tests` : 'not built'} · {c.runs} run{c.runs === 1 ? '' : 's'}</li>)}</ul>
          <p className="mt-2">Workload {score.workloadCredits} of {score.budget} credits.</p></details>
      </div>
      <div>
        <h4 className="font-bold">What your builds handled</h4>
        <p className="text-sm text-ink-2">The dashed line shows each challenge's first build; the yellow shape shows the latest.</p>
        <CompetencyRadar first={radar.first} now={radar.now} height={300} firstLabel="First build" nowLabel="Latest build" />
      </div>
    </div>
    <div className="px-5 md:px-6 pb-5 flex flex-wrap gap-3 items-center text-sm text-ink-3">
      <span>The score comes from fixed rules; the AI explains it but cannot change it.</span>
      <button className="btn bg-paper text-sm" disabled={!!step} onClick={() => { update({ finalResult: undefined }); started.current = false; }}>
        {result.ai ? 'Work it out again' : 'Ask the AI again'}</button>
    </div>
  </section>;
}
