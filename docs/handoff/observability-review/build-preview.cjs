const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const out = '/tmp/strideos-observability-preview';
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(__dirname, '../power-review/index.html'), path.join(out, 'index.html'));
esbuild.build({
  absWorkingDir: path.resolve(__dirname, '../../..'), entryPoints: [path.join(__dirname, 'preview.tsx')], outfile: path.join(out, 'preview.js'),
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', alias: { 'react-native': 'react-native-web' },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  loader: { '.js': 'jsx', '.ttf': 'file' }, define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true', 'process.env.EXPO_OS': '"web"' },
  plugins: [{ name: 'synthetic-observability-only', setup(build) {
    build.onResolve({ filter: /(?:observabilityConsentStore|lib\/observability)$/ }, () => ({ path: path.join(__dirname, 'fixture.ts') }));
    build.onResolve({ filter: /store\/themeStore$/ }, () => ({ path: path.join(__dirname, '../power-review/fixture-state.ts') }));
  } }],
}).catch(error => { console.error(error); process.exitCode = 1; });
