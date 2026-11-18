import { describe, expect, it } from 'vitest';
import { CURVEBALLS } from '../data/curveballs';
import { DESKS } from '../data/mission';
import { getChallenge } from '../data/challenges';
import { curveballHandled, runCurveball, submitCurveball } from './curveball';
import { newAssessment, type Desk, type Rule } from './mission';
import type { BlockType } from '../types';

const rules = (desk: Desk, types: BlockType[]): Rule[] => types.map(type => ({ type, scope: desk }));
const ideal = (desk: Desk) => rules(desk, getChallenge(desk)!.ideal);
/** Every safeguard in the palette, without the refuse-everything traps: "just throw blocks in". */
const stuffed = (desk: Desk) => {
  const palette = getChallenge(desk)!.palette.filter(b => !['ask_grownup', 'teacher_approves_all', 'block_people', 'refuse_food', 'refuse_tests'].includes(b));
  const before = palette.filter(b => ['before', 'either', 'anywhere'].includes(getPosition(b)));
  const after = palette.filter(b => getPosition(b) === 'after');
  return rules(desk, [...before, 'ask_ai', ...after]);
};
import { BLOCKS } from '../data/blocks';
const getPosition = (b: BlockType) => BLOCKS[b].position;

describe('curveballs', () => {
  it('has one unseen case per assessed challenge, none of them in the standard tests', () => {
    for (const d of DESKS) {
      const cb = CURVEBALLS[d.id];
      expect(getChallenge(d.id)!.tests.some(t => t.id === cb.test.id)).toBe(false);
    }
  });

  it('beats the reference build on five of six challenges, and adding every block does not help', () => {
    const idealOutcomes = Object.fromEntries(DESKS.map(d => [d.id, runCurveball(ideal(d.id), d.id).outcome]));
    expect(idealOutcomes).toEqual({ history: 'fail', party: 'fail', news: 'fail', quiz: 'fail', chat: 'fail', options: 'pass' });
    const stuffedHandled = DESKS.filter(d => curveballHandled(runCurveball(stuffed(d.id), d.id))).map(d => d.id);
    expect(stuffedHandled).toEqual(['options']);
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
    const flagged = runCurveball(rules('chat', ['ask_ai', 'flag_teacher']), 'chat');
    expect(flagged.outcome).toBe('partial');
    expect(curveballHandled(flagged)).toBe(false);
  });

  it('accepts one final prediction with a reason, only after the attack has launched', () => {
    const target = ideal('quiz');
    const base = { ...newAssessment(), phase: 'attack' as const, focus: 'quiz' as const, frozen: { quiz: target }, first: target };
    const answer = { prediction: 'struggles' as const, reason: '  The textbook check only looks for wrong facts, so an unfair mark gets through. ' };
    expect(submitCurveball(base, 'quiz', answer)).toBe(base);
    const launched = { ...base, launches: [{ desk: 'quiz' as const, ids: ['q_marks'], reason: 'x' }] };
    expect(submitCurveball(launched, 'quiz', { ...answer, reason: '  ' })).toBe(launched);
    const done = submitCurveball(launched, 'quiz', answer);
    expect(done.curveballs?.quiz).toEqual({ prediction: 'struggles', reason: 'The textbook check only looks for wrong facts, so an unfair mark gets through.' });
    expect(submitCurveball(done, 'quiz', { prediction: 'handles', reason: 'changed my mind' })).toBe(done);
  });
});
