const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-health',
  'RCTAppleHealthKit',
  'RCTAppleHealthKit.m',
);

if (!fs.existsSync(file)) {
  process.exit(0);
}

const source = fs.readFileSync(file, 'utf8');
const patched = source.replace(
  /\n\s*self\.callableJSModules = \[RCTAppleHealthKit sharedJsModule\];\n\s*\[self\.callableJSModules setBridge:self\.bridge\];/g,
  '',
);

if (patched !== source) {
  fs.writeFileSync(file, patched);
  console.log('Patched react-native-health for React Native 0.85 callableJSModules compatibility.');
}
