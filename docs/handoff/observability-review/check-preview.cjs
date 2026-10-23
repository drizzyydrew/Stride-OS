const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = '/tmp/strideos-observability-preview';
const server = http.createServer((request, response) => {
  const name = path.basename(new URL(request.url, 'http://localhost').pathname) || 'index.html';
  const file = path.join(root, name);
  if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : 'text/html');
  response.end(fs.readFileSync(file));
});
(async () => {
  let browser; let checks = 0; const errors = []; const external = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) external.push(request.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const usage = page.getByRole('switch', { name: 'Share app usage', exact: true });
    const diagnostics = page.getByRole('switch', { name: 'Share error reports', exact: true });
    await usage.waitFor({ state: 'attached' }); assert.equal(await usage.isChecked(), false); assert.equal(await diagnostics.isChecked(), false); checks++;
    await page.getByText('Share app usage', { exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('input:checked').length === 1);
    assert.equal(await diagnostics.isChecked(), false); checks++;
    await page.getByText('Share error reports', { exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('input:checked').length === 2); checks++;
    await page.getByText('Share app usage', { exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('input:checked').length === 1); checks++;
    await page.getByText('Share error reports', { exact: true }).click();
    await page.getByRole('button', { name: 'Storage failure: off', exact: true }).click();
    await page.getByText('Share app usage', { exact: true }).click(); await page.getByRole('alert').waitFor(); assert.equal(await usage.isChecked(), false); checks++;
    await page.getByRole('button', { name: 'Storage failure: on', exact: true }).click();
    await page.getByRole('button', { name: 'Retry saving sharing off', exact: true }).click();
    await page.getByRole('alert').waitFor({ state: 'hidden' }); checks++;
    for (const theme of ['dark', 'light']) {
      if (theme === 'light') await page.getByRole('button', { name: 'Theme: dark', exact: true }).click();
      for (const width of [320, 393, 768]) {
        await page.setViewportSize({ width, height: 852 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
        await page.screenshot({ path: `${root}/${theme}-${width}.png`, fullPage: true });
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    const receipt = { checks, errors, external, synthetic: true, nativeVerified: false };
    fs.writeFileSync(`${root}/receipt.json`, JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
