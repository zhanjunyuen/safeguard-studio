import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
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
    const h = hash(seed);
    const picks = [...pool].sort((a, b) => hash(seed + a) - hash(seed + b)).slice(0, 3);
    const all = [...picks];
    all.splice(h % 4, 0, expected);
    return all;
  }, [expected, seed]);

  const [chosen, setChosen] = useState<FailureKey | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<boolean | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-indigo-950/50 backdrop-blur-sm grid place-items-center p-4" data-testid="reflect-modal">
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl">
        <div className="text-xs font-extrabold uppercase tracking-wider text-violet-600">Before you fix it…</div>
        <h2 className="text-2xl font-extrabold leading-tight mt-1">Why did “{testTitle}” go wrong?</h2>
        <p className="text-sm text-indigo-900/60 mt-1 italic">“{question}”</p>
        <div className="mt-4 space-y-2">
          {options.map((k) => {
            const isPick = chosen === k;
            const reveal = result !== null;
            const cls = reveal
              ? k === expected
                ? 'border-emerald-400 bg-emerald-50'
                : isPick
                  ? 'border-rose-300 bg-rose-50'
                  : 'border-indigo-100 opacity-60'
              : isPick
                ? 'border-violet-500 bg-violet-50'
                : 'border-indigo-100 hover:border-violet-300';
            return (
              <button key={k} disabled={reveal} onClick={() => setChosen(k)} className={`w-full text-left rounded-2xl border-2 px-4 py-2.5 text-[15px] font-semibold transition ${cls}`} data-testid={`reflect-${k}`}>
                {FAILURE_TEXT[k]}
              </button>
            );
          })}
        </div>
        {result === null ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="In your own words: what will you change, and why? (optional)"
              className="mt-3 w-full rounded-2xl border-2 border-indigo-100 p-3 text-sm focus:outline-none focus:border-violet-400"
              rows={2}
            />
            <button
              disabled={!chosen}
              onClick={() => setResult(onSubmit(chosen!, text))}
              className="mt-3 w-full py-3 rounded-2xl bg-violet-600 disabled:bg-indigo-200 text-white font-extrabold"
              data-testid="reflect-submit"
            >
              Lock in my answer
            </button>
          </>
        ) : (
          <div className="mt-4">
            <div className={`rounded-2xl p-3 text-sm font-semibold ${result ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
              {result ? '🎯 Spot on. Now go and fix it.' : '🤔 Not quite. The highlighted answer is what actually went wrong. Your teacher sees how you reasoned, not just your score.'}
            </div>
            <button onClick={onClose} className="mt-3 w-full py-3 rounded-2xl bg-indigo-950 text-white font-extrabold" data-testid="reflect-continue">
              Back to building →
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
