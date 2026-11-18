// Run against a local dev or preview server. Speech events are deterministic.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.SpeechRecognition = class {
        start() { window.testMic = this; }
        stop() { this.onend(); }
        abort() { this.aborted = true; this.onend(); }
        say(text) { this.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] }); }
      };
    });
    await page.goto((process.argv[2] || 'http://localhost:4173') + '/#/mission');
    await page.getByTestId('start-assessment').click();
    const tasks = page.locator('[data-testid^="assess-"]');
    await tasks.first().click();
    const note = page.getByRole('textbox');
    await note.fill('First');
    await page.getByRole('button', { name: 'Speak your reasoning' }).click();
    await page.evaluate(() => { window.testMic.say('check consent.'); window.testMic.say('check consent.'); });
    assert.equal(await note.inputValue(), 'First check consent.');
    await page.getByRole('button', { name: 'Stop dictation' }).click();
    await note.fill('Edited prediction.');
    await page.getByRole('button', { name: 'Speak your reasoning' }).click();
    await page.getByRole('button', { name: 'Assessment checklist', exact: true }).click();
    assert.equal(await page.evaluate(() => window.testMic.aborted), true);
    await page.evaluate(() => window.testMic.say('late result'));
    await tasks.first().click();
    assert.equal(await note.inputValue(), 'Edited prediction.');
    await page.getByRole('button', { name: 'Speak your reasoning' }).click();
    await page.evaluate(() => { window.testMic.onerror({ error: 'not-allowed' }); window.testMic.onend(); });
    await page.getByText('Microphone access was denied.', { exact: false }).waitFor();
    assert.equal(await note.inputValue(), 'Edited prediction.');
    console.log('Dictation, editing, navigation and microphone denial passed.');
  } finally {
    await browser.close();
  }
}

test().catch(error => { console.error(error); process.exitCode = 1; });
