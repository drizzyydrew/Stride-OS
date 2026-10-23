const path = require('node:path');
const fs = require('node:fs');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '../../..');
const out = '/tmp/strideos-power-preview';
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(out, 'index.html'));
esbuild.build({
  absWorkingDir: root, entryPoints: [path.join(__dirname, 'preview.tsx')], outfile: path.join(out, 'preview.js'),
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', __DEV__: 'true', 'process.env.EXPO_OS': '"web"' },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  alias: { 'react-native': 'react-native-web' }, loader: { '.js': 'jsx', '.ttf': 'file', '.png': 'file' },
  plugins: [{ name: 'synthetic-stores-only', setup(build) {
    build.onResolve({ filter: /(?:store\/(?:activityStore|profileStore|themeStore)$|^expo-router$)/ }, () => ({ path: path.join(__dirname, 'fixture-state.ts') }));
  } }],
}).then(() => console.log(`Built synthetic preview at ${out}/index.html`)).catch(error => { console.error(error); process.exitCode = 1; });
