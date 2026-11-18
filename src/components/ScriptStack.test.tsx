import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { BLOCKS } from '../data/blocks';
import { CONDITIONS } from '../engine/conditions';
import { keyToBlock } from '../engine/scriptText';
import ScriptStack from './ScriptStack';

it('shows the saved condition and both branches of a frozen assessment helper', () => {
  const block = keyToBlock('ifelse:person:remove_pii:check_source', 'frozen');
  const html = renderToStaticMarkup(<ScriptStack script={[block]} highlights={{ 'frozen-then': 'acted' }} locked onRemove={() => {}} />);
  expect(html).toContain(CONDITIONS.person.label);
  expect(html).toContain(BLOCKS.remove_pii.label);
  expect(html).toContain(BLOCKS.check_source.label);
  expect(html).toContain('ELSE');
  expect(html).not.toContain('Remove this IF');
});
