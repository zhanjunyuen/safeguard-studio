import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newMission, submitAttack, type Mission } from '../engine/mission';

interface MissionState {
  mission: Mission;
  update: (patch: Partial<Mission>) => void;
  tick: (seconds: number) => void;
  launch: () => void;
  restart: () => void;
}

export const useMission = create<MissionState>()(persist((set) => ({
  mission: newMission(),
  update: patch => set(s => ({ mission: { ...s.mission, ...patch } })),
  tick: seconds => set(s => {
    const m = s.mission;
    if (!['build', 'evaluation', 'attack', 'revise', 'release'].includes(m.phase)) return s;
    const elapsed = m.elapsed + seconds;
    const expired = m.minutes > 0 && elapsed >= m.minutes * 60;
    return { mission: { ...m, elapsed: expired ? m.minutes * 60 : elapsed, phase: expired ? 'expired' : m.phase } };
  }),
  launch: () => set(s => ({ mission: submitAttack(s.mission) })),
  restart: () => set({ mission: newMission() }),
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
