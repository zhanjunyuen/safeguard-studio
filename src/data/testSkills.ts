import type { Challenge, HallucKind, HiddenTest, RiskKind } from '../types';
import { COMPETENCY_META } from './blocks';
import { THEMES } from './themes';

const factSkills: Record<HallucKind, string> = {
  fact: 'Fact-checking', label: 'Reading product labels', quote: 'Checking quotations',
  stat: 'Checking statistics', rumour: 'Verifying rumours', rule: 'Checking official rules',
  citation: 'Verifying citations', image: 'Verifying images', review: 'Checking independent reviews',
  chronology: 'Checking dates', booking: 'Checking availability', kit_stock: 'Checking inventory', checkout: 'Checking totals',
};
const riskSkills: Record<RiskKind, string> = {
  needs_human: 'Knowing when to involve a person', dependency: 'Recognising AI dependency',
  injection: 'Recognising misleading instructions', scam: 'Spotting scams', sponsored: 'Spotting paid promotion',
  data_grab: 'Data minimisation', uncredited: 'Crediting AI work', unfair_judgement: 'Recognising unfair judgements',
};

export function testSkills(test: HiddenTest): string[] {
  const f = test.flags;
  const skills = [
    f.hallucination && factSkills[f.hallucinationKind ?? 'fact'],
    f.pii && 'Protecting personal details', f.essayRequest && 'Coaching independent work',
    f.oneSided && 'Recognising bias', f.risk && riskSkills[f.risk],
  ].filter((skill): skill is string => !!skill);
  return skills.length ? skills : [test.category === 'usefulness' ? 'Avoiding unnecessary refusals' : COMPETENCY_META[test.category].label];
}

export function taskFocus(task: Challenge) {
  const theme = THEMES.find(t => t.id === task.themeId)!;
  const keywords = new Set(task.tests.filter(t => t.category !== 'usefulness').flatMap(testSkills));
  return { primary: COMPETENCY_META[theme.competency].label, keywords: [...keywords] };
}
