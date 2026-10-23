const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = '/tmp/strideos-power-preview';
const server = http.createServer((request, response) => {
  const filename = path.basename(new URL(request.url, 'http://localhost').pathname) || 'index.html';
  const file = path.join(root, filename);
  if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.ttf') ? 'font/ttf' : 'text/html');
  response.end(fs.readFileSync(file));
});

(async () => {
  let browser;
  const errors = [];
  let checks = 0;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.getByText('Estimated uphill work', { exact: true }).waitFor();
    const content = () => page.locator('main').innerText();
    assert(!(await content()).includes('Average climbing-component power')); checks++;
    await page.getByRole('button', { name: 'About hiking work', exact: true }).click();
    await page.getByText('Why care?', { exact: true }).waitFor(); checks++;
    await page.getByText('Everyday equivalent', { exact: true }).click();
    await page.getByText(/Energy equivalent of running/).waitFor();
    const equivalent = await page.getByText(/Energy equivalent of running/).innerText();
    assert((await content()).includes('No electricity was generated')); checks++;
    await page.getByRole('button', { name: 'Units: imperial', exact: true }).click();
    await page.getByRole('button', { name: 'Theme: dark', exact: true }).click();
    assert.equal(await page.getByText(/Energy equivalent of running/).innerText(), equivalent); checks++;
    await page.getByText('Calculation details', { exact: true }).click();
    await page.getByText(/Average climbing-component power:/).waitFor(); checks++;
    for (const width of [320, 393, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => ({ body: document.documentElement.scrollWidth > innerWidth,
        elements: [...document.querySelectorAll('main *')].filter(element => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && (box.left < -1 || box.right > innerWidth + 1);
        }).map(element => element.textContent?.slice(0, 60)) }));
      assert.equal(overflow.body, false, JSON.stringify({ width, overflow }));
      assert.deepEqual(overflow.elements, [], JSON.stringify({ width, overflow })); checks++;
      await page.screenshot({ path: `${root}/expanded-light-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.getByRole('button', { name: 'Theme: light', exact: true }).click();
    await page.screenshot({ path: `${root}/expanded-dark-393.png`, fullPage: true });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(() => { document.body.style.zoom = '1.35'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); checks++;
    await page.screenshot({ path: `${root}/expanded-large-320.png`, fullPage: true });
    await page.evaluate(() => { document.body.style.zoom = ''; });
    await page.setViewportSize({ width: 393, height: 852 });
    await page.getByText('Everyday equivalent', { exact: true }).click();
    await page.getByText('Calculation details', { exact: true }).click();
    await page.getByRole('button', { name: 'About hiking work', exact: true }).click();
    await page.screenshot({ path: `${root}/collapsed-dark-393.png`, fullPage: true });
    for (const id of ['metabolic', 'device', 'unavailable', 'entered-0', 'entered-26', 'entered-2001']) {
      await page.getByRole('combobox', { name: 'Synthetic activity' }).selectOption(id);
      const title = id === 'metabolic' || id === 'unavailable' ? 'running work' : id === 'device' ? 'cycling work' : 'indoor cycling work';
      await page.getByRole('button', { name: `About ${title}`, exact: true }).waitFor();
      assert.equal(await page.locator('details[open]').count(), 0); checks++;
      if (id === 'unavailable') {
        assert((await content()).includes('Power estimate unavailable'));
        assert(!(await content()).includes('Everyday equivalent')); checks++;
      } else if (id === 'entered-0') {
        assert((await content()).includes('0 W')); assert(!(await content()).includes('Everyday equivalent')); checks++;
      } else {
        await page.getByText('Everyday equivalent', { exact: true }).click();
        if (id === 'entered-2001') await page.getByText(/No matching reference is available/).waitFor();
        else await page.getByText(/times the reference power draw/).waitFor();
        assert(!(await content()).includes('Energy equivalent of running')); checks++;
      }
      if (id === 'metabolic') { assert((await content()).includes('70% usable GPS coverage')); checks++; }
      await page.screenshot({ path: `${root}/${id}-393.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(`${url}/?gallery`);
    for (const title of ['Hiking Work', 'Running Work', 'Cycling Work']) await page.getByText(title, { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${root}/activity-work-gallery.png`, fullPage: true }); checks++;
    await page.getByText('Everyday equivalent', { exact: true }).first().click();
    await page.getByText(/Energy equivalent of running/).waitFor();
    await page.screenshot({ path: `${root}/activity-work-gallery-expanded.png`, fullPage: true }); checks++;
    assert.deepEqual(errors, []);
    const receipt = { checks, viewports: [320, 393, 768, 1280], themes: ['light', 'dark'], errors, synthetic: true, nativeDeviceVerified: false };
    fs.writeFileSync(`${root}/receipt.json`, JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
