import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newMission, nextAssignedCase, type Mission, type Probe } from '../engine/mission';

interface MissionState {
  mission: Mission;
  pending: Partial<Probe>;
  setPending: (patch: Partial<Probe>) => void;
  update: (patch: Partial<Mission>) => void;
  tick: (seconds: number) => void;
  submitProbe: (probe: Probe) => void;
  restart: () => void;
}

export const useMission = create<MissionState>()(persist((set) => ({
  mission: newMission(), pending: {},
  setPending: patch => set(s => ({ pending: { ...s.pending, ...patch } })),
  update: patch => set(s => ({ mission: { ...s.mission, ...patch } })),
  tick: seconds => set(s => {
    const m = s.mission;
    if (!['build', 'attack', 'revise', 'release'].includes(m.phase)) return s;
    const elapsed = m.elapsed + seconds;
    const expired = m.minutes > 0 && elapsed >= m.minutes * 60;
    return { mission: { ...m, elapsed: expired ? m.minutes * 60 : elapsed, phase: expired ? 'expired' : m.phase } };
  }),
  submitProbe: probe => set(s => {
    if (s.mission.phase !== 'attack' || nextAssignedCase(s.mission.probes) !== probe.id || !probe.reason.trim()) return s;
    return { mission: { ...s.mission, probes: [...s.mission.probes, probe] }, pending: {} };
  }),
  restart: () => set({ mission: newMission(), pending: {} }),
}), {
  name: 'school-community-assessment-v1',
  version: 1,
  migrate: stored => {
    const state = stored as Pick<MissionState, 'mission' | 'pending'>;
    const m = state.mission;
    if (m.phase === 'complete' || m.phase === 'expired') return state;
    // Carry submitted predictions and editable work into the assigned sequence.
    return { mission: { ...m, form: 2, phase: m.first ? 'attack' : m.phase }, pending: {} };
  },
}));
