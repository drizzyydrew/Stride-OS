const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const system = require('./system.json');

async function main() {
  const installedChrome = fs.existsSync('/Applications/Google Chrome.app');
  const browser = await chromium.launch({ headless: true, ...(installedChrome ? { channel: 'chrome' } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await page.goto(pathToFileURL(path.join(__dirname, 'daily-viewer.html')).href);
    await page.waitForSelector('#preview svg');
    for (const sample of system.boundarySamples) {
      await page.locator('#days').fill(String(sample.days));
      assert.equal(await page.locator('body').getAttribute('data-tier'), sample.token);
      assert.equal(await page.locator('body').getAttribute('data-days'), String(sample.days));
    }
    for (const state of ['unlocked', 'locked', 'transparent']) {
      await page.locator('#state').selectOption(state);
      assert((await page.locator('#preview svg').getAttribute('aria-label')).includes(state));
    }
    await page.locator('#state').selectOption('unlocked');
    await page.locator('#daily').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#milestones').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#daily').getAttribute('aria-selected'), 'true');
    await page.locator('#days').fill('151');
    await page.screenshot({ path: path.join(__dirname, 'daily-viewer-desktop.png'), fullPage: true });
    await page.locator('#milestones').click();
    for (const milestone of system.milestones) {
      await page.locator('#award').selectOption(milestone.id);
      assert.equal(await page.locator('body').getAttribute('data-days'), String(milestone.day));
    }
    await page.locator('#daily').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#days').fill('365');
    await page.screenshot({ path: path.join(__dirname, 'daily-viewer-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.equal(await page.locator('#preview svg').count(), 1);
    assert.equal(errors.length, 0, errors.join('\n'));
    fs.writeFileSync(path.join(__dirname, 'viewer-validation.json'), JSON.stringify({ boundaryTransitions: system.boundarySamples.length, milestones: system.milestones.length, states: 3, desktop: [1280, 900], mobile: [390, 844], pageErrors: errors, horizontalOverflow: false }, null, 2) + '\n');
    console.log('Daily viewer passed all tier boundaries, milestones, states and desktop/mobile checks.');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
