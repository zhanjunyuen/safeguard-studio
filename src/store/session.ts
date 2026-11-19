import { usePresenter } from './presenter';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BLOCKS } from '../data/blocks';
import type { PracticePrediction } from '../engine/curveball';
import type { CustomAttack } from '../engine/customAttack';
import { reflectionCase } from '../engine/reflection';
import { blockKey } from '../engine/scriptText';
import { pushRun } from '../lib/sync';
import type { BlockType, FailureKey, Outcome, RunReport, Scores, ScriptBlock } from '../types';

export interface Attempt {
  owner?: string | null;
  at: number;
  script: BlockType[];
  results: { testId: string; outcome: Outcome; failureKey?: FailureKey }[];
  scores: Scores;
}
export interface Reflection {
  owner?: string | null;
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
  curveballAttempts?: PracticePrediction[];
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

export interface BreakAttempt {
  owner?: string | null;
  at: number;
  attacks: string[];
  broke: string[];
  custom?: CustomAttack;
}

interface ClassRunTarget { studentId: string; challenge: string }

interface SessionState {
  studentName: string;
  progress: Record<string, ChallengeProgress>;
  breakProgress: Record<string, BreakAttempt[]>;
  recordCurveball: (cid: string, prediction: Omit<PracticePrediction, 'owner'>) => void;
  recordBreak: (cid: string, attacks: string[], broke: string[], custom?: CustomAttack) => void;
  get: (cid: string) => ChallengeProgress;
  setScript: (cid: string, script: ScriptBlock[], event?: Omit<LogEvent, 't'>) => void;
  recordRun: (cid: string, report: RunReport, target?: ClassRunTarget) => void;
  reflect: (cid: string, chosen: FailureKey, text: string, target?: ClassRunTarget) => boolean;
  reset: (cid: string) => void;
  resetAll: () => void;
  setName: (n: string) => void;
  /** set when the student has joined a class on the backend */
  classCode: string | null;
  className: string | null;
  studentId: string | null;
  joined: (classCode: string, className: string, studentId: string, name: string) => void;
  leaveClass: () => void;
}

const createSession = (name: string) => create<SessionState>()(
  persist(
    (set, get) => ({
      studentName: 'You',
      progress: {},
      breakProgress: {},
      recordCurveball: (cid, prediction) => set(st => {
        const p = st.progress[cid] ?? freshProgress();
        return { progress: { ...st.progress, [cid]: { ...p,
          curveballAttempts: [...(p.curveballAttempts ?? []), { ...prediction, owner: st.studentId }] } } };
      }),
      recordBreak: (cid, attacks, broke, custom) =>
        set((st) => ({
          breakProgress: { ...st.breakProgress, [cid]: [...(st.breakProgress[cid] ?? []), { at: Date.now(), owner: st.studentId, attacks, broke, ...(custom && { custom }) }] },
        })),
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
          const firstFail = reflectionCase(report.results, p.attempts[p.attempts.length - 1], p.reflections);
          const attempt: Attempt = {
            at: Date.now(), owner: st.studentId,
            script: p.script.map(blockKey),
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
                  attempt: p.attempts.length, owner: st.studentId,
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
      resetAll: () => set({ progress: {}, breakProgress: {} }),
      setName: (studentName) => set({ studentName }),
      classCode: null,
      className: null,
      studentId: null,
      joined: (classCode, className, studentId, studentName) => set({ classCode, className, studentId, studentName }),
      leaveClass: () => set({ classCode: null, className: null, studentId: null, studentName: 'You' }),
    }),
    {
      name, version: 1,
      migrate: (raw) => {
        const old = raw as SessionState;
        const owner = old.studentId ?? null;
        return { ...old,
          progress: Object.fromEntries(Object.entries(old.progress ?? {}).map(([id, p]) =>
            [id, { ...p, attempts: p.attempts.map(a => ({ owner, ...a })) }])),
          breakProgress: Object.fromEntries(Object.entries(old.breakProgress ?? {}).map(([id, attempts]) =>
            [id, attempts.map(a => ({ owner, ...a }))])),
        };
      },
    },
  ),
);

export const useSession = createSession('safeguard-studio-v1');
export const useDemoSession = createSession('safeguard-studio-demo-v1');

export function usePracticeStore() {
  return usePresenter(s => s.active) ? useDemoSession : useSession;
}

export const useAssessmentSession = createSession('school-community-challenge-work-v1');

export const describeAdd = (type: BlockType, index: number) =>
  `Added “${BLOCKS[type].label}” at position ${index + 1}`;

// Practice follows the joined class. Assessment runs carry an explicit matching class and level.
for (const store of [useSession, useAssessmentSession]) {
  const { recordRun, reflect } = store.getState();
  store.setState({
    recordRun: (cid, report, target) => {
      recordRun(cid, report);
      const student = target?.studentId ?? (store === useSession ? store.getState().studentId : null);
      if (!student) return;
      const { script, scores, results } = store.getState().get(cid).attempts.at(-1)!;
      pushRun(student, { challenge: target?.challenge ?? cid, mode: 'build', script, results, scores });
    },
    reflect: (cid, chosen, text, target) => {
      const pending = store.getState().get(cid).pendingReflection;
      const correct = reflect(cid, chosen, text);
      const student = target?.studentId ?? (store === useSession ? store.getState().studentId : null);
      if (student && pending) pushRun(student, {
        challenge: target?.challenge ?? cid, mode: 'reflect', script: [], results: [],
        reflection: { ...pending, chosen, correct, text: target ? '' : text },
      });
      return correct;
    },
  });
}

const recordBreak = useSession.getState().recordBreak;
useSession.setState({
  recordBreak: (cid, attacks, broke, custom) => {
    recordBreak(cid, attacks, broke, custom);
    if (attacks.length) pushRun(useSession.getState().studentId, { challenge: cid, mode: 'break', script: attacks, results: broke });
  },
});
