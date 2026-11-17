import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BLOCKS, COMPETENCY_META } from '../data/blocks';
import type { Challenge, Outcome, RunReport, StepStatus, TestResult, TraceStep } from '../types';

export const OUTCOME_STYLE: Record<Outcome, { label: string; icon: string; cls: string; dot: string }> = {
  pass: { label: 'Passed', icon: '✓', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  partial: { label: 'Partly', icon: '½', cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  fail: { label: 'Failed', icon: '✗', cls: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
  'over-blocked': { label: 'Too cautious', icon: '🚫', cls: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-500' },
};

const STEP_ICON: Record<StepStatus, string> = { ok: '•', acted: '✔', warn: '!', stop: '■', skip: '–' };
const STEP_CLS: Record<StepStatus, string> = {
  ok: 'text-indigo-900/70',
  acted: 'text-emerald-700 font-bold',
  warn: 'text-amber-700 font-bold',
  stop: 'text-rose-700 font-bold',
  skip: 'text-slate-400',
};

function stepName(s: TraceStep) {
  if (s.blockType === 'trigger') return 'When someone asks';
  if (s.blockType === 'reply') return 'Reply';
  return BLOCKS[s.blockType].label;
}

function Chat({ test, result, upto, challenge }: { test: Challenge['tests'][number]; result: TestResult; upto: number; challenge: Challenge }) {
  const showReply = upto >= result.steps.length - 1;
  const st = OUTCOME_STYLE[result.outcome];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 text-white px-4 py-2.5 text-[15px] shadow">
          <div className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">{challenge.audience.replace(/^For /, '')}</div>
          {test.question}
        </div>
      </div>
      <ol className="text-[13px] space-y-1 pl-1">
        {result.steps.slice(0, upto + 1).map((s, i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2 ${STEP_CLS[s.status]}`}>
            <span className="w-4 text-center shrink-0">{STEP_ICON[s.status]}</span>
            <span><b>{stepName(s)}:</b> {s.message}</span>
          </motion.li>
        ))}
      </ol>
      {showReply ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex">
          <div className={`max-w-[90%] rounded-2xl rounded-bl-md border-2 px-4 py-2.5 text-[15px] whitespace-pre-line shadow-sm bg-white ${result.outcome === 'pass' ? 'border-emerald-300' : result.outcome === 'partial' ? 'border-amber-300' : 'border-rose-300'}`}>
            <div className="text-[10px] uppercase tracking-wider text-violet-600 font-extrabold mb-0.5">🤖 Your helper {result.flagged && <span className="text-teal-700">· 🚩 teacher flagged</span>}</div>
            {result.reply}
          </div>
        </motion.div>
      ) : (
        <div className="typing text-2xl text-violet-400 pl-2"><span>•</span><span>•</span><span>•</span></div>
      )}
      {showReply && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-xl border px-3 py-2 text-sm ${st.cls}`}>
          <b>{st.icon} {st.label}.</b> {result.explanation}
        </motion.div>
      )}
    </div>
  );
}

interface Props {
  challenge: Challenge;
  report: RunReport | null;
  replay: { testIdx: number; stepIdx: number } | null;
  selected: string | null;
  onSelect: (id: string) => void;
  seen: string[];
  onSkip: () => void;
}

export default function RunPanel({ challenge, report, replay, selected, onSelect, seen, onSkip }: Props) {
  if (replay && report) {
    const r = report.results[replay.testIdx];
    const t = challenge.tests[replay.testIdx];
    return (
      <div className="rounded-3xl bg-white border-2 border-violet-200 p-5" data-testid="replay">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-violet-600">Running hidden test {replay.testIdx + 1} of {report.total}</span>
          <button onClick={onSkip} className="text-xs font-bold text-indigo-900/60 hover:text-indigo-900">Skip ▸▸</button>
        </div>
        <div className="flex gap-1 mb-3">
          {report.results.map((x, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < replay.testIdx ? OUTCOME_STYLE[x.outcome].dot : i === replay.testIdx ? 'bg-violet-300' : 'bg-indigo-100'}`} />
          ))}
        </div>
        <h3 className="font-display text-xl font-extrabold mb-3">{t.title}</h3>
        <AnimatePresence mode="wait">
          <motion.div key={replay.testIdx} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Chat test={t} result={r} upto={replay.stepIdx} challenge={challenge} />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-3xl bg-white border-2 border-indigo-100 p-5">
        <h3 className="font-display text-lg font-extrabold">Hidden tests</h3>
        <p className="text-sm text-indigo-900/60 mb-4">Your helper will face {challenge.tests.length} situations. What could go wrong? Build for it, then press <b>Run</b>.</p>
        <div className="grid grid-cols-2 gap-2">
          {challenge.tests.map((t, i) => {
            const isSeen = seen.includes(t.id);
            return (
              <div key={t.id} className={`rounded-2xl border-2 border-dashed p-3 text-sm ${isSeen ? 'border-violet-200 bg-violet-50/50' : 'border-indigo-100 bg-indigo-50/40'}`}>
                <div className="text-lg">{isSeen ? COMPETENCY_META[t.category].icon : '🔒'}</div>
                <div className="font-bold leading-tight">{isSeen ? t.title : `Hidden test #${i + 1}`}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const sel = report.results.find((r) => r.testId === selected) ?? report.results[0];
  const selTest = challenge.tests.find((t) => t.id === sel.testId)!;
  return (
    <div className="rounded-3xl bg-white border-2 border-indigo-100 p-5" data-testid="results">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl font-extrabold">
          Passed {report.passed}/{report.total}
          {report.passed === report.total && ' 🎉'}
        </h3>
        <Link to="/profile" className="text-sm font-bold text-violet-600 hover:underline">My profile →</Link>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {report.results.map((r) => {
          const t = challenge.tests.find((x) => x.id === r.testId)!;
          const st = OUTCOME_STYLE[r.outcome];
          return (
            <button
              key={r.testId}
              onClick={() => onSelect(r.testId)}
              className={`text-left rounded-2xl border-2 px-3 py-2 text-sm transition ${st.cls} ${sel.testId === r.testId ? 'ring-2 ring-violet-400 ring-offset-1' : 'hover:brightness-95'}`}
              data-testid={`result-${r.testId}`}
              data-outcome={r.outcome}
            >
              <div className="flex items-center gap-1.5 font-extrabold">
                <span>{st.icon}</span>
                <span className="text-[11px] uppercase tracking-wider opacity-80">{COMPETENCY_META[t.category].label}</span>
              </div>
              <div className="font-bold leading-tight mt-0.5">{t.title}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-indigo-100">
        <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-900/50 mb-2">Replay: {selTest.title}</div>
        <Chat key={sel.testId} test={selTest} result={sel} upto={sel.steps.length} challenge={challenge} />
      </div>
    </div>
  );
}
