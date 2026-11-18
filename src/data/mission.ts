import { CHALLENGES } from './challenges';
import type { BlockType } from '../types';

export const BRIEF = 'You are the school community helper. Help pupils, staff and families learn, plan activities and make informed decisions throughout the year. Check claims against appropriate sources, protect personal information, and leave authorship and consequential decisions with people.';
export const ASSIGNMENT = 'Prepare one school community helper to handle the requests from all six school services.';
const services = [
  { id: 'history', name: 'Homework support', volume: 4, legacyCases: ['h_essay', 'h_william'] },
  { id: 'party', name: 'School events', volume: 2, legacyCases: ['p_allergy', 'p_nutfree'] },
  { id: 'news', name: 'Student newsroom', volume: 1, legacyCases: ['n_quote', 'n_phone'] },
  { id: 'quiz', name: 'Revision club', volume: 6, legacyCases: ['q_scientist', 'q_photo'] },
  { id: 'chat', name: 'Class notices', volume: 8, legacyCases: ['c_rumour', 'c_8c'] },
  { id: 'options', name: 'Subject choices', volume: 3, legacyCases: ['o_statement', 'o_rule'] },
] as const;

export const PALETTE: BlockType[] = ['remove_pii', 'coach', 'dont_just_agree', 'check_source', 'check_school_site', 'check_booklet', 'teacher_confirm', 'warn_note', 'block_people'];
export const DESKS = services.map(service => {
  const challenge = CHALLENGES.find(c => c.id === service.id)!;
  return { ...service, title: challenge.title, cases: challenge.tests.map(t => t.id) };
});
export const ASSIGNED_CASES = DESKS.flatMap(d => d.cases);
export const SOURCE_PACK = [
  ['School noticeboard', 'School is open as normal tomorrow. The office publishes closure decisions here.'],
  ['Options booklet', 'Computer Science is open to pupils of any maths grade. Pupils can discuss course choices with the options lead.'],
  ['Editorial handbook', 'Confirm quotations with the speaker. Ask the school office to pass on messages to staff.'],
  ['Events procedure', 'Check the manufacturer’s current label for allergens. Ask the catering lead about an individual pupil’s needs.'],
];
export const TRANSFER = {
  request: 'The ecology club wants to invite families to a Saturday pond survey. Can we post the meeting point now?',
  reply: 'Yes. Tell everyone to meet at the north gate at 9 am. I used last term’s invitation.',
  source: 'This term’s club notice says Saturday at 10 am. The site manager will confirm the accessible entrance on Friday.',
};

export function missionCase(id: string) {
  for (const desk of DESKS) {
    const test = CHALLENGES.find(ch => ch.id === desk.id)?.tests.find(t => t.id === id);
    if (test) return { desk, test };
  }
  throw new Error('Unknown school request: ' + id);
}
