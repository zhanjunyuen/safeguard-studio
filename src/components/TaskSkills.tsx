import type { Challenge } from '../types';
import { taskFocus } from '../data/testSkills';

export default function TaskSkills({ task }: { task: Challenge }) {
  const { primary, keywords } = taskFocus(task);
  return <span className="mt-1 block text-sm leading-snug">
    <strong>Skill focus · {primary}</strong>
    <span className="block text-ink-2">{keywords.join(' · ')}</span>
  </span>;
}
