import { describe, expect, it } from 'vitest';
import { assessmentStep } from '../components/AssessmentSteps';
import { assignmentFor, cleanSettings, DEFAULT_SETTINGS, isRequired, optionalSkills } from './assessmentSettings';
import { finalScore } from './finalScore';
import type { Mark } from './marking';
import { newAssessment, submitAttack } from './mission';
import { getChallenge } from '../data/challenges';

describe('teacher assessment settings', () => {
  it('cleans unknown values back to the defaults', () => {
    expect(cleanSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = cleanSettings({ challenges: ['party', 'party', 'nope', 'history'], questions: { attack: 'optional', release: 'maybe' }, level: 3, minutes: 25 });
    expect(s.challenges).toEqual(['party', 'history']);
    expect(s.questions.attack).toBe('optional');
    expect(s.questions.release).toBe('required');
    expect(s.level).toBeNull();
    expect(s.minutes).toBe(25);
    expect(cleanSettings({ challenges: [] }).challenges).toBeNull();
  });

  it("uses the teacher's challenges, else one per theme", () => {
    expect(assignmentFor({ ...DEFAULT_SETTINGS, challenges: ['party', 'news'] })).toEqual(['party', 'news']);
    expect(assignmentFor(DEFAULT_SETTINGS, () => 0)).toHaveLength(6);
  });

  it('lets an optional attack prediction be left blank', () => {
    const caseId = getChallenge('party')!.tests[0].id;
    const base = { ...newAssessment(), form: 4 as const, assigned: ['party' as const], phase: 'attack' as const, focus: 'party' as const, first: [], attackPlans: { party: [caseId] } };
    expect(submitAttack(base).launches ?? []).toHaveLength(0);
    const lenient = { ...base, settings: { ...DEFAULT_SETTINGS, questions: { ...DEFAULT_SETTINGS.questions, attack: 'optional' as const } } };
    expect(submitAttack(lenient).launches).toHaveLength(1);
    expect(isRequired(base, 'attack')).toBe(true);
  });

  it('a skipped optional question does not lower the answers part of the score', () => {
    const m = { ...newAssessment(), assigned: ['party' as const] };
    const mark = (criterion: Mark['criterion']): Mark => ({ criterion, level: 2, rubricVersion: 'x', marker: 'm', concepts: [], feedback: '', nextStep: '', reviewFlag: false });
    const marks = [mark('testing'), mark('anticipation'), mark('judgement')];
    expect(finalScore(m, {}, marks).parts.answers).toBe(37.5);
    const lenient = { ...m, settings: { ...DEFAULT_SETTINGS, questions: { ...DEFAULT_SETTINGS.questions, revision: 'optional' as const } } };
    expect(optionalSkills(lenient)).toEqual(['revision']);
    expect(finalScore(lenient, {}, marks).parts.answers).toBe(50);
  });

  it('guides the pupil to the next thing to do', () => {
    const m = newAssessment();
    expect(assessmentStep({ ...m, classCode: 'DEMO8B' }, true).step).toBe('join');
    expect(assessmentStep(m, false).step).toBe('brief');
    expect(assessmentStep({ ...m, phase: 'menu', assigned: ['party'], completed: ['party'] }, false).next).toMatch(/release decision/);
    expect(assessmentStep({ ...m, phase: 'complete' }, false).step).toBe('results');
  });
});
