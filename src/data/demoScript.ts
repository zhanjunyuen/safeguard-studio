import { usePresenter } from '../store/presenter';
import { newUid, useSession } from '../store/session';

export interface DemoStep {
  title: string;
  note: string;
  path: string;
  onEnter?: () => void;
  action?: { label: string; run: () => void };
}

export const DEMO_STEPS: DemoStep[] = [
  {
    title: 'The problem',
    path: '/',
    note: 'Tests and surveys measure what students say about AI. We measure what they do.',
  },
  {
    title: 'Build a helper',
    path: '/build/history',
    note: 'Sam’s helper is just “Ask AI”. Press Run tests and watch what it tells a Year 7.',
    onEnter: () => {
      const s = useSession.getState();
      s.reset('history');
      s.setScript('history', [{ uid: newUid('ask_ai'), type: 'ask_ai' }]);
    },
    action: { label: 'Run it for me', run: () => usePresenter.getState().command('run') },
  },
  {
    title: 'Fix it',
    path: '/build/history',
    note: 'Explain the failure, then drag “Check against a trusted source” under Ask AI and run again.',
    action: {
      label: 'Add the block for me',
      run: () => {
        const s = useSession.getState();
        const script = s.get('history').script;
        if (script.some((b) => b.type === 'check_source')) return;
        const i = script.findIndex((b) => b.type === 'ask_ai');
        const next = [...script];
        next.splice(i + 1, 0, { uid: newUid('check_source'), type: 'check_source' });
        s.setScript('history', next, { kind: 'add', text: 'Added “Check against a trusted source” (presenter)' });
      },
    },
  },
  {
    title: 'Break a helper',
    path: '/break/history',
    note: 'Roles reversed: read a locked helper and find its weak spots. Wasted attacks count.',
    action: { label: 'Fill the plan for me', run: () => usePresenter.getState().command('fill-attacks') },
  },
  {
    title: 'Student results',
    path: '/profile',
    note: 'Dashed line is the first run, before seeing any tests. Yellow is after fixing.',
  },
  {
    title: 'Teacher view',
    path: '/teacher',
    note: 'Every score is computed from what students built. Mistakes like “removes personal info too late” are flagged automatically.',
  },
];
