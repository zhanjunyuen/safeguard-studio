import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTACK_HINT_LIMIT } from './attackHints';
import { evidence, newMission } from './mission';
import { useMission } from '../store/mission';

vi.hoisted(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  });
});

const signal = new AbortController().signal;
const ask = () => useMission.getState().requestHint('history', signal);

describe('companion attack hints', () => {
  beforeEach(() => {
    const m = newMission();
    useMission.setState({ mission: { ...m, phase: 'attack', focus: 'history', first: m.draft } });
  });

  it('shares a single allowance across problems and records the delivered hints', async () => {
    await ask();
    await ask();
    useMission.getState().update({ focus: 'quiz' });
    await useMission.getState().requestHint('quiz', signal);
    await useMission.getState().requestHint('quiz', signal);
    const hints = evidence(useMission.getState().mission).attackHints!;
    expect(hints.map(h => h.desk)).toEqual(['history', 'history', 'quiz']);
    expect(new Set(hints.map(h => h.text)).size).toBe(ATTACK_HINT_LIMIT);
    useMission.getState().restart();
    expect(useMission.getState().mission.attackHints).toEqual([]);
  });

  it('only consumes delivered hints and ignores overlapping or stale replies', async () => {
    const { requestHint, update } = useMission.getState();
    await expect(requestHint('history', signal, async () => { throw Error('offline'); })).rejects.toThrow();
    const controller = new AbortController();
    await requestHint('history', controller.signal, async () => { controller.abort(); return 'Too late'; });
    await requestHint('history', signal, async () => { update({ phase: 'expired' }); return 'Too late'; });
    expect(useMission.getState().mission.attackHints).toHaveLength(0);
    update({ phase: 'attack' });
    await Promise.all([ask(), ask()]);
    expect(useMission.getState().mission.attackHints).toHaveLength(1);
    update({ launches: [{ desk: 'history', ids: ['h_date'] }] });
    const provider = vi.fn(async () => 'Already launched');
    await requestHint('history', signal, provider);
    expect(provider).not.toHaveBeenCalled();
  });
});
