import { useId, useState } from 'react';
import { baseId } from '../data/challenges';
import { practiceCurveball } from '../data/practiceCurveballs';
import CurveballConfidence from './CurveballConfidence';
import { usePracticeStore } from '../store/session';
import { curveballHandled, type CurveballConfidenceLevel } from '../engine/curveball';
import { runProgram } from '../engine/run';
import { blockKey } from '../engine/scriptText';
import type { Challenge, ScriptBlock, TestResult } from '../types';
import { Exchange } from './RunPanel';

export default function PracticeCurveball({ challenge, script }: { challenge: Challenge; script: ScriptBlock[] }) {
  const test = practiceCurveball(baseId(challenge.id));
  return <details className="rounded-md border-1.5 border-ink bg-paper-card p-4" data-testid="practice-curveball">
    <summary className="font-bold cursor-pointer">Try a practice curveball</summary>
    <div className="mt-3">
      <Prediction key={JSON.stringify([challenge.id, ...script.map(blockKey)])} challenge={challenge} script={script} test={test} />
    </div>
  </details>;
}

function Prediction({ challenge, script, test }: { challenge: Challenge; script: ScriptBlock[]; test: ReturnType<typeof practiceCurveball> }) {
  const [prediction, predict] = useState<boolean | null>(null);
  const [confidence, setConfidence] = useState<CurveballConfidenceLevel>();
  const [result, reveal] = useState<TestResult | null>(null);
  const store = usePracticeStore();
  const record = store(s => s.recordCurveball);
  const name = useId();
  if (!result) return <form className="space-y-3" onSubmit={e => {
    e.preventDefault();
    if (prediction === null) return;
    const replay = runProgram(script, test);
    record(challenge.id, { prediction: prediction ? 'handles' : 'struggles', confidence, handled: curveballHandled(replay),
      reply: replay.reply, explanation: replay.explanation });
    reveal(replay);
  }}>
    <h3 className="font-bold">{test.title}</h3>
    <blockquote className="border-l-4 border-line pl-3">{test.question}</blockquote>
    <fieldset><legend className="font-bold">Will this helper give a safe, useful answer?</legend>
      <div className="mt-1 flex flex-wrap gap-2">{[true, false].map(value =>
        <label key={String(value)} className="flex items-center gap-2 rounded border border-line px-3 py-2 cursor-pointer">
          <input type="radio" name={name} checked={prediction === value} onChange={() => predict(value)} />
          {value ? 'It will handle this' : 'It will struggle'}
        </label>)}</div>
    </fieldset>
    <CurveballConfidence value={confidence} onChange={setConfidence} />
    <button type="submit" className="btn bg-signal" disabled={prediction === null}>Lock in my prediction</button>
  </form>;

  const handled = curveballHandled(result);
  return <div className="space-y-3" aria-live="polite">
    <p className="font-bold">{prediction === handled ? 'Your prediction matched the replay.' : 'The replay went differently.'} {result.blocked && 'The helper stopped without giving useful help.'}</p>
    {confidence && <p>Your confidence · <b>{confidence}</b> (ungraded)</p>}
    <Exchange test={test} result={result} upto={result.steps.length} challenge={challenge} helperLabel="Helper" />
    <button className="btn bg-paper" onClick={() => { predict(null); setConfidence(undefined); reveal(null); }}>Try again</button>
  </div>;
}
