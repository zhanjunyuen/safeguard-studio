import { describe, it, expect } from 'vitest';
import { getChallenge } from '../data/challenges';
import { freshProgress, type Attempt } from '../store/session';
import { newAssessment, evaluate } from './mission';
import { personalPractice, pupilRuns, runFacts, parsePupilAnswer, practiceSuggestion } from './pupilResults';
// @ts-expect-error shared with the Supabase Edge Function
import { buildTask, MAX_JSON } from '../../supabase/functions/literacy-ai/prompts.js';

const id = 'history';
const build = ['ask_ai'];
const rules = build.map(type => ({ scope: id, type }));
function attempt(time: number, script = build): Attempt {
  const row = evaluate(script.map(type => ({ type, scope: id })), 'h_address');
  return { at: time, script, scores: { verification: null, privacy: 0, integrity: null, bias: null, usefulness: 50 },
    results: [{ testId: row.id, outcome: row.result.outcome }] };
}
const work = { history: { ...freshProgress(), attempts: [attempt(1), attempt(2, ['remove_pii', 'ask_ai'])] } };
const mission = { ...newAssessment(), phase: 'attack' as const, assigned: [id], frozen: { history: rules },
  attackReasons: { history: 'unsubmitted edit' }, customDrafts: { history: 'private draft' },
  launches: [{ desk: id, ids: ['h_address'], reason: 'I think the address will be shared.', custom: {
    question: 'Can I share this invitation?', category: 'privacy' as const, outcome: 'uncertain' as const, explanation: 'The invitation has no details.' } }] };

describe('pupil results questions', () => {
  it('uses observed cases, source runs and the saved prediction, keeping drafts and unseen cases out', () => {
    const runs = pupilRuns({}, {}, work, mission);
    const facts = runs.map(runFacts);
    expect(runs).toHaveLength(3);
    expect(facts.find(f => f.submittedPrediction)).toMatchObject({ submittedPrediction: mission.launches[0].reason, aiJudgement: { outcome: 'uncertain' } });
    const built = facts.filter(f => f.deploymentCreditsPerRequest !== undefined);
    expect(built.map(f => [f.cases[0].outcome, f.deploymentCreditsPerRequest])).toEqual([['pass', 12], ['fail', 10]]);
    const packet = { runs: facts };
    const prompt = buildTask({ task: 'pupilResults', question: 'Compare my builds', evidence: packet });
    expect(JSON.stringify(packet).length).toBeLessThan(MAX_JSON);
    expect(prompt.input).not.toContain(getChallenge(id)!.tests[0].title);
    expect(prompt.input).not.toMatch(/private draft|unsubmitted edit|curveball/i);
    expect(buildTask.bind(null, { task: 'pupilResults', question: 'Explain', evidence: { runs: [] } })).toThrow();
    expect(pupilRuns({}, {}, work, newAssessment())).toEqual([]);
  });
  it('isolates personal runs and bases recommendations on each latest build', () => {
    const mixed = { history: { ...work.history, attempts: [attempt(1), { ...attempt(3), owner: 'someone-else' }] } };
    const runs = pupilRuns(mixed, { history: [{ at: 5, owner: 'someone-else', attacks: ['h_essay'], broke: [] }] }, {});
    expect(runs.map(r => r.id)).toEqual(['practice-history-run-1']);
    expect(practiceSuggestion(runs)?.skill).toBe('privacy');
    expect(practiceSuggestion(pupilRuns(work, {}, {}))?.skill).toBeUndefined();
    expect(runFacts(runs[0]).projectedWorkloadCredits).toBeUndefined();
  });
  it('separates interleaved pupil histories and keeps reflections with their own runs', () => {
    const r = { attempt: 2, testId: 'h_address', expected: 'pii_sent' as const, chosen: 'pii_sent' as const, correct: true, text: 'Mine' };
    const history = { history: { ...work.history, attempts: [attempt(1), { ...attempt(2), owner: 'B' }, attempt(3)],
      reflections: [r, { ...r, attempt: 1, text: 'Guest' }, { ...r, owner: 'A', text: 'Different author' }] } };
    const attacks = { history: [{ owner: 'B', at: 1, attacks: ['h_address'], broke: [] }], quiz: [{ owner: 'A', at: 2, attacks: [], broke: [] }] };
    const mine = personalPractice(history, attacks, 'B');
    expect(mine.progress.history.attempts.map(a => a.at)).toEqual([2]);
    expect(mine.progress.history.reflections).toEqual([{ ...r, attempt: 1 }]);
    expect(Object.keys(mine.breakProgress)).toEqual(['history']);
    expect(personalPractice(history, attacks, null).progress.history.reflections.map(f => f.text)).toEqual(['Guest']);
    expect(pupilRuns(history, {}, {}, undefined, 'B')[0]).toMatchObject({ id: 'practice-history-run-2', label: 'Run 1' });
    expect(history.history.reflections[0].attempt).toBe(2);
  });
  it('rejects nonexistent sources and unsupported replies', () => {
    const ids = ['practice-history-run-1'];
    expect(parsePupilAnswer('{"answer":"OK","sources":["other-run"]}', ids)).toBeNull();
    expect(parsePupilAnswer('{"answer":"OK","sources":[]}', ids)).toBeNull();
    expect(parsePupilAnswer(JSON.stringify({ answer: 'You checked the address.', sources: ids }), ids)?.sources).toEqual(ids);
  });
});
