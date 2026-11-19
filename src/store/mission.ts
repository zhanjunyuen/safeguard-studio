import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAttackHintProvider, hintAvailable, hintStage, type AttackHintProvider } from '../engine/attackHints';
import { blockKey } from '../engine/scriptText';
import { getChallenge } from '../data/challenges';
import type { BlockType } from '../types';
import { useAssessmentSession } from './session';
import { challengeIdFor, newAssessment, submitAttack, type Desk, type Mission } from '../engine/mission';

interface MissionState {
  mission: Mission;
  update: (patch: Partial<Mission>) => void;
  tick: (seconds: number) => void;
  launch: () => void;
  requestHint: (desk: Desk, signal: AbortSignal, provider?: AttackHintProvider) => Promise<void>;
  restart: () => void;
}

export const useMission = create<MissionState>()(persist((set, get) => ({
  mission: newAssessment(),
  update: patch => set(s => ({ mission: { ...s.mission, ...patch } })),
  tick: seconds => set(s => {
    const m = s.mission;
    if (!['menu', 'build', 'evaluation', 'attack', 'revise', 'release'].includes(m.phase)) return s;
    const elapsed = m.elapsed + seconds;
    const expired = m.minutes > 0 && elapsed >= m.minutes * 60;
    return { mission: { ...m, elapsed: expired ? m.minutes * 60 : elapsed, phase: expired ? 'expired' : m.phase } };
  }),
  launch: () => set(s => ({ mission: submitAttack(s.mission) })),
  requestHint: async (desk, signal, provider = getAttackHintProvider()) => {
    const before = get().mission;
    if (signal.aborted || !hintAvailable(before, desk)) return;
    const stage = hintStage(before, desk)!;
    // Attack: the frozen build. Build: the blocks currently in the editor.
    const blocks = stage === 'attack'
      ? before.first!.filter(r => r.scope === 'all' || r.scope === desk).map(r => r.type)
      : (useAssessmentSession.getState().progress[desk]?.script.map(blockKey) ?? ['ask_ai']) as BlockType[];
    const previousHints = (before.attackHints ?? []).filter(h => h.desk === desk).map(h => h.text);
    // What the pupil has already seen and chosen, so the hint builds on their own work.
    const challenge = getChallenge(challengeIdFor(before, desk));
    const lastRun = useAssessmentSession.getState().progress[desk]?.attempts.slice(-1)[0];
    const latestResults = lastRun?.results.map(r => ({
      test: challenge?.tests.find(t => t.id === r.testId)?.title ?? r.testId,
      outcome: r.outcome === 'pass' ? 'handled' : r.outcome === 'partial' ? 'partly handled' : r.outcome === 'over-blocked' ? 'refused a normal request' : 'got through',
    }));
    const plannedAttacks = stage === 'attack'
      ? (before.attackPlans?.[desk] ?? []).map(id => challenge?.tests.find(t => t.id === id)?.attackLabel ?? id) : undefined;
    const text = (await provider({ desk, blocks, previousHints, challengeId: challengeIdFor(before, desk), stage, latestResults, plannedAttacks }, signal)).trim();
    if (signal.aborted) return;
    if (!text) throw new Error('The hint provider returned an empty response.');
    set(state => {
      const m = state.mission;
      if (m.first !== before.first || m.attackHints !== before.attackHints || !hintAvailable(m, desk)) return state;
      return { mission: { ...m, attackHints: [...(m.attackHints ?? []), { desk, text, stage }] } };
    });
  },
  restart: () => {
    useAssessmentSession.getState().resetAll();
    set(({ mission }) => ({ mission: { ...newAssessment(), classCode: mission.classCode, settings: mission.classCode ? mission.settings : undefined } }));
  },
}), {
  name: 'school-community-assessment-v1',
  version: 2,
  migrate: stored => {
    const { mission } = stored as Pick<MissionState, 'mission'>;
    if (mission.phase === 'complete' || mission.phase === 'expired') return { mission };
    return { mission: {
      ...mission, form: 3, attackPlans: {}, launches: [], focus: 'history',
      phase: mission.first ? 'evaluation' : mission.phase,
    } };
  },
}));
