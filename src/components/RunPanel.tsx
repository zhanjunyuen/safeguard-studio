import { AnimatePresence, motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BLOCKS, COMPETENCY_META } from '../data/blocks';
import type { Challenge, Outcome, RunReport, ScriptBlock, StepStatus, TestResult, TraceStep } from '../types';
import { DIM_ICON } from './icons';
import { blockUsage, usefulnessAdvice } from '../engine/advice';

export const OUTCOME_STYLE: Record<Outcome, { label: string; text: string; soft: string; bar: string }> = {
  pass: { label: 'Pass', text: 'text-pass', soft: 'bg-pass-soft', bar: 'bg-pass' },
  partial: { label: 'Partly', text: 'text-partial', soft: 'bg-partial-soft', bar: 'bg-partial' },
  fail: { label: 'Fail', text: 'text-fail', soft: 'bg-fail-soft', bar: 'bg-fail' },
  'over-blocked': { label: 'Too cautious', text: 'text-neutral', soft: 'bg-neutral-soft', bar: 'bg-neutral' },
};

const STEP_CLS: Record<StepStatus, string> = {
  ok: 'text-ink-2',
  acted: 'text-pass',
  warn: 'text-partial',
  stop: 'text-fail',
  skip: 'text-ink-3 line-through',
};
const STEP_MARK: Record<StepStatus, string> = { ok: '·', acted: '✓', warn: '!', stop: '✕', skip: '–' };

function stepName(s: TraceStep) {
  if (s.blockType === 'trigger') return 'When someone asks';
  if (s.blockType === 'reply') return 'Reply';
  if (s.blockType === 'if' || s.blockType === 'ifelse') return 'IF';
  return BLOCKS[s.blockType].label;
}

export function Exchange({ test, result, upto, challenge, helperLabel = 'Your helper' }: { test: Challenge['tests'][number]; result: TestResult; upto: number; challenge: Challenge; helperLabel?: string }) {
  const showReply = upto >= result.steps.length - 1;
  const st = result.blocked && result.outcome === 'pass'
    ? { ...OUTCOME_STYLE['over-blocked'], label: 'Refused' } : OUTCOME_STYLE[result.outcome];
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-md rounded-br-sm bg-ink text-paper px-4 py-2.5">
          <div className="label text-paper/60 mb-1">{challenge.audience.replace(/^For /, '')}</div>
          {test.question}
        </div>
      </div>
      <ol className="text-sm space-y-1 border-l-1.5 border-line pl-3 ml-1" aria-label="What each block did">
        {result.steps.slice(0, upto + 1).map((s, i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2 leading-snug ${STEP_CLS[s.status]}`}>
            <span className="font-mono w-3 shrink-0 font-bold" aria-hidden>{STEP_MARK[s.status]}</span>
            <span><span className="font-bold">{stepName(s)}:</span> {s.message}</span>
          </motion.li>
        ))}
      </ol>
      {showReply ? (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          <div className="max-w-[92%] rounded-md rounded-bl-sm border-1.5 border-ink bg-paper-card px-4 py-2.5 whitespace-pre-line">
            <div className="label text-ink-3 mb-1">{helperLabel}{result.flagged && ' · teacher flagged'}</div>
            {result.reply}
          </div>
          <div className={`mt-3 flex gap-3 items-start rounded p-3 ${st.soft}`}>
            <span className={`stamp text-xs shrink-0 ${st.text}`}>{st.label}</span>
            <p className="text-[15px] leading-snug">{result.explanation}</p>
          </div>
        </motion.div>
      ) : (
        <div className="typing text-xl text-ink-3 pl-2" aria-label="Helper is replying"><span>•</span><span>•</span><span>•</span></div>
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
  /** 'break' relabels results from the attacker's side */
  mode?: 'build' | 'break';
  /** usefulness needed to pass (Build mode) */
  target?: number;
  /** the helper that was run, for specific usefulness advice */
  script?: ScriptBlock[];
  level2?: boolean;
  weakTotal?: number;
}

const BREAK_STAMP = (o: Outcome) => (o === 'pass' ? { label: 'Held', text: 'text-neutral' } : { label: 'Broke it', text: 'text-pass' });

const panel = 'rounded-md border-1.5 border-ink bg-paper-card p-5';

export default function RunPanel({ challenge, report, replay, selected, onSelect, seen, onSkip, mode = 'build', weakTotal = 0, target, script = [], level2 = false }: Props) {
  const testsIn = report ? report.results.map((r) => challenge.tests.find((t) => t.id === r.testId)!) : challenge.tests;
  if (replay && report) {
    const r = report.results[replay.testIdx];
    const t = testsIn[replay.testIdx];
    return (
      <div className={panel} data-testid="replay" aria-live="polite">
        <div className="flex items-center justify-between">
          <span className="label text-ink-2">{mode === 'break' ? 'Attack' : 'Test'} {replay.testIdx + 1} of {report.total}</span>
          <button onClick={onSkip} className="text-sm font-bold underline underline-offset-2 hover:no-underline">Skip to results</button>
        </div>
        <div className="flex gap-1 mt-2 mb-4" aria-hidden>
          {report.results.map((x, i) => (
            <div key={i} className={`h-2 flex-1 rounded-sm ${i < replay.testIdx ? OUTCOME_STYLE[x.outcome].bar : i === replay.testIdx ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={replay.testIdx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
            <h3 className="text-xl font-extrabold mb-3">{t.title}</h3>
            <Exchange test={t} result={r} upto={replay.stepIdx} challenge={challenge} />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={panel}>
        <h2 className="text-lg font-extrabold">Test sheet</h2>
        <p className="text-ink-2 mb-4">Your helper will face {challenge.tests.length} situations. What could go wrong? Build for it, then press Run.</p>
        <ol className="divide-y-1.5 divide-dashed divide-line border-y-1.5 border-dashed border-line">
          {challenge.tests.map((t, i) => {
            const isSeen = seen.includes(t.id);
            const Icon = DIM_ICON[t.category];
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="font-mono text-sm font-bold text-ink-3 w-6">T{i + 1}</span>
                {isSeen ? <Icon size={16} className="text-ink-2" aria-hidden /> : <Lock size={16} className="text-ink-3" aria-hidden />}
                <span className={isSeen ? 'font-bold' : 'text-ink-3'}>{isSeen ? t.title : 'Hidden until you run'}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  const sel = report.results.find((r) => r.testId === selected) ?? report.results[0];
  const selTest = challenge.tests.find((t) => t.id === sel.testId)!;
  return (
    <div className={panel} data-testid="results">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold">
          {mode === 'break'
            ? `Broke it ${report.total - report.passed} of ${report.total} times`
            : `${report.passed} of ${report.total} passed`}
        </h2>
        <Link to="/profile" className="text-sm font-bold underline underline-offset-2 hover:no-underline">My results</Link>
      </div>
      {mode === 'build' && target !== undefined && (() => {
        const u = report.scores.usefulness;
        const okU = u >= target;
        const solved = okU && report.passed === report.total;
        return (
          <div className={`mt-2 flex items-center gap-3 rounded p-2.5 ${solved ? 'bg-pass-soft' : okU ? 'bg-paper' : 'bg-fail-soft'}`} data-testid="usefulness">
            <span className={`stamp text-[11px] ${solved ? 'text-pass' : 'text-fail'}`}>{solved ? 'Solved' : 'Not yet'}</span>
            <p className="text-sm leading-snug">
              <b>Usefulness {u}</b> (needs {target}).{' '}
              {!okU
                ? usefulnessAdvice(script, report, level2, challenge)
                : report.passed < report.total
                  ? 'Useful enough, now fix the tests that failed.'
                  : 'Safe and useful.'}
            </p>
          </div>
        );
      })()}
      {mode === 'build' && target !== undefined && report.scores.usefulness < target && script.length > 0 && (
        <details className="mt-2 rounded border-1.5 border-line p-2.5 text-sm" open data-testid="usefulness-breakdown">
          <summary className="font-bold cursor-pointer">Where your usefulness points go</summary>
          <p className="text-xs text-ink-2 mt-1">Each block costs points on every message it runs on. Blocks inside an IF only cost points when the IF is true.</p>
          <table className="w-full mt-2">
            <thead>
              <tr className="text-left label text-ink-3">
                <th scope="col" className="py-1 font-bold">Block</th>
                <th scope="col" className="py-1 px-1.5 text-center font-bold whitespace-nowrap">Ran on</th>
                <th scope="col" className="py-1 px-1.5 text-center font-bold">Helped</th>
                <th scope="col" className="py-1 pl-1.5 text-right font-bold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {blockUsage(script, report, challenge)
                .sort((a, b) => b.points - a.points)
                .map((u) => {
                  const wasteful = u.ran > 0 && u.helped < u.ran;
                  return (
                    <tr key={u.uid} className="border-t border-line align-top">
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                        <span className="font-bold">{u.conditional && <span className="font-mono text-[11px] mr-1">IF</span>}{u.label}</span>
                        {u.helped > 0 && wasteful && <div className="text-xs text-ink-2">Helped on: {u.helpedOn.join(', ')}</div>}
                        {!u.cueable && !u.conditional && u.helped > 0 && (
                          <div className="text-xs text-ink-3 italic">Checks need to run every time: you can't tell from the message whether the AI will get it wrong.</div>
                        )}
                      </th>
                      <td className="py-1.5 text-center font-mono">{u.ran}/{report.total}</td>
                      <td className={`py-1.5 text-center font-mono ${u.helped === 0 ? 'text-fail' : ''}`}>{u.helped}</td>
                      <td className={`py-1.5 text-right font-mono ${(u.helped === 0 || (wasteful && u.cueable && !u.conditional)) && u.points >= 1 ? 'text-fail font-bold' : ''}`}>−{u.points}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </details>
      )}
      <ol className="mt-3 divide-y-1.5 divide-dashed divide-line border-y-1.5 border-dashed border-line">
        {report.results.map((r, i) => {
          const t = challenge.tests.find((x) => x.id === r.testId)!;
          const st = mode === 'break' ? BREAK_STAMP(r.outcome) : OUTCOME_STYLE[r.outcome];
          const active = sel.testId === r.testId;
          return (
            <li key={r.testId}>
              <button
                onClick={() => onSelect(r.testId)}
                aria-pressed={active}
                className={`w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded text-left transition-colors ${active ? 'bg-paper-deep' : 'hover:bg-paper'}`}
                data-testid={`result-${r.testId}`}
                data-outcome={r.outcome}
              >
                <span className="font-mono text-sm font-bold text-ink-3 w-6">{mode === 'break' ? 'A' : 'T'}{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold leading-tight">{mode === 'break' ? t.attackLabel : t.title}</span>
                  <span className="text-xs text-ink-3">{COMPETENCY_META[t.category].label}</span>
                </span>
                <span className={`stamp text-[11px] ${st.text}`}>{st.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-5">
        <div className="label text-ink-3 mb-2">Replay · {selTest.title}</div>
        <Exchange key={sel.testId} test={selTest} result={sel} upto={sel.steps.length} challenge={challenge} />
      </div>
    </div>
  );
}
