// Walks the demo flow end to end and saves screenshots to <outdir>/shots.
// Usage: npm run build && npx vite preview --port 4173 &  then  node scripts/e2e.cjs <outdir>
const { chromium } = require('playwright');
const SP = process.argv[2] || '.';
const BASE = process.argv[3] || 'http://localhost:4173';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(BASE + '/');
  await p.screenshot({ path: SP + '/shots/1-home.png' });
  await p.click('[data-testid=quick-demo]');
  await p.waitForSelector('[data-testid=run]');
  await p.screenshot({ path: SP + '/shots/2-builder.png' });
  await p.click('[data-testid=run]');
  await p.waitForTimeout(2600);
  await p.screenshot({ path: SP + '/shots/3-replay.png' });
  // skip to end
  await p.click('text=Skip');
  await p.waitForSelector('[data-testid=reflect-modal]');
  await p.screenshot({ path: SP + '/shots/4-reflect.png' });
  const o1 = await p.getAttribute('[data-testid=result-h_date]', 'data-outcome');
  console.log('run1 h_date', o1);
  await p.click('[data-testid=reflect-hallucination_unchecked]');
  await p.click('[data-testid=reflect-submit]');
  await p.click('[data-testid=reflect-continue]');
  // drag check_source below Ask AI
  const src = await p.locator('[data-testid=palette-check_source]').boundingBox();
  const tgt = await p.locator('[data-testid=stack-ask_ai]').boundingBox();
  await p.mouse.move(src.x + 40, src.y + 20);
  await p.mouse.down();
  await p.mouse.move(src.x + 60, src.y + 30, { steps: 5 });
  await p.mouse.move(tgt.x + 60, tgt.y + tgt.height - 4, { steps: 15 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  const order = await p.$$eval('[data-testid^=stack-]', els => els.map(e => e.dataset.testid));
  console.log('order', order);
  await p.screenshot({ path: SP + '/shots/5-added.png' });
  await p.click('[data-testid=run]');
  await p.click('text=Skip');
  await p.waitForTimeout(400);
  console.log('run2 h_date', await p.getAttribute('[data-testid=result-h_date]', 'data-outcome'));
  if (await p.$('[data-testid=reflect-modal]')) { await p.locator('[data-testid^=reflect-]').first().click(); await p.click('[data-testid=reflect-submit]'); await p.screenshot({ path: SP + '/shots/6-reflect2.png' }); await p.click('[data-testid=reflect-continue]'); }
  await p.click('[data-testid=result-h_date]');
  await p.screenshot({ path: SP + '/shots/6-results.png' });
  await p.goto(BASE + '/#/profile');
  await p.waitForTimeout(800);
  await p.screenshot({ path: SP + '/shots/7-profile.png', fullPage: true });
  await p.goto(BASE + '/#/teacher');
  await p.waitForTimeout(800);
  await p.click('[data-testid=row-live]');
  await p.waitForTimeout(600);
  await p.screenshot({ path: SP + '/shots/8-teacher.png', fullPage: true });
  console.log('errors', errs);
  await b.close();
})();
