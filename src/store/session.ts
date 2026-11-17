import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BLOCKS } from '../data/blocks';
import type { BlockType, FailureKey, Outcome, RunReport, Scores, ScriptBlock } from '../types';

export interface Attempt {
  at: number;
  script: BlockType[];
  results: { testId: string; outcome: Outcome; failureKey?: FailureKey }[];
  scores: Scores;
}
export interface Reflection {
  attempt: number;
  testId: string;
  expected: FailureKey;
  chosen: FailureKey;
  correct: boolean;
  text: string;
}
export interface LogEvent {
  t: number;
  kind: 'add' | 'remove' | 'move' | 'run' | 'reflect';
  text: string;
}
export interface ChallengeProgress {
  script: ScriptBlock[];
  attempts: Attempt[];
  reflections: Reflection[];
  events: LogEvent[];
  pendingReflection: { testId: string; expected: FailureKey } | null;
  seen: string[];
}

let uidCounter = 0;
export const newUid = (type: string) => `${type}-${Date.now().toString(36)}-${uidCounter++}`;

export const freshProgress = (): ChallengeProgress => ({
  script: [{ uid: newUid('ask_ai'), type: 'ask_ai' }],
  attempts: [],
  reflections: [],
  events: [],
  pendingReflection: null,
  seen: [],
});

interface SessionState {
  studentName: string;
  progress: Record<string, ChallengeProgress>;
  get: (cid: string) => ChallengeProgress;
  setScript: (cid: string, script: ScriptBlock[], event?: Omit<LogEvent, 't'>) => void;
  recordRun: (cid: string, report: RunReport) => void;
  reflect: (cid: string, chosen: FailureKey, text: string) => boolean;
  reset: (cid: string) => void;
  resetAll: () => void;
  setName: (n: string) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      studentName: 'You',
      progress: {},
      get: (cid) => get().progress[cid] ?? freshProgress(),
      setScript: (cid, script, event) =>
        set((st) => {
          const p = st.progress[cid] ?? freshProgress();
          return {
            progress: {
              ...st.progress,
              [cid]: { ...p, script, events: event ? [...p.events, { ...event, t: Date.now() }] : p.events },
            },
          };
        }),
      recordRun: (cid, report) =>
        set((st) => {
          const p = st.progress[cid] ?? freshProgress();
          const firstFail = report.results.find((r) => r.outcome !== 'pass' && r.failureKey);
          const attempt: Attempt = {
            at: Date.now(),
            script: p.script.map((b) => b.type),
            results: report.results.map(({ testId, outcome, failureKey }) => ({ testId, outcome, failureKey })),
            scores: report.scores,
          };
          return {
            progress: {
              ...st.progress,
              [cid]: {
                ...p,
                attempts: [...p.attempts, attempt],
                seen: Array.from(new Set([...p.seen, ...report.results.map((r) => r.testId)])),
                pendingReflection: firstFail ? { testId: firstFail.testId, expected: firstFail.failureKey! } : null,
                events: [
                  ...p.events,
                  {
                    t: Date.now(),
                    kind: 'run',
                    text: `Run #${p.attempts.length + 1}: passed ${report.passed}/${report.total}`,
                  },
                ],
              },
            },
          };
        }),
      reflect: (cid, chosen, text) => {
        const p = get().get(cid);
        if (!p.pendingReflection) return false;
        const correct = chosen === p.pendingReflection.expected;
        set((st) => ({
          progress: {
            ...st.progress,
            [cid]: {
              ...p,
              pendingReflection: null,
              reflections: [
                ...p.reflections,
                {
                  attempt: p.attempts.length,
                  testId: p.pendingReflection!.testId,
                  expected: p.pendingReflection!.expected,
                  chosen,
                  correct,
                  text,
                },
              ],
              events: [
                ...p.events,
                { t: Date.now(), kind: 'reflect', text: `Explained a failure (${correct ? 'correct' : 'incorrect'})` },
              ],
            },
          },
        }));
        return correct;
      },
      reset: (cid) => set((st) => ({ progress: { ...st.progress, [cid]: freshProgress() } })),
      resetAll: () => set({ progress: {} }),
      setName: (studentName) => set({ studentName }),
    }),
    { name: 'safeguard-studio-v1' },
  ),
);

export const describeAdd = (type: BlockType, index: number) =>
  `Added “${BLOCKS[type].label}” at position ${index + 1}`;
