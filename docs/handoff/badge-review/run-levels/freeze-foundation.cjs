const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const baseline = Object.fromEntries(['unlocked', 'locked', 'transparent'].flatMap(state => ['svg', 'png'].map(extension => {
  const file = `foundation-${state}.${extension}`;
  return [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')];
})));
const file = path.join(__dirname, 'approved-foundation-hashes.json');
if (fs.existsSync(file)) assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), baseline);
else fs.writeFileSync(file, `${JSON.stringify(baseline, null, 2)}\n`);
console.log('Approved Foundation sample: six hashes preserved.');
