// Run against a local build. Complete a Level 2 assessment, revise a service and compare its export.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto((process.argv[2] || 'http://localhost:4173') + '/#/mission');
    const nav = page.getByRole('navigation', { name: 'Assessment progress and tasks' });
    const toggle = nav.locator('button[aria-expanded]');
    await nav.getByRole('button', { name: /Assessment setup.*Expand/ }).click();
    assert.equal(await nav.getByRole('list', { name: 'Switch service' }).count(), 0);
    await toggle.press('Escape');
    await page.getByTestId('choose-level-2').check();
    await page.getByTestId('start-assessment').click();
    const intro = page.getByRole('dialog', { name: 'Assessment introduction' });
    const video = intro.locator('video');
    await page.waitForFunction(() => document.querySelector('dialog.assessment-intro video')?.currentTime > 1);
    assert.equal(await page.getByTestId('assessment-brief').count(), 1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('school-community-assessment-v1')).state.mission.elapsed), 0);
    await video.evaluate(player => { player.currentTime = player.duration - 0.3; });
    await intro.waitFor({ state: 'hidden' });
    const ids = await page.locator('[data-testid^="assess-"]').evaluateAll(items => items.map(item => item.dataset.testid));
    assert.equal(ids.length, 6);
    const tracker = nav.locator('progress[aria-label="Deployment budget"]');
    const button = name => page.getByRole('button', { name, exact: true });
    async function run() {
      await page.getByTestId('run').click();
      await button('Skip to results').click();
      if (await page.getByTestId('reflect-modal').isVisible()) {
        await page.getByTestId('reflect-modal').locator('fieldset button').first().click();
        await page.getByTestId('reflect-submit').click();
        await page.getByTestId('reflect-continue').click();
      }
      const quality = page.getByTestId('block-quality');
      await quality.waitFor();
      const savedScore = await page.evaluate(() => {
        const mission = JSON.parse(localStorage.getItem('school-community-assessment-v1')).state.mission;
        const work = JSON.parse(localStorage.getItem('school-community-challenge-work-v1')).state.progress;
        return work[mission.focus].attempts.at(-1).blockQuality.score;
      });
      assert.equal(await quality.getByText(savedScore + '/100', { exact: true }).count(), 1);
    }

    // Start from previously saved, passing builds to test eligibility, freezing and revision.
    const { createServer } = await import('vite');
    const loader = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    let scripts;
    try {
      const { idealScript } = await loader.ssrLoadModule('/src/engine/targets.ts');
      scripts = Object.fromEntries(ids.map(key => { const id = key.slice(7); return [id, idealScript(id)]; }));
    } finally { await loader.close(); }
    await page.evaluate(scripts => {
      const key = 'school-community-challenge-work-v1';
      const saved = JSON.parse(localStorage.getItem(key));
      for (const [id, script] of Object.entries(scripts)) saved.state.progress[id] = {
        script, attempts: [], reflections: [], events: [], pendingReflection: null, seen: [],
      };
      localStorage.setItem(key, JSON.stringify(saved));
    }, scripts);
    await page.reload();
    for (const id of ids) {
      const priorCost = await tracker.getAttribute('value');
      await page.getByTestId(id).click();
      await page.getByTestId('palette-ifelse').click();
      assert.equal(await button('Continue to Attack with this build').isEnabled(), false);
      await run();
      await button('Continue to Attack with this build').click();
      assert.equal(await page.locator('[data-testid^="slot:"]').count(), 2);
      await page.getByLabel('Attacks', { exact: true }).locator('[data-testid^="attack-"]').first().click();
      await page.getByTestId('attack-reason').fill('I expect this case to reach the wrong branch.');
      await page.getByTestId('launch').click();
      await button('Skip to results').click();
      await page.getByTestId('curveball').waitFor();
      await page.getByTestId('cb-struggles').check();
      await page.getByRole('radio', { name: 'Very sure', exact: true }).check();
      await page.getByTestId('cb-reason').fill('A person should check this case before sharing the answer.');
      await page.getByTestId('cb-submit').click();
      assert.equal(await tracker.getAttribute('value'), priorCost);
      await button('Finish challenge').click();
      assert.ok(Number(await tracker.getAttribute('value')) > Number(priorCost));
    }

    await button('Continue to release decision').click();
    await toggle.click();
    const prior = await tracker.getAttribute('aria-valuetext');
    await page.reload();
    await toggle.click();
    assert.equal(await tracker.getAttribute('aria-valuetext'), prior);
    await nav.getByRole('list', { name: 'Switch service' }).getByRole('button').first().click();
    await button('Revise this service').click();
    await page.getByRole('textbox').fill('The branch adds workload without catching this case.');
    await page.getByRole('button', { name: 'Remove this IF block' }).click();
    await run();
    await button('Finish challenge').click();
    await button('Continue to release decision').click();
    await page.getByRole('combobox', { name: /Your decision/ }).selectOption('Edit before publishing');
    await page.getByRole('textbox').fill('Publish the time and check the gate with the site manager.');
    await button('Submit assessment').click();

    await nav.getByRole('button', { name: /Assessment evidence.*Expand/ }).click();
    const finalCosts = nav.getByRole('list', { name: 'Service costs' });
    await finalCosts.waitFor();
    assert.equal(await finalCosts.getByRole('listitem').count(), 6);
    assert.equal(await finalCosts.getByRole('button').count(), 0);
    await toggle.click();
    const download = page.waitForEvent('download');
    await button('Download marking evidence').click();
    const packet = JSON.parse(await fs.readFile(await (await download).path(), 'utf8'));
    assert.equal(packet.level, 2);
    assert.equal(new Set(packet.completionOrder).size, 6);
    assert.ok(packet.workloadCredits > 0);
    const revised = packet.challenges.find(c => 'assess-' + c.id === ids[0]);
    assert.equal(revised.curveball.confidence, 'Very sure');
    assert.equal(revised.attempts.length, 2);
    assert.ok(revised.attack.rules.some(rule => rule.type.startsWith('ifelse:')));
    assert.equal(packet.creditModel, 'deployment');
    assert.ok(revised.attempts.at(-1).script.every(key => !key.startsWith('ifelse:')));
    assert.match(await tracker.getAttribute('aria-valuetext'), new RegExp('^' + packet.workloadCredits + ' of ' + packet.budget + ' credits'));
    assert.equal(packet.workloadCredits, Math.round(packet.challenges.reduce((sum, c) => sum + c.creditsPerRequest, 0) * 10) / 10);
    assert.deepEqual(errors, []);
    const missionUrl = page.url();
    await page.getByRole('link', { name: 'My results', exact: true }).first().click();
    await page.getByRole('region', { name: 'Revisit a curveball prediction' }).getByText(/Very sure/).waitFor();
    await page.getByLabel('Use saved results only').check();
    let aiCalls = 0;
    await page.route('**/functions/v1/literacy-ai', route => { aiCalls++; return route.abort(); });
    const task = page.getByLabel('Task to discuss');
    const matching = await task.locator('option').filter({ hasText: revised.title }).textContent();
    await task.selectOption({ label: matching });
    await button('Compare my builds').click();
    const comparison = page.getByRole('region', { name: 'Build comparison' });
    await comparison.getByRole('rowheader', { name: 'Max credits per live request' }).waitFor();
    await comparison.getByText('Compare block order').click();
    assert.equal(await comparison.locator('ol').count(), 2);
    await page.getByText('Saved results · On this device').waitFor();
    assert.equal(aiCalls, 0);
    await page.unroute('**/functions/v1/literacy-ai');
    await page.goto(missionUrl);
    await verifyRestart(page);
    await verifyMobile(browser, page.url());
    console.log('Six services, frozen branch replay, revision, reload, release and shared budget export passed.');
  } finally {
    await browser.close();
  }
}

async function verifyRestart(page) {
  const missionKey = 'school-community-assessment-v1';
  const workKey = 'school-community-challenge-work-v1';
  const restart = page.getByRole('button', { name: 'Restart assessment', exact: true });
  const prior = await page.evaluate(k => localStorage.getItem(k), workKey);
  await restart.click();
  const dialog = page.getByRole('dialog', { name: 'Restart this assessment?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await page.evaluate(k => localStorage.getItem(k), workKey), prior);
  await restart.click();
  await dialog.getByRole('button', { name: 'Restart now' }).click();
  await page.reload();
  await page.getByTestId('start-assessment').waitFor();
  const mission = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).state.mission, missionKey);
  assert.equal(mission.phase, 'brief');
  assert.equal(mission.elapsed, 0);
  assert.deepEqual(mission.completed, []);
  assert.deepEqual(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).state.progress, workKey), {});
}

async function verifyMobile(browser, url) {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  await page.goto(url.split('#')[0] + '#/build/history');
  await page.getByTestId('palette-check_source').tap();
  const practiceSave = await page.evaluate(() => localStorage.getItem('safeguard-studio-v1'));
  assert.ok(practiceSave?.includes('check_source'));
  await page.goto(url);
  await page.getByTestId('start-assessment').tap();
  await page.getByRole('button', { name: 'Skip video' }).tap();
  // Use the original six-service assignment so Class Group-Chat Helper has eight requests.
  await page.evaluate(() => {
    const key = 'school-community-assessment-v1';
    const saved = JSON.parse(localStorage.getItem(key));
    delete saved.state.mission.assigned;
    // Resume an in-progress attempt saved before compute pricing.
    saved.version = 2;
    saved.state.mission.workloadModel = 'case-average';
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  const nav = page.getByRole('navigation', { name: 'Assessment progress and tasks' });
  const toggle = nav.locator('button[aria-expanded]');
  const services = nav.getByRole('list', { name: 'Switch service' }).getByRole('button');
  assert.match(await toggle.innerText(), /0 \/ [\d.]+ credits deployed/);
  await page.getByTestId('assess-chat').tap();
  await page.getByTestId('palette-hide_location').tap();
  const sections = page.getByRole('navigation', { name: 'Workbench sections' });
  await sections.getByRole('button', { name: 'Your helper' }).tap();
  await page.getByTestId('stack-hide_location').waitFor();
  assert.equal(await page.getByTestId('palette-hide_location').isVisible(), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), 667);
  assert.match(await toggle.innerText(), /0 \/ [\d.]+ credits deployed/);
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('run').tap();
    await page.getByRole('button', { name: 'Skip to results' }).tap();
    await page.getByTestId('reflect-modal').locator('fieldset button').first().tap();
    await page.getByTestId('reflect-submit').tap();
    await page.getByTestId('reflect-continue').tap();
    assert.equal(Number((await toggle.innerText()).match(/([\d.]+) \/ /)[1]), 0);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
  const bounds = await nav.boundingBox();
  assert.ok(bounds.height >= 84 && bounds.height <= 100, 'Collapsed tracker has room for the task, total and workload bar');
  await nav.getByRole('button', { name: /Expand/ }).waitFor();
  assert.ok(Math.abs(bounds.y + bounds.height - 667) <= 1);
  await toggle.tap();
  await services.first().waitFor();
  assert.equal(await services.count(), 6);
  assert.match(await services.filter({ hasText: 'Class Group-Chat Helper' }).innerText(), /Awaiting deployment · 0 credits/);
  await services.last().tap();
  await nav.locator('button[aria-expanded="false"]').waitFor();
  assert.match(await toggle.innerText(), /GCSE Options Adviser/);
  await toggle.tap();
  await services.filter({ hasText: 'Class Group-Chat Helper' }).tap();
  await page.reload();
  assert.match(await toggle.innerText(), /Class Group-Chat Helper/);
  assert.match(await toggle.innerText(), /0 \/ [\d.]+ credits deployed/);
  await verifyRestart(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('safeguard-studio-v1')), practiceSave);
  console.log('Mobile task switching, fixed tracker, migration and free test runs passed.');
}

test().catch(error => { console.error(error); process.exitCode = 1; });
