import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import type { ApprovedVector, ApprovedVectorPart, ApprovedBadgeState } from '../src/achievements/shared/approvedVector';

const root = 'docs/handoff/badge-review';
const states: ApprovedBadgeState[] = ['unlocked', 'locked', 'transparent'];
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const geometry = new Set(['d', 'points', 'transform', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'maskUnits']);
const children = (node: Element): Element[] => Array.from(node.childNodes).filter(value => value.nodeType === 1) as Element[];
const attributes = (node: Element) => Object.fromEntries(Array.from(node.attributes).map(value => [value.name, value.value]));
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

function identity(node: Element): string {
  return JSON.stringify([node.tagName, [...geometry].map(key => node.getAttribute(key)), node.getAttribute('data-lettering'), node.getAttribute('data-part'), node.getAttribute('data-background')]);
}

function compile(files: Record<ApprovedBadgeState, string>, family: string): ApprovedVector {
  const documents = states.map(state => {
    const source = readFileSync(files[state], 'utf8');
    assert(!/<text\b|<image\b|font-family=/.test(source), `Uncompiled approved artwork ${files[state]}`);
    return new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  });
  const values: Record<ApprovedBadgeState, string[]> = { unlocked: [], locked: [], transparent: [] };
  const slots = new Map<string, number>();
  function slot(triple: string[]): string {
    const key = JSON.stringify(triple);
    let index = slots.get(key);
    if (index === undefined) {
      index = slots.size;
      slots.set(key, index);
      states.forEach((state, i) => values[state].push(triple[i]));
    }
    return `{{${index}}}`;
  }
  function nodeMarkup(nodes: Element[]): string {
    const base = nodes[0], allAttrs = nodes.map(attributes);
    assert(nodes.every(node => node.tagName === base.tagName), 'Approved state tag drift');
    const names = Object.keys(allAttrs[0]);
    nodes.forEach((_, i) => assert.deepEqual(Object.keys(allAttrs[i]).sort(), [...names].sort(), `State attribute drift ${base.tagName}`));
    const attrs = names.map(name => {
      const triple = allAttrs.map(value => value[name]);
      if (geometry.has(name)) assert(triple.every(value => value === triple[0]), `State geometry drift ${name}`);
      const value = triple.every(value => value === triple[0]) ? escapeXml(triple[0]) : slot(triple);
      return ` ${name}="${value}"`;
    }).join('');
    const childSets = nodes.map(children);
    assert(childSets.every(set => set.length === childSets[0].length), `Nested state structure drift ${base.tagName}`);
    const inner = childSets[0].map((_, i) => nodeMarkup(childSets.map(set => set[i]))).join('');
    assert(Array.from(base.childNodes).every(node => node.nodeType === 1 || !node.textContent?.trim()), 'Unexpected vector text');
    return `<${base.tagName}${attrs}>${inner}</${base.tagName}>`;
  }
  const roots = documents.map(children), positions = [0, 0, 0];
  const parts: ApprovedVectorPart[] = roots[0].map(base => {
    const matched = roots.map((nodes, i) => {
      const candidate = nodes[positions[i]];
      if (candidate && identity(candidate) === identity(base)) { positions[i]++; return candidate; }
      const ambient = base.tagName === 'ellipse' || base.hasAttribute('data-background')
        || (base.tagName === 'path' && /url\(#.*ambient\)/.test(base.getAttribute('fill') ?? '') && !base.hasAttribute('stroke'));
      assert(i === 2 && ambient, `Unapproved state omission: ${files[states[i]]}/${base.tagName}`);
      return null;
    });
    const opaqueOnly = matched[2] === null;
    const lettering = base.getAttribute('data-lettering') || undefined;
    const footer = base.hasAttribute('data-chevrons') || base.getAttribute('data-part') === 'chevrons';
    const hideCompact = footer || lettering === 'wordmark'
      || ((family === 'strength' || family === 'recovery' || family === 'challenges') && !!lettering && lettering !== 'count' && lettering !== 'number')
      || (family === 'runLevels' ? false : family === 'streaks' && lettering === 'title');
    return { markup: nodeMarkup(matched.map(value => value ?? base)), ...(opaqueOnly ? { opaqueOnly: true } : {}), ...(hideCompact ? { hideCompact: true } : {}), ...(lettering ? { lettering } : {}) };
  });
  roots.forEach((set, i) => assert.equal(positions[i], set.length, 'Unexpected added state geometry'));
  return { parts, values, sources: Object.fromEntries(states.map(state => [state, { path: files[state], sha256: sha(readFileSync(files[state])) }])) as ApprovedVector['sources'] };
}

const maps = new Map<string, Record<string, ApprovedVector>>();
function add(family: string, key: string, files: Record<ApprovedBadgeState, string>) {
  const data = maps.get(family) ?? {};
  assert(!data[key], `Duplicate compiled art ${family}/${key}`);
  data[key] = compile(files, family);
  maps.set(family, data);
}

for (const [dir, family] of [['weekly-distance', 'weeklyDistance'], ['monthly-distance', 'monthlyDistance'], ['run-levels', 'runLevels'], ['strength', 'strength'], ['recovery', 'recovery'], ['challenges', 'challenges']]) {
  const manifest = json(`${root}/${dir}/individual-exports/manifest.json`);
  for (const definition of manifest.definitions) {
    const files = Object.fromEntries(states.map(state => {
      const entry = manifest.files.find((value: { id: string; state: string }) => value.id === definition.id && value.state === state);
      assert(entry, `Missing approved ${definition.id}/${state}`);
      const file = `${root}/${dir}/${entry.svg}`;
      assert.equal(sha(readFileSync(file)), entry.svgHash, `Approved source hash drift: ${file}`);
      return [state, file];
    })) as Record<ApprovedBadgeState, string>;
    add(family, definition.id, files);
  }
}

const lifetime = json(`${root}/lifetime-distance/validation.json`);
for (const family of ['running', 'cycling']) for (const id of [...new Set<string>(lifetime.files.filter((file: { family: string }) => file.family === family).map((file: { id: string }) => file.id))]) for (const units of ['imperial', 'metric']) {
  const files = Object.fromEntries(states.map(state => {
    const entry = lifetime.files.find((file: { family: string; id: string; state: string; units: string }) => file.family === family && file.id === id && file.state === state && file.units === units);
    const file = `${root}/lifetime-distance/${entry.svg}`;
    assert.equal(sha(readFileSync(file)), entry.svgHash);
    return [state, file];
  })) as Record<ApprovedBadgeState, string>;
  add(family === 'running' ? 'lifetimeDistanceRunning' : 'lifetimeDistanceCycling', `${id}:${units}`, files);
}

const streakManifest = json(`${root}/streaks/individual-exports/manifest.json`);
add('streaks', 'daily', Object.fromEntries(states.map(state => [state, `${root}/streaks/individual-exports/${streakManifest.entries.find((entry: { group: string; days: number; state: string }) => entry.group === 'daily' && entry.days === 3 && entry.state === state).svg}`])) as Record<ApprovedBadgeState, string>);

for (const [family, data] of maps) {
  const file = `src/achievements/${family}/approvedArtwork.ts`;
  const contents = `// Generated from approved repository SVGs by scripts/import-approved-badge-artwork.ts.\nimport type { ApprovedVector } from '../shared/approvedVector';\n\nexport const APPROVED_ARTWORK: Readonly<Record<string, ApprovedVector>> = ${JSON.stringify(data, null, 2)};\n`;
  if (process.argv.includes('--check')) assert.equal(readFileSync(file, 'utf8'), contents, `Compiled artwork drift: ${file}`);
  else { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, contents); }
  const palettes = Object.fromEntries(Object.entries(data).map(([key, art]) => {
    const document = new DOMParser().parseFromString(readFileSync(art.sources.unlocked.path, 'utf8'), 'image/svg+xml');
    const stops = Array.from(document.getElementsByTagName('linearGradient')[0].getElementsByTagName('stop'));
    const frame = children(document.documentElement).find(node => node.hasAttribute('data-frame') || node.getAttribute('data-part') === 'frame')!;
    const copy = Array.from(document.getElementsByTagName('path')).find(node => node.hasAttribute('data-lettering'))!;
    return [key, { primary: stops[1].getAttribute('stop-color'), highlight: stops[0].getAttribute('stop-color'), shadow: stops[stops.length - 1].getAttribute('stop-color'), text: copy.getAttribute('fill'), background: frame.getAttribute('fill') }];
  }));
  const paletteFile = `src/achievements/${family}/approvedPalette.ts`;
  const paletteSource = `// Generated from approved SVG paint, separate from vector data for registry consumers.\nexport const APPROVED_PALETTE = ${JSON.stringify(palettes, null, 2)};\n`;
  if (process.argv.includes('--check')) assert.equal(readFileSync(paletteFile, 'utf8'), paletteSource);
  else writeFileSync(paletteFile, paletteSource);
}
const digitsFile = 'src/achievements/streaks/approvedDigits.ts';
const digits = `// Generated from approved lining Didot digit paths; no runtime font dependency.\nexport const APPROVED_STREAK_DIGITS = ${JSON.stringify(json(`${root}/streaks/digits.json`), null, 2)};\n`;
if (process.argv.includes('--check')) assert.equal(readFileSync(digitsFile, 'utf8'), digits);
else writeFileSync(digitsFile, digits);
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Compiled'} approved artwork for ${maps.size} production families.`);
