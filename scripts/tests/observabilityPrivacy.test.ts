import assert from 'node:assert/strict';
import test from 'node:test';
import type { ErrorEvent, Event } from '@sentry/react-native';

import { FEATURE_TOURS } from '../../src/utils/featureTours';
import { sanitizeDiagnosticEvent, sanitizeProductEvent } from '../../src/utils/observabilityPrivacy';

const SECRET = 'injury: knee pain; HR 189; GPS 45.44,12.33; person@example.com; Bearer secret-token; https://private.test/?token=secret';
const REDACTED = 'Application error (details removed for privacy)';
const TOUR_EVENTS = [
  'feature_tour_started', 'feature_tour_step_viewed', 'feature_tour_completed',
  'feature_tour_skipped', 'feature_tour_replayed',
];

function assertNoSecrets(value: unknown) {
  const json = JSON.stringify(value);
  for (const secret of ['injury:', 'knee pain', '189', '45.44', '12.33', 'person@example.com', 'Bearer', 'secret-token', 'private.test']) {
    assert.equal(json.includes(secret), false, secret);
  }
}

test('simple product events contain no caller properties', () => {
  for (const event of ['app_opened', 'onboarding_completed', 'settings_opened']) {
    const output = sanitizeProductEvent(event, { user: SECRET, health: SECRET, url: SECRET });
    assert.deepEqual(output, { event, properties: {} });
    assertNoSecrets(output);
  }
});

test('only exact allowlisted product event names are accepted', () => {
  for (const name of ['$identify', '$screen', '$exception', '__proto__', 'constructor', SECRET, 'app_opened\n', 'APP_OPENED', 'feature_tour_started_extra']) {
    assert.equal(sanitizeProductEvent(name, {}), null);
  }
});

test('all current tour definitions and tour events produce fresh minimal properties', () => {
  for (const tour of FEATURE_TOURS) {
    for (const event of TOUR_EVENTS) {
      for (const entrySource of ['first_use', 'replay', 'manual']) {
        const props = Object.freeze({ tourId: tour.id, tourVersion: tour.version, entrySource, user: SECRET });
        const output = sanitizeProductEvent(event, props);
        assert.deepEqual(output, {
          event,
          properties: { tour_id: tour.id, tour_version: tour.version, entry_source: entrySource },
        });
        assert.notEqual(output?.properties, props);
        assertNoSecrets(output);
      }
    }
  }
});

test('invalid tour/version combinations are dropped without coercion', () => {
  for (const tourId of ['__proto__', 'constructor', SECRET, '', undefined, 1, { id: 'today' }]) {
    assert.equal(sanitizeProductEvent('feature_tour_started', { tourId, tourVersion: 1 }), null);
  }
  const tour = FEATURE_TOURS[0];
  for (const tourVersion of [undefined, null, String(tour.version), tour.version + 1, 0, -1, NaN, Infinity, {}]) {
    assert.equal(sanitizeProductEvent('feature_tour_started', { tourId: tour.id, tourVersion }), null);
  }
  for (const props of [null, undefined, [], SECRET]) {
    assert.equal(sanitizeProductEvent('feature_tour_started', props as unknown as Record<string, unknown>), null);
  }
});

test('product events remain identical after transport sanitizes emitted snake_case properties again', () => {
  for (const tour of FEATURE_TOURS) {
    for (const name of TOUR_EVENTS) {
      for (const entrySource of [undefined, 'first_use', 'replay', 'manual']) {
        const first = sanitizeProductEvent(name, { tourId: tour.id, tourVersion: tour.version, entrySource });
        assert.ok(first);
        assert.deepEqual(sanitizeProductEvent(first.event, first.properties), first);
        assert.deepEqual(sanitizeProductEvent(name, { ...first.properties, health: SECRET, step_id: SECRET }), first);
      }
    }
  }
  for (const name of ['app_opened', 'onboarding_completed', 'settings_opened']) {
    assert.deepEqual(sanitizeProductEvent(name, sanitizeProductEvent(name, {})!.properties), { event: name, properties: {} });
  }
});

test('snake_case aliases obey the same validation and reject conflicting tour identities or versions', () => {
  const tour = FEATURE_TOURS[0];
  const base = { tour_id: tour.id, tour_version: tour.version };
  const expected = { event: 'feature_tour_started', properties: base };
  for (const tour_id of [SECRET, 'constructor', '__proto__', null, 1, {}]) {
    assert.equal(sanitizeProductEvent('feature_tour_started', { ...base, tour_id }), null);
  }
  for (const tour_version of [SECRET, String(tour.version), null, NaN, Infinity, tour.version + 1]) {
    assert.equal(sanitizeProductEvent('feature_tour_started', { ...base, tour_version }), null);
  }
  for (const entry_source of [SECRET, 'manual\n', null, 1, {}]) {
    assert.deepEqual(sanitizeProductEvent('feature_tour_started', { ...base, entry_source }), expected);
  }
  assert.equal(sanitizeProductEvent('feature_tour_started', { ...base, tourId: FEATURE_TOURS[1].id }), null);
  assert.equal(sanitizeProductEvent('feature_tour_started', { ...base, tourVersion: tour.version + 1 }), null);
  assert.equal(sanitizeProductEvent('feature_tour_started', { ...base, tourVersion: String(tour.version) }), null);
  assert.deepEqual(sanitizeProductEvent('feature_tour_started', { ...base, entrySource: 'manual', entry_source: 'replay' }), expected);
  assert.deepEqual(sanitizeProductEvent('feature_tour_started', {
    ...base, tourId: tour.id, tourVersion: tour.version, entrySource: 'manual', entry_source: 'manual',
  }), { event: 'feature_tour_started', properties: { ...base, entry_source: 'manual' } });
});

test('step data is always stripped, including valid steps, mismatched pairs and poisoned values', () => {
  const tour = FEATURE_TOURS[0];
  const base = { tourId: tour.id, tourVersion: tour.version };
  const expected = { event: 'feature_tour_step_viewed', properties: { tour_id: tour.id, tour_version: tour.version } };
  for (const steps of [
    { stepId: tour.steps[0].id, stepNumber: 1 },
    { stepId: tour.steps[0].id, stepNumber: 2 },
    { stepId: FEATURE_TOURS[1].steps[0].id, stepNumber: 1 },
    { stepId: SECRET, stepNumber: SECRET },
    { stepId: SECRET, stepNumber: Infinity },
  ]) {
    assert.deepEqual(sanitizeProductEvent('feature_tour_step_viewed', { ...base, ...steps, createdAt: SECRET }), expected);
  }
  for (const entrySource of [SECRET, 'manual\n', 1, {}, null]) {
    assert.deepEqual(sanitizeProductEvent('feature_tour_step_viewed', { ...base, entrySource }), expected);
  }
});

test('diagnostics rebuild only redacted exceptions and explicitly allowed metadata', () => {
  const input = Object.freeze({
    event_id: '0123456789abcdef0123456789ABCDEF', timestamp: 1234.5, platform: 'javascript',
    message: SECRET, logentry: { message: SECRET }, level: 'fatal', user: { email: SECRET },
    request: { url: SECRET, headers: { Authorization: SECRET } }, contexts: { health: { value: SECRET } },
    breadcrumbs: [{ message: SECRET }], extra: { health: SECRET }, tags: { athlete: SECRET },
    attachments: [{ filename: SECRET, data: SECRET }], fingerprint: [SECRET], transaction: SECRET,
    release: SECRET, environment: SECRET, sdkProcessingMetadata: { secret: SECRET },
    threads: { values: [{ name: SECRET }] }, debug_meta: { secret: SECRET },
    exception: { values: [{ type: 'TypeError', value: SECRET, module: SECRET, thread_id: SECRET, mechanism: { data: SECRET } }] },
  });
  const output: ErrorEvent | null = sanitizeDiagnosticEvent(input);
  assert.deepEqual(output, {
    type: undefined, platform: 'javascript', level: 'error', event_id: input.event_id, timestamp: input.timestamp,
    exception: { values: [{ type: 'TypeError', value: REDACTED }] },
  });
  assert.notEqual(output?.exception, input.exception);
  assertNoSecrets(output);
  assert.equal(input.exception.values[0].value, SECRET);
});

test('known exception types survive and unknown classes always become static Error', () => {
  for (const type of ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError']) {
    const input: Event = { exception: { values: [{ type, value: SECRET }] } };
    assert.deepEqual(sanitizeDiagnosticEvent(input)?.exception?.values, [{ type, value: REDACTED }]);
  }
  for (const type of [SECRET, 'constructor', '__proto__', 'TypeError\n', '', null, undefined, {}]) {
    const output = sanitizeDiagnosticEvent({ exception: { values: [{ type, value: SECRET }] } });
    assert.deepEqual(output?.exception?.values, [{ type: 'Error', value: REDACTED }]);
    assertNoSecrets(output);
  }
});

test('diagnostic frames retain only exact bundle filenames and validated primitive coordinates', () => {
  for (const filename of ['main.jsbundle', 'index.android.bundle', 'index.ios.bundle', 'app:///main.jsbundle', 'app:///index.android.bundle', 'app:///index.ios.bundle']) {
    const output = sanitizeDiagnosticEvent({ exception: { values: [{ stacktrace: { frames: [{
      filename, lineno: 12, colno: 0, in_app: true, function: SECRET, vars: { token: SECRET },
      context_line: SECRET, pre_context: [SECRET], post_context: [SECRET], abs_path: SECRET,
      module: SECRET, module_metadata: { token: SECRET }, instruction_addr: SECRET,
    }] } }] } });
    assert.deepEqual(output?.exception?.values?.[0].stacktrace, { frames: [{ filename, lineno: 12, colno: 0, in_app: true }] });
    assertNoSecrets(output);
  }
});

test('unsafe frame paths are dropped, including query strings, URLs, suffixes and newline tricks', () => {
  const frames = [SECRET, '/private/athlete/main.jsbundle', 'https://private.test/main.jsbundle',
    'main.jsbundle?token=secret', 'main.jsbundle#secret', 'main.jsbundle\n',
    'app:///../main.jsbundle', 'app://main.jsbundle', 'prefix-main.jsbundle', 'Main.jsbundle',
    'main.jsbundle/secret', 'index.ios.bundle\u0000', undefined,
  ].map(filename => ({ filename, function: SECRET }));
  const output = sanitizeDiagnosticEvent({ exception: { values: [{ stacktrace: { frames } }] } });
  assert.deepEqual(output?.exception?.values, [{ type: 'Error', value: REDACTED }]);
  assertNoSecrets(output);
});

test('invalid frame coordinates are omitted without numeric or boolean coercion', () => {
  for (const invalid of [SECRET, '12', NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, {}, []]) {
    const output = sanitizeDiagnosticEvent({ exception: { values: [{ stacktrace: { frames: [{
      filename: 'main.jsbundle', lineno: invalid, colno: invalid, in_app: invalid,
    }] } }] } });
    assert.deepEqual(output?.exception?.values?.[0].stacktrace, { frames: [{ filename: 'main.jsbundle' }] });
  }
  const output = sanitizeDiagnosticEvent({ exception: { values: [{ stacktrace: { frames: [{ filename: 'main.jsbundle', in_app: false }] } }] } });
  assert.equal(output?.exception?.values?.[0].stacktrace?.frames?.[0].in_app, false);
});

test('invalid diagnostic IDs and timestamps are omitted without coercion', () => {
  for (const invalid of [SECRET, '', 'a'.repeat(31), 'a'.repeat(33), 'g'.repeat(32), `${'a'.repeat(32)}\n`, 123, null, {}]) {
    assert.equal(sanitizeDiagnosticEvent({ event_id: invalid, exception: { values: [{}] } })?.event_id, undefined);
  }
  for (const invalid of [NaN, Infinity, -Infinity, '123', SECRET, null, {}]) {
    assert.equal(sanitizeDiagnosticEvent({ timestamp: invalid, exception: { values: [{}] } })?.timestamp, undefined);
  }
  assert.equal(sanitizeDiagnosticEvent({ timestamp: 0, exception: { values: [{}] } })?.timestamp, 0);
});

test('non-error events, explicit native platforms and absent exceptions are dropped', () => {
  for (const type of ['transaction', 'profile', 'replay_event', 'feedback', 'session', 'log', 'error', null, SECRET]) {
    assert.equal(sanitizeDiagnosticEvent({ type, exception: { values: [{}] } }), null);
  }
  for (const platform of ['cocoa', 'java', 'native', 'javascript\n', SECRET, null]) {
    assert.equal(sanitizeDiagnosticEvent({ platform, exception: { values: [{}] } }), null);
  }
  for (const input of [null, undefined, [], SECRET, {}, { message: SECRET }, { exception: [] },
    { exception: { values: [] } }, { exception: { values: SECRET } }, { exception: { values: [null, 1, SECRET, []] } }]) {
    assert.equal(sanitizeDiagnosticEvent(input), null);
  }
});

test('malformed exception/frame entries cannot carry arbitrary context into chained exceptions', () => {
  const output = sanitizeDiagnosticEvent({ exception: { values: [null, SECRET, {
    type: 'RangeError', value: SECRET, stacktrace: { frames: [null, SECRET, {}, { filename: 'main.jsbundle', vars: { value: SECRET } }] },
  }, { type: SECRET, stacktrace: { frames: SECRET } }] } });
  assert.deepEqual(output?.exception?.values, [
    { type: 'RangeError', value: REDACTED, stacktrace: { frames: [{ filename: 'main.jsbundle' }] } },
    { type: 'Error', value: REDACTED },
  ]);
  assertNoSecrets(output);
});

test('diagnostics preserve only safe source-map matching fields and survive a second filtering pass', () => {
  const debug_id = '01234567-89ab-4cde-8fab-0123456789AB';
  const images = ['app:///main.jsbundle', 'app:///index.android.bundle'].map(code_file => ({
    type: 'sourcemap', code_file, debug_id,
  }));
  const input = { exception: { values: [{ type: 'TypeError', value: SECRET }] }, debug_meta: {
    context: SECRET, images: images.map(image => ({ ...image, debug_file: SECRET, code_id: SECRET, context: SECRET })),
  }, release: SECRET, dist: SECRET };
  const output = sanitizeDiagnosticEvent(input);
  assert.deepEqual(output?.debug_meta, { images });
  assert.equal(output?.release, undefined);
  assert.equal(output?.dist, undefined);
  assertNoSecrets(output);
  assert.deepEqual(sanitizeDiagnosticEvent(output), output);
  assert.notEqual(output?.debug_meta?.images?.[0], input.debug_meta.images[0]);
});

test('unsafe debug images never escape by paths, types, IDs, malformed records or suffix tricks', () => {
  const safe = { type: 'sourcemap', code_file: 'app:///main.jsbundle', debug_id: '01234567-89ab-4cde-8fab-0123456789ab' };
  const images: unknown[] = [null, SECRET, [], {}, ...[
    SECRET, 'main.jsbundle', 'app:///index.ios.bundle', 'app:///../main.jsbundle',
    'app:///main.jsbundle?token=secret', 'app:///main.jsbundle#secret', 'app:///main.jsbundle\n',
    'https://private.test/main.jsbundle', '/private/athlete/main.jsbundle',
  ].map(code_file => ({ ...safe, code_file })), ...[
    SECRET, '', 'a'.repeat(32), `${safe.debug_id}\n`, `${safe.debug_id}?token=secret`,
    '01234567-89ab-4cde-8fab-0123456789ag', null, 123, {},
  ].map(debug_id => ({ ...safe, debug_id })), ...[
    'macho', 'wasm', 'sourcemap\n', SECRET, undefined,
  ].map(type => ({ ...safe, type }))];
  const event = { exception: { values: [{}] }, debug_meta: { images, context: SECRET } };
  assert.equal(sanitizeDiagnosticEvent(event)?.debug_meta, undefined);
  const output = sanitizeDiagnosticEvent({ ...event, debug_meta: { ...event.debug_meta, images: [...images, safe] } });
  assert.deepEqual(output?.debug_meta, { images: [safe] });
  assertNoSecrets(output);
  for (const debug_meta of [null, SECRET, [], {}, { images: SECRET }, { images: [] }]) {
    assert.equal(sanitizeDiagnosticEvent({ ...event, debug_meta })?.debug_meta, undefined);
  }
});
