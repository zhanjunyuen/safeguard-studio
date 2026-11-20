import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTACK_HINT_LIMIT, hintStage } from './attackHints';
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

  it('starts attack coaching from the selected card and draft, without earlier build advice', async () => {
    useMission.getState().update({
      attackHints: [{ desk: 'history', stage: 'build', text: 'Which block belongs first?' }],
      attackPlans: { history: ['history-poll'] }, customDrafts: { history: 'A fictional survey question' },
    });
    const provider = vi.fn(async () => 'What evidence would you look for in the reply?');
    await useMission.getState().requestHint('history', signal, provider);
    expect(provider).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'attack', previousHints: [], plannedAttacks: ['Quote an unchecked poll result'], hasCustomDraft: true,
    }), signal);
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

  it('offers hints while building in the six-challenge assessment, and records the stage', async () => {
    const m = useMission.getState().mission;
    useMission.setState({ mission: { ...m, form: 4, phase: 'build', focus: 'history', first: null, attackHints: [] } });
    expect(hintStage(useMission.getState().mission, 'history')).toBe('build');
    expect(hintStage(useMission.getState().mission, 'quiz')).toBeNull();
    const provider = vi.fn(async (ctx: { stage?: string; blocks: string[] }) => `hint for ${ctx.stage}`);
    await useMission.getState().requestHint('history', signal, provider);
    expect(useMission.getState().mission.attackHints).toEqual([{ desk: 'history', text: 'hint for build', stage: 'build' }]);
  });
});
