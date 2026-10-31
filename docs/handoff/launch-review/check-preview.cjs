const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = '/tmp/strideos-launch-preview';
const server = http.createServer((req, res) => {
  const name = path.basename(new URL(req.url, 'http://localhost').pathname) || 'index.html'; const file = path.join(root, name);
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : 'text/html'); res.end(fs.readFileSync(file));
});
(async () => {
  let browser; let page; let checks = 0; const errors = []; const external = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => { errors.push(e.message); console.error('Preview page error:', e.message); });
    page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:')) external.push(req.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const toggle = page.getByRole('switch', { name: 'Allow sharing with Anthropic for AI Coach', exact: true });
    await toggle.waitFor({ state: 'attached' }); assert.equal(await toggle.isChecked(), false); checks++;
    await page.getByText('Allow sharing with Anthropic for AI Coach', { exact: true }).click(); await page.waitForFunction(() => document.querySelector('input:checked')); checks++;
    await page.getByText('Allow sharing with Anthropic for AI Coach', { exact: true }).click(); await page.waitForFunction(() => !document.querySelector('input:checked')); checks++;
    await page.getByRole('button', { name: 'Storage failure: off', exact: true }).click();
    await page.getByText('Allow sharing with Anthropic for AI Coach', { exact: true }).click(); await page.getByRole('alert').waitFor(); assert.equal(await toggle.isChecked(), false); checks++;
    await page.getByRole('button', { name: 'Storage failure: on', exact: true }).click();
    for (const theme of ['dark', 'light']) {
      if (theme === 'light') await page.getByRole('button', { name: 'Theme: dark', exact: true }).click();
      for (const width of [320, 393, 768]) {
        await page.setViewportSize({ width, height: 852 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
        await page.screenshot({ path: `${root}/settings-${theme}-${width}.png`, fullPage: true });
        await page.getByRole('button', { name: 'Replay Today', exact: true }).click();
        await page.getByRole('button', { name: 'Close walkthrough', exact: true }).first().waitFor();
        const bounds = await page.getByText('1 of 4', { exact: true }).count();
        assert.ok(await page.getByText(/1 of \d/, { exact: true }).count() > 0 || bounds > 0); checks++;
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
        await page.getByTestId('feature-tour-bubble').waitFor();
        const box = await page.getByTestId('feature-tour-bubble').boundingBox();
        assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= 853); checks++;
        await page.screenshot({ path: `${root}/tour-${theme}-${width}.png` });
        await page.getByRole('button', { name: 'Close walkthrough', exact: true }).first().click();
        await page.locator('[aria-modal="true"]').waitFor({ state: 'detached' });
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(JSON.stringify({ checks, errors, external, synthetic: true, nativeVerified: false }));
  } catch (e) {
    if (page) { await page.screenshot({ path: `${root}/failure.png` }); console.error((await page.locator('body').innerText()).slice(0, 2000)); }
    throw e;
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
