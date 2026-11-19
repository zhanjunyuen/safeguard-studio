import { Check } from 'lucide-react';
import { CURVEBALLS } from '../data/curveballs';
import { getChallenge } from '../data/challenges';
import type { Mission } from '../engine/mission';

type StepId = 'join' | 'brief' | 'challenges' | 'release' | 'results';

/** Where the pupil is in the assessment, and the one thing to do next. */
export function assessmentStep(m: Mission, needsName: boolean): { step: StepId; next: string } {
  const n = m.assigned?.length ?? 0;
  const done = m.completed?.length ?? 0;
  const title = m.focus ? getChallenge(m.focus)?.title : undefined;
  if (m.phase === 'complete' || m.phase === 'expired') return { step: 'results', next: 'Read your final result and feedback. Ask the AI marker about any answer.' };
  if (m.phase === 'release') return { step: 'release', next: 'Read the helper\'s draft and the current source, choose a decision and explain it.' };
  if (m.phase === 'brief') return needsName
    ? { step: 'join', next: 'Type your first name to join your class.' }
    : { step: 'brief', next: 'Read the brief, check your level and time, then start.' };
  if (m.phase === 'build') return { step: 'challenges', next: `${title}: add safeguard blocks, run the hidden tests, then continue to Attack.` };
  if (m.phase === 'revise') return { step: 'challenges', next: `${title}: change or keep your blocks, run the tests again, explain your choice and finish.` };
  if (m.phase === 'attack' && m.focus) {
    const launched = m.launches?.some((l) => l.desk === m.focus);
    if (!launched) return { step: 'challenges', next: `${title}: pick up to three attacks, predict which block will fail, then launch.` };
    if (CURVEBALLS[m.focus] && !m.curveballs?.[m.focus]) return { step: 'challenges', next: `${title}: scroll down to the curveball and predict whether your helper copes.` };
    return { step: 'challenges', next: `${title}: finish the challenge, or revise your build first.` };
  }
  if (done >= n && n > 0) return { step: 'challenges', next: 'All challenges are done. Continue to the release decision.' };
  return { step: 'challenges', next: done ? `Choose your next challenge (${done} of ${n} done).` : 'Choose a challenge to start with. You can work in any order.' };
}

/** The step bar at the top of the assessment, in the studio's block style. */
export default function AssessmentSteps({ mission: m, needsName }: { mission: Mission; needsName: boolean }) {
  const { step, next } = assessmentStep(m, needsName);
  const steps: [StepId, string][] = [
    ...(m.classCode ? [['join', 'Join class'] as [StepId, string]] : []),
    ['brief', 'Brief'],
    ['challenges', `Challenges${m.assigned ? ` · ${m.completed?.length ?? 0}/${m.assigned.length}` : ''}`],
    ['release', 'Release decision'],
    ['results', 'Results'],
  ];
  const at = steps.findIndex(([id]) => id === step);
  return <nav aria-label="Assessment steps" className="space-y-3" data-testid="assessment-steps">
    <ol className="flex flex-wrap gap-1.5">
      {steps.map(([id, label], i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo';
        return <li key={id} aria-current={state === 'now' ? 'step' : undefined}
          className={`flex items-center gap-1.5 rounded-sm border-1.5 px-2.5 py-1 text-sm font-bold ${state === 'now' ? 'border-ink bg-signal shadow-hard' : state === 'done' ? 'border-ink bg-pass-soft' : 'border-line bg-paper-card text-ink-3'}`}>
          {state === 'done' ? <Check size={14} strokeWidth={3} aria-hidden /> : <span className="font-mono text-xs">{i + 1}</span>}
          {label}<span className="sr-only">{state === 'done' ? ' (done)' : state === 'now' ? ' (current step)' : ''}</span>
        </li>;
      })}
    </ol>
    <p className="rounded border-l-4 border-ink bg-paper-card px-3 py-2 font-bold" aria-live="polite" data-testid="next-step"><span className="label text-ink-3 mr-2">Now</span>{next}</p>
  </nav>;
}
