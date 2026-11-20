import { describe, expect, it } from 'vitest';
import { cleanSettings } from './assessmentSettings';
import { CURVEBALLS } from '../data/curveballs';
import { catalogue, DESKS } from '../data/mission';
import { getChallenge } from '../data/challenges';
import { challengeMarkRequests } from './challengeEvidence';
import { finalScore } from './finalScore';
import { CONFIDENCE_LEVELS, curveballHandled, runCurveball, submitCurveball } from './curveball';
import { newAssessment, type Desk, type Rule } from './mission';
import type { BlockType } from '../types';

const rules = (desk: Desk, types: BlockType[]): Rule[] => types.map(type => ({ type, scope: desk }));
const ideal = (desk: Desk) => rules(desk, getChallenge(desk)!.ideal);
/** Every safeguard in the palette, without the refuse-everything traps: "just throw blocks in". */
const stuffed = (desk: Desk) => {
  const palette = getChallenge(desk)!.palette.filter(b => !['ask_grownup', 'teacher_approves_all', 'block_people'].includes(b) && !b.startsWith('refuse_'));
  const before = palette.filter(b => ['before', 'either', 'anywhere'].includes(getPosition(b)));
  const after = palette.filter(b => getPosition(b) === 'after');
  return rules(desk, [...before, 'ask_ai', ...after]);
};
import { BLOCKS } from '../data/blocks';
const getPosition = (b: BlockType) => BLOCKS[b].position;

describe('curveballs', () => {
  it('has one unseen case per assessed challenge, none of them in the standard tests', () => {
    for (const d of DESKS) {
      const cb = CURVEBALLS[d.id]!;
      expect(getChallenge(d.id)!.tests.some(t => t.id === cb.test.id)).toBe(false);
    }
  });

  it('beats the reference build on five of six challenges, and adding every block does not help', () => {
    const idealOutcomes = Object.fromEntries(DESKS.map(d => [d.id, runCurveball(ideal(d.id), d.id).outcome]));
    expect(idealOutcomes).toEqual({ history: 'fail', party: 'fail', news: 'fail', quiz: 'fail', chat: 'fail', options: 'pass' });
    const stuffedHandled = DESKS.filter(d => curveballHandled(runCurveball(stuffed(d.id), d.id))).map(d => d.id);
    expect(stuffedHandled).toEqual(['options']);
  });

  it('has a curveball for every one of the 21 challenges, none of them a standard or Level 2 test', () => {
    for (const d of catalogue) {
      const cb = CURVEBALLS[d.id];
      expect(cb, d.id).toBeDefined();
      expect(getChallenge(d.id)!.tests.some(t => t.id === cb!.test.id)).toBe(false);
      expect(getChallenge(d.id + '@2')?.tests.some(t => t.id === cb!.test.id) ?? false).toBe(false);
    }
  });

  it('the 15 newer curveballs beat the reference build at both levels, except the deepfake scam a scam check can catch', () => {
    const newer = catalogue.filter(d => !DESKS.some(x => x.id === d.id));
    expect(newer).toHaveLength(15);
    const outcome = (desk: Desk, level: 1 | 2) => runCurveball(rules(desk, getChallenge(level === 2 ? desk + '@2' : desk)!.ideal), desk);
    const table = Object.fromEntries(newer.map(d => [d.id, [outcome(d.id, 1).outcome, outcome(d.id, 2).outcome].join('/')]));
    expect(table).toEqual({
      sciencefair: 'fail/fail', fakephoto: 'fail/fail', photocaption: 'fail/fail', signup: 'fail/fail', coding: 'fail/fail',
      artproject: 'fail/fail', teampicker: 'fail/fail', schoolplay: 'fail/fail', debate: 'fail/fail', wellbeing: 'fail/fail',
      firstaid: 'fail/fail', aifriend: 'fail/fail', gamemod: 'fail/fail', shopping: 'fail/fail', prizescam: 'pass/pass',
    });
    const stuffedHandled = newer.filter(d => curveballHandled(runCurveball(stuffed(d.id), d.id))).map(d => d.id);
    expect(stuffedHandled).toEqual(['coding', 'teampicker', 'prizescam']);
    expect(newer.filter(d => curveballHandled(runCurveball(rules(d.id, ['ask_ai']), d.id)))).toEqual([]);
  });

  it('shows the specific way each safeguard falls short', () => {
    expect(runCurveball(ideal('history'), 'history').failureKey).toBe('wrong_check'); // a fact check does not check a book exists
    expect(runCurveball(ideal('news'), 'news').failureKey).toBe('wrong_check');       // checking quotes and numbers does not check a photo
    expect(runCurveball(ideal('quiz'), 'quiz').failureKey).toBe('judged_unfairly');   // bias is not a wrong fact
    expect(runCurveball(ideal('party'), 'party').failureKey).toBe('fell_for_injection');
    expect(runCurveball(ideal('chat'), 'chat').failureKey).toBe('missed_scam');
    expect(runCurveball(rules('options', ['ask_ai']), 'options').failureKey).toBe('one_sided');
  });

  it('counts refusing as safe but not as handled well, and a teacher flag as only partial', () => {
    const refused = runCurveball(rules('party', ['refuse_food', 'ask_ai']), 'party');
    expect(refused.blocked).toBe(true);
    expect(curveballHandled(refused)).toBe(false);
    const flagged = runCurveball(rules('chat', ['ask_ai', 'flag_teacher']), 'chat');
    expect(flagged.outcome).toBe('partial');
    expect(curveballHandled(flagged)).toBe(false);
  });

  it('ignores a desk with no curveball (e.g. an unknown id)', () => {
    const other = 'not_a_challenge';
    const m = { ...newAssessment(), phase: 'attack' as const, frozen: { [other]: [{ type: 'ask_ai' as const, scope: other }] },
      launches: [{ desk: other, ids: [], reason: 'x' }] };
    expect(CURVEBALLS[other as Desk]).toBeUndefined();
    expect(submitCurveball(m as never, other as Desk, { prediction: 'struggles', reason: 'a reason' })).toBe(m);
  });

  it('saves each confidence level before reveal without changing marks or final scores', () => {
    const m = { ...newAssessment(), assigned: ['quiz'], frozen: { quiz: ideal('quiz') }, launches: [{ desk: 'quiz', ids: ['q_marks'] }] };
    const answer = { prediction: 'handles' as const, reason: 'I expect it to check the facts.' };
    const unrated = submitCurveball(m, 'quiz', answer);
    for (const confidence of CONFIDENCE_LEVELS) {
      const saved = submitCurveball(m, 'quiz', { ...answer, confidence });
      expect(saved.curveballs?.quiz?.confidence).toBe(confidence);
      expect(submitCurveball(saved, 'quiz', answer)).toBe(saved);
      expect(challengeMarkRequests(saved, {}, 'quiz')).toEqual(challengeMarkRequests(unrated, {}, 'quiz'));
      expect(finalScore(saved, {}, [])).toEqual(finalScore(unrated, {}, []));
    }
  });

  it('accepts one final prediction with a reason, only after the attack has launched', () => {
    const target = ideal('quiz');
    const base = { ...newAssessment(), phase: 'attack' as const, focus: 'quiz' as const, frozen: { quiz: target }, first: target };
    const answer = { prediction: 'struggles' as const, reason: '  The textbook check only looks for wrong facts, so an unfair mark gets through. ' };
    expect(submitCurveball(base, 'quiz', answer)).toBe(base);
    const launched = { ...base, launches: [{ desk: 'quiz' as const, ids: ['q_marks'], reason: 'x' }] };
    expect(submitCurveball(launched, 'quiz', { ...answer, reason: '  ' })).toBe(launched);
    const optional = { ...launched, settings: cleanSettings({ questions: { curveball: 'optional' } }) };
    expect(submitCurveball(optional, 'quiz', { ...answer, reason: '  ' }).curveballs?.quiz).toEqual({ creditsUsed: expect.any(Number), prediction: 'struggles', reason: '' });
    const done = submitCurveball(launched, 'quiz', answer);
    expect(done.curveballs?.quiz).toEqual({ creditsUsed: expect.any(Number), prediction: 'struggles', reason: 'The textbook check only looks for wrong facts, so an unfair mark gets through.' });
    expect(submitCurveball(done, 'quiz', { prediction: 'handles', reason: 'changed my mind' })).toBe(done);
  });
});
