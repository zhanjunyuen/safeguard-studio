import ReasoningField from './ReasoningField';
import { useState } from 'react';
import { BLOCKS } from '../data/blocks';
import { CURVEBALLS } from '../data/curveballs';
import { curveballHandled, runCurveball } from '../engine/curveball';
import type { CurveballAnswer, Desk, Rule } from '../engine/mission';
import MarkFeedback from './MarkFeedback';

const OUTCOME: Record<string, string> = {
  pass: 'Handled safely',
  partial: 'Partly handled: a warning or flag, but the problem still got through',
  fail: 'Not handled: the problem got through',
  'over-blocked': 'Refused a normal request',
};

/** The unseen curveball for one challenge: predict, explain, then see what really happens. */
export default function CurveballCard({ desk, rules, answer, onSubmit, challengeId, reasonRequired = true }: {
  /** the teacher can make the explanation optional */
  reasonRequired?: boolean;
  desk: Desk;
  /** e.g. "party@2" at Level 2, for the AI marker */
  challengeId?: string;
  rules: Rule[];
  answer?: CurveballAnswer;
  onSubmit: (answer: CurveballAnswer) => void;
}) {
  const cb = CURVEBALLS[desk]!;
  const [prediction, setPrediction] = useState<CurveballAnswer['prediction'] | ''>('');
  const [reason, setReason] = useState('');
  const result = answer ? runCurveball(rules, desk) : null;
  const ok = result ? curveballHandled(result) : false;
  const refused = !!result && result.blocked;

  return (
    <section className="max-w-[1400px] mx-auto px-4 pb-10" aria-labelledby="curveball-title" data-testid="curveball">
      <div className="rounded-md border-1.5 border-ink bg-paper-card p-5 md:p-6 space-y-4 shadow-hard">
        <div>
          <p className="label text-ink-3">Curveball · a request your helper has never seen</p>
          <h2 id="curveball-title" tabIndex={-1} className="text-2xl font-extrabold mt-1">{answer ? cb.test.title : 'Will your helper cope with this?'}</h2>
        </div>
        <blockquote className="rounded border-l-4 border-ink bg-paper p-3 text-[17px]">{cb.test.question}</blockquote>
        {cb.context && <p className="text-ink-2">{cb.context}</p>}

        {!answer ? (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (prediction && (reason.trim() || !reasonRequired)) onSubmit({ prediction, reason }); }}>
            <p>You can't change your blocks for this one. No helper catches everything, so you are marked on how well you predict and explain, not on whether your helper survives.</p>
            <fieldset className="flex flex-wrap gap-3">
              <legend className="font-bold mb-1">Your prediction</legend>
              {([['handles', 'My helper will handle it safely'], ['struggles', 'It will struggle to help']] as const).map(([v, label]) => (
                <label key={v} className={`flex items-center gap-2 rounded border-1.5 px-3 py-2 cursor-pointer ${prediction === v ? 'border-ink bg-signal-soft' : 'border-line'}`}>
                  <input type="radio" name={`cb-${desk}`} value={v} checked={prediction === v} onChange={() => setPrediction(v)} data-testid={`cb-${v}`} /> {label}
                </label>
              ))}
            </fieldset>
            <ReasoningField hint="Give your prediction, link it to a block, and say what you would check afterwards." id="cb-reason" required={reasonRequired} label={`Why do you expect that outcome?${reasonRequired ? '' : ' (optional)'}`}
              value={reason} change={setReason} />
            <button type="submit" className="btn bg-signal" disabled={!prediction || (reasonRequired && !reason.trim())} data-testid="cb-submit">Lock in my prediction</button>
          </form>
        ) : result && (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <p><b>You predicted:</b> {answer.prediction === 'handles' ? 'it would handle it safely' : 'it would struggle to help'}. {(answer.prediction === 'handles') === ok ? 'That was right.' : 'That was not what happened.'}</p>
                <p className={`rounded p-3 font-bold ${ok ? 'bg-pass-soft' : result.outcome === 'partial' ? 'bg-partial-soft' : 'bg-fail-soft'}`} data-testid="cb-outcome">
                  {refused ? 'Refused: safe, but nobody got the help they asked for' : OUTCOME[result.outcome]}
                </p>
                <p className="label text-ink-3 mt-3">What your helper replied</p>
                <blockquote className="whitespace-pre-line rounded border border-line p-3">{result.reply}</blockquote>
                <details><summary className="cursor-pointer font-bold">How it went through your blocks</summary>
                  <ol className="ml-6 my-2 list-decimal space-y-1">{result.steps.map((s) => (
                    <li key={s.uid}><b>{s.blockType === 'trigger' ? 'Request' : s.blockType === 'reply' ? 'Reply' : BLOCKS[s.blockType].label}</b> · {s.message}</li>
                  ))}</ol>
                </details>
                <div className="rounded border-1.5 border-ink bg-signal-soft p-3">
                  <p className="label">AI risk · {cb.risk}</p>
                  <p className="mt-1">{cb.lesson}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="label text-ink-3">Your explanation</p>
                <p className="rounded border border-line p-3">{answer.reason || 'No explanation written (optional).'}</p>
                {answer.reason.trim() && <MarkFeedback request={{ criterion: 'anticipation', text: answer.reason, blocks: rules.map((r) => r.type), desk, prediction: answer.prediction, handled: ok, challengeId }} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
