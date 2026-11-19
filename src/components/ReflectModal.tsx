import ReasoningField from './ReasoningField';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { reflectionAnswer, reflectionOptions, reflectionPrompt } from '../engine/reflection';
import { BLOCKS } from '../data/blocks';
import type { FailureKey, HiddenTest, TestResult } from '../types';

export default function ReflectModal({
  test,
  run,
  neighbours,
  expected,
  seed,
  onSubmit,
  onClose,
}: {
  test: HiddenTest;
  run: TestResult;
  neighbours: FailureKey[];
  expected: FailureKey;
  seed: string;
  onSubmit: (chosen: FailureKey, text: string) => boolean;
  onClose: () => void;
}) {
  const options = reflectionOptions(expected, seed, neighbours);
  const steps = run.steps.filter(s => s.blockType !== 'trigger' && s.blockType !== 'reply');
  const [chosen, setChosen] = useState<FailureKey | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const cont = useRef<HTMLButtonElement>(null);

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    if (result !== null) cont.current?.focus();
  }, [result]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && result !== null && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, onClose]);

  return (
    <div className="reflection-overlay fixed inset-0 z-50 bg-ink/50 grid place-items-center p-4" data-testid="reflect-modal">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reflect-title"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-paper-card border-1.5 border-ink rounded-md shadow-hard-lg max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full p-6"
      >
        <div className="label text-ink-3">Before you change anything</div>
        <h2 id="reflect-title" className="text-2xl font-extrabold leading-tight mt-1">{reflectionPrompt(test, run)}</h2>
        <p className="mt-3"><b>Request</b> · {test.question}</p>
        <p className="mt-2"><b>Helper’s reply</b> · {run.reply}</p>
        <details className="mt-2 text-sm">
          <summary className="font-bold cursor-pointer">Replay this request</summary>
          <ol className="ml-5 mt-1 list-decimal">{steps.map(s => <li key={s.uid}>
            <b>{BLOCKS[s.blockType].label}</b> · {s.message}
          </li>)}</ol>
        </details>
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">Pick the reason</legend>
          {options.map((k, i) => {
            const isPick = chosen === k;
            const reveal = result !== null;
            const cls = reveal
              ? k === expected
                ? 'border-pass bg-pass-soft'
                : isPick
                  ? 'border-fail bg-fail-soft'
                  : 'border-line text-ink-3'
              : isPick
                ? 'border-ink bg-signal-soft shadow-hard'
                : 'border-line hover:border-ink';
            return (
              <button
                key={k}
                ref={i === 0 ? first : undefined}
                disabled={reveal}
                aria-pressed={isPick}
                onClick={() => setChosen(k)}
                className={`w-full text-left rounded border-1.5 px-4 py-3 font-bold transition ${cls}`}
                data-testid={`reflect-${k}`}
              >
                {reflectionAnswer(k, test)}
              </button>
            );
          })}
        </fieldset>
        {result === null ? (
          <>
            <ReasoningField id="reflect-text" label="Which step would you change for this request, and why? (optional)" value={text} change={setText} rows={2} />
            <button disabled={!chosen} onClick={() => setResult(onSubmit(chosen!, text))} className="btn bg-ink text-paper w-full justify-center mt-3" data-testid="reflect-submit">
              Submit answer
            </button>
          </>
        ) : (
          <div className="mt-4" aria-live="polite">
            <p className={`rounded p-3 ${result ? 'bg-pass-soft' : 'bg-partial-soft'}`}>
              <b>{result ? 'Correct.' : 'Look again at the replay.'}</b> {run.explanation}
            </p>
            <button ref={cont} onClick={onClose} className="btn bg-signal text-ink w-full justify-center mt-3" data-testid="reflect-continue">
              Back to my helper
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
