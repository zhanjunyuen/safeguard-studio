import { useState } from 'react';
import { baseId, getChallenge, practiceTitle } from '../data/challenges';
import { CURVEBALLS } from '../data/curveballs';
import { practiceCurveball } from '../data/practiceCurveballs';
import { curveballHandled, runCurveball } from '../engine/curveball';
import type { CurveballAnswer, Mission } from '../engine/mission';
import type { ChallengeProgress } from '../store/session';

interface PredictionReview {
  id: string;
  label: string;
  question: string;
  prediction: CurveballAnswer['prediction'];
  confidence?: CurveballAnswer['confidence'];
  handled: boolean;
  explanation: string;
  reply: string;
}

export function recordedPredictions(history: Record<string, ChallengeProgress>, owner: string | null, mission?: Mission) {
  const rows: PredictionReview[] = [];
  for (const [id, p] of Object.entries(history)) {
    if (!getChallenge(id)) continue;
    let number = 0;
    p.curveballAttempts?.forEach((a, i) => {
      if (a.owner !== owner) return;
      number++;
      rows.push({ ...a, id: 'practice-' + id + '-' + i, label: 'Practice · ' + practiceTitle(id) + ' · Try ' + number,
        question: practiceCurveball(baseId(id)).question });
    });
  }
  for (const [id, answer] of Object.entries(mission?.curveballs ?? {})) {
    const rules = mission?.frozen?.[id];
    if (!answer || !rules || !CURVEBALLS[id]) continue;
    const result = runCurveball(rules, id);
    rows.push({ ...answer, id: 'assessment-' + id, label: 'Assessment · ' + practiceTitle(mission?.level === 2 ? id + '@2' : id),
      question: CURVEBALLS[id].test.question, handled: curveballHandled(result), explanation: result.explanation, reply: result.reply });
  }
  return rows;
}

export default function CurveballReview({ rows }: { rows: PredictionReview[] }) {
  const [choice, setChoice] = useState('');
  if (!rows.length) return null;
  const surprised = (row: PredictionReview) => (row.prediction === 'handles') !== row.handled;
  const current = rows.find(r => r.id === choice) ?? rows.find(r => surprised(r) && r.confidence === 'Very sure') ?? rows.find(surprised) ?? rows[0];
  return <section aria-labelledby="confidence-review" className="mt-6 rounded-md border-1.5 border-ink bg-paper-card p-4 sm:p-6 space-y-2">
    <h2 id="confidence-review" className="text-2xl font-extrabold">Revisit a curveball prediction</h2>
    <label htmlFor="review-curveball" className="block font-bold">Your recorded predictions</label>
    <select id="review-curveball" className="max-w-full rounded border border-line bg-paper p-2" value={current.id} onChange={e => setChoice(e.target.value)}>
      {rows.map(r => <option key={r.id} value={r.id}>{r.label}{surprised(r) ? ' · Different outcome' : ''}</option>)}
    </select>
    <blockquote className="border-l-4 border-line pl-3">{current.question}</blockquote>
    <p><b>Your prediction</b> · {current.prediction === 'handles' ? 'The helper would handle it safely.' : 'The helper would struggle.'}</p>
    <p><b>Confidence before the reveal</b> · {current.confidence ?? 'Not recorded'} (ungraded)</p>
    <p><b>{surprised(current) ? 'The result was different.' : 'Your prediction matched.'}</b> {current.explanation}</p>
    <details><summary className="font-bold cursor-pointer">Read the helper’s reply</summary><p className="mt-1">{current.reply}</p></details>
  </section>;
}
