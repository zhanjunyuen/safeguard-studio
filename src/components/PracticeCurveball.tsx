import { useState } from 'react';
import { baseId } from '../data/challenges';
import { practiceCurveball } from '../data/practiceCurveballs';
import { curveballHandled } from '../engine/curveball';
import { runProgram } from '../engine/run';
import { blockKey } from '../engine/scriptText';
import type { Challenge, ScriptBlock } from '../types';
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
  if (prediction === null) return <div className="space-y-3">
    <h3 className="font-bold">{test.title}</h3>
    <blockquote className="border-l-4 border-line pl-3">{test.question}</blockquote>
    <p>Will this helper give a safe, useful answer? Pick a prediction to run its blocks.</p>
    <div className="flex flex-wrap gap-2">
      <button className="btn bg-paper" onClick={() => predict(true)}>It will handle this</button>
      <button className="btn bg-paper" onClick={() => predict(false)}>It will struggle</button>
    </div>
  </div>;

  const result = runProgram(script, test);
  const handled = curveballHandled(result);
  return <div className="space-y-3" aria-live="polite">
    <p className="font-bold">{prediction === handled ? 'Your prediction matched the replay.' : 'The replay went differently.'} {result.blocked && 'The helper stopped without giving useful help.'}</p>
    <Exchange test={test} result={result} upto={result.steps.length} challenge={challenge} helperLabel="Helper" />
    <button className="btn bg-paper" onClick={() => predict(null)}>Try again</button>
  </div>;
}
