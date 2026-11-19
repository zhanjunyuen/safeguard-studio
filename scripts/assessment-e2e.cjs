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
    const ids = await page.locator('[data-testid^="assess-"]').evaluateAll(items => items.map(item => item.dataset.testid));
    assert.equal(ids.length, 6);
    const tracker = page.getByRole('progressbar', { name: 'Shared workload budget' });
    const button = name => page.getByRole('button', { name, exact: true });
    async function run() {
      await page.getByTestId('run').click();
      await button('Skip to results').click();
      await page.getByTestId('reflect-modal').locator('fieldset button').first().click();
      await page.getByTestId('reflect-submit').click();
      await page.getByTestId('reflect-continue').click();
    }

    for (const id of ids) {
      await page.getByTestId(id).click();
      await page.getByTestId('palette-ifelse').click();
      const safeguards = page.getByLabel('Safeguard blocks').locator('[data-testid^="palette-"]').filter({ hasNotText: 'IF …' });
      await safeguards.first().click();
      await safeguards.nth(1).click();
      await run();
      await button('Continue to Attack with this build').click();
      assert.equal(await page.locator('[data-testid^="slot:"]').count(), 2);
      await page.getByLabel('Attacks', { exact: true }).locator('[data-testid^="attack-"]').first().click();
      await page.getByTestId('attack-reason').fill('I expect this case to reach the wrong branch.');
      await page.getByTestId('launch').click();
      await button('Skip to results').click();
      if (await page.getByTestId('curveball').isVisible()) {
        await page.getByTestId('cb-struggles').check();
        await page.getByTestId('cb-reason').fill('A person should check this case before sharing the answer.');
        await page.getByTestId('cb-submit').click();
      }
      await button('Finish challenge').click();
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
    await page.getByLabel('Your decision').selectOption('Edit before publishing');
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
    assert.equal(revised.attempts.length, 2);
    assert.ok(revised.attack.rules.some(rule => rule.type.startsWith('ifelse:')));
    assert.equal(revised.workloadCredits, 0);
    assert.match(await tracker.getAttribute('aria-valuetext'), new RegExp('^' + packet.workloadCredits + ' of ' + packet.budget + ' credits'));
    assert.equal(packet.workloadCredits, packet.challenges.reduce((sum, c) => sum + c.creditsPerRequest * c.volume, 0));
    assert.deepEqual(errors, []);
    await verifyMobile(browser, page.url());
    console.log('Six services, frozen branch replay, revision, reload, release and shared budget export passed.');
  } finally {
    await browser.close();
  }
}

async function verifyMobile(browser, url) {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  await page.goto(url);
  await page.getByTestId('start-assessment').tap();
  // Use the original six-service assignment so Class Group-Chat Helper has eight requests.
  await page.evaluate(() => {
    const key = 'school-community-assessment-v1';
    const saved = JSON.parse(localStorage.getItem(key));
    delete saved.state.mission.assigned;
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  const nav = page.getByRole('navigation', { name: 'Assessment progress and tasks' });
  const toggle = nav.locator('button[aria-expanded]');
  const services = nav.getByRole('list', { name: 'Switch service' }).getByRole('button');
  await page.getByTestId('assess-chat').tap();
  await page.getByTestId('palette-hide_location').tap();
  assert.match(await toggle.innerText(), /24 \/ \d+ credits/);
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('run').tap();
    await page.getByRole('button', { name: 'Skip to results' }).tap();
    await page.getByTestId('reflect-modal').locator('fieldset button').first().tap();
    await page.getByTestId('reflect-submit').tap();
    await page.getByTestId('reflect-continue').tap();
    assert.match(await toggle.innerText(), /24 \/ \d+ credits/);
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
  assert.match(await services.filter({ hasText: 'Class Group-Chat Helper' }).innerText(), /3 credits\/request × 8 requests = 24 credits/);
  await services.last().tap();
  await nav.locator('button[aria-expanded="false"]').waitFor();
  assert.match(await toggle.innerText(), /GCSE Options Adviser/);
  await toggle.tap();
  await services.filter({ hasText: 'Class Group-Chat Helper' }).tap();
  await page.reload();
  assert.match(await toggle.innerText(), /Class Group-Chat Helper/);
  assert.match(await toggle.innerText(), /24 \/ \d+ credits/);
  console.log('Mobile task switching, fixed tracker, 3 × 8 projection and two free runs passed.');
}

test().catch(error => { console.error(error); process.exitCode = 1; });
