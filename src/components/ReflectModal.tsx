import ReasoningField from './ReasoningField';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FAILURE_TEXT } from '../data/blocks';
import type { FailureKey } from '../types';

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export default function ReflectModal({
  testTitle,
  question,
  expected,
  seed,
  onSubmit,
  onClose,
}: {
  testTitle: string;
  question: string;
  expected: FailureKey;
  seed: string;
  onSubmit: (chosen: FailureKey, text: string) => boolean;
  onClose: () => void;
}) {
  const options = useMemo(() => {
    const pool = (Object.keys(FAILURE_TEXT) as FailureKey[]).filter((k) => k !== expected && k !== 'no_answer');
    const picks = [...pool].sort((a, b) => hash(seed + a) - hash(seed + b)).slice(0, 3);
    picks.splice(hash(seed) % 4, 0, expected);
    return picks;
  }, [expected, seed]);

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
    <div className="fixed inset-0 z-50 bg-ink/50 grid place-items-center p-4" data-testid="reflect-modal">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reflect-title"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-paper-card border-1.5 border-ink rounded-md shadow-hard-lg max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain w-full p-6"
      >
        <div className="label text-ink-3">Before you change anything</div>
        <h2 id="reflect-title" className="text-2xl font-extrabold leading-tight mt-1">Why did "{testTitle}" go wrong?</h2>
        <p className="text-ink-2 mt-1">The question was: "{question}"</p>
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
                {FAILURE_TEXT[k]}
              </button>
            );
          })}
        </fieldset>
        {result === null ? (
          <>
            <ReasoningField id="reflect-text" label="What will you change? (optional)" value={text} change={setText} rows={2} />
            <button disabled={!chosen} onClick={() => setResult(onSubmit(chosen!, text))} className="btn bg-ink text-paper w-full justify-center mt-3" data-testid="reflect-submit">
              Submit answer
            </button>
          </>
        ) : (
          <div className="mt-4" aria-live="polite">
            <p className={`rounded p-3 ${result ? 'bg-pass-soft' : 'bg-partial-soft'}`}>
              {result
                ? 'Correct. Now change your helper so it handles this.'
                : 'Not this time. The green answer is what actually went wrong. Your teacher can see your reasoning, so it is worth thinking it through.'}
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
