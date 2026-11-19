import { describe, expect, it } from 'vitest';
import { attackCases } from '../data/attackCases';
import { missionCase } from '../data/mission';
import { CHALLENGES, getChallenge, practiceLevels } from '../data/challenges';
import { coreTestsPassed } from './breaker';
import { parseCustomAttack } from './customAttack';
import { challengeEvidence, challengeMarkRequests } from './challengeEvidence';
import { markPacket } from './markPacket';
import { newAssessment, submitAttack } from './mission';
import { assignmentFor, cleanSettings } from './assessmentSettings';

describe('assessment attack flow', () => {
  const core = getChallenge('history')!.tests;
  it('counts four distinct passes on the core cases, independently of the level 2 edge case', () => {
    const results = core.slice(0, 3).map(t => ({ testId: t.id, outcome: 'pass' }));
    expect(coreTestsPassed('history', [...results, results[0], { testId: 'edge', outcome: 'pass' }, { testId: core[3].id, outcome: 'partial' }])).toBe(3);
    expect(coreTestsPassed('history', [...results, { testId: core[3].id, outcome: 'pass' }])).toBe(4);
  });
  const question = 'Would you send this public invitation with my email address?';
  const custom = parseCustomAttack(JSON.stringify({ outcome: 'exposed', category: 'privacy', explanation: 'Ask AI would receive the details before a check.' }), question)!;
  const first = [{ type: 'ask_ai', scope: 'history' }];
  const mission = { ...newAssessment(), assigned: ['history'], focus: 'history', phase: 'attack' as const, first, frozen: { history: first }, customDrafts: { history: question }, attackReasons: { history: 'I predict the address will be shared.' } };
  it('retains an AI-only launch in the report and marking packet, rejects malformed replies and respects the budget', () => {
    expect(parseCustomAttack('{"outcome":"exposed"}', question)).toBeNull();
    const done = submitAttack(mission, custom);
    expect(done.launches?.[0]).toMatchObject({ ids: [], custom });
    expect(challengeEvidence(done, {}).challenges[0].attack?.custom).toEqual(custom);
    expect(markPacket(challengeMarkRequests(done, {}, 'history').testing!)).toMatchObject({ pupilWrittenRequestAndAiJudgement: custom });
    expect(submitAttack(done, custom)).toBe(done);
    const full = { ...mission, attackPlans: { history: core.slice(0, 3).map(t => t.id) } };
    expect(submitAttack(full, custom)).toBe(full);
  });
  it('offers six extra preset attacks on every task and resolves each for feedback at both levels', () => {
    for (const task of practiceLevels(CHALLENGES)) {
      const presets = attackCases(task);
      expect(new Set(presets.map(t => t.id)).size).toBe(task.tests.length + 6);
      for (const preset of presets) expect(missionCase(preset.id).test).toEqual(preset);
    }
  });
  it('replays the extra cards without adding build tests', () => {
    const done = submitAttack({ ...mission, attackPlans: { history: ['history-public-note', 'history-ordinary-name'] } });
    expect(challengeEvidence(done, {}).challenges[0].attack?.cases).toHaveLength(2);
    expect(core).toHaveLength(6);
  });
  it('applies a shorter random assignment and custom active time from saved class settings', () => {
    const s = cleanSettings({ taskCount: 3, minutes: 37 });
    expect(s.minutes).toBe(37);
    const tasks = assignmentFor(s, () => 0.5);
    expect(new Set(tasks).size).toBe(3);
    expect(new Set(assignmentFor(cleanSettings({ taskCount: 21 }), () => 0.5)).size).toBe(21);
    expect(assignmentFor(cleanSettings({ taskCount: 1, challenges: ['party','quiz'] }))).toEqual(['party','quiz']);
  });
});
