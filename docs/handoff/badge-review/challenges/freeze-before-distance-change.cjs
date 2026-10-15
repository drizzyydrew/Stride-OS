const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const file = path.join(__dirname, 'distance-change-baseline.json');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (!fs.existsSync(file)) {
  const manifest = require('./individual-exports/manifest.json');
  assert.equal(manifest.files.length, 36, 'Capture the original twelve-design baseline once.');
  const preserved = {}, retired = {};
  for (const value of manifest.files) for (const extension of ['svg', 'png']) {
    const relative = value[extension], expected = value[`${extension}Hash`];
    assert.equal(hash(fs.readFileSync(path.join(__dirname, relative))), expected);
    (value.id === 'challenge_5k_month' ? retired : preserved)[relative] = expected;
  }
  assert.equal(Object.keys(preserved).length, 66);
  assert.equal(Object.keys(retired).length, 6);
  fs.writeFileSync(file, `${JSON.stringify({ preserved, retired }, null, 2)}\n`);
}
console.log('Captured preservation hashes for eleven unchanged designs and six retired 5K files.');
