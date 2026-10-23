import type { ErrorEvent, Exception, StackFrame } from '@sentry/react-native';

import { FEATURE_TOURS } from './featureTours';

type ProductEvent = {
  event: string;
  properties: Record<string, string | number | boolean>;
};

const SIMPLE_EVENTS = new Set(['app_opened', 'onboarding_completed', 'settings_opened']);
const TOUR_EVENTS = new Set([
  'feature_tour_started',
  'feature_tour_step_viewed',
  'feature_tour_completed',
  'feature_tour_skipped',
  'feature_tour_replayed',
]);
const ENTRY_SOURCES = new Set(['first_use', 'replay', 'manual']);
const ERROR_TYPES = new Set([
  'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError',
]);
const BUNDLE_FILENAMES = new Set([
  'main.jsbundle', 'index.android.bundle', 'index.ios.bundle',
  'app:///main.jsbundle', 'app:///index.android.bundle', 'app:///index.ios.bundle',
]);
const SOURCEMAP_CODE_FILES = new Set(['app:///main.jsbundle', 'app:///index.android.bundle']);
const UUID_PATTERN = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const REDACTED_MESSAGE = 'Application error (details removed for privacy)';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function aliasedProperty(props: Record<string, unknown>, camel: string, snake: string): unknown {
  const camelValue = props[camel];
  const snakeValue = props[snake];
  if (camelValue !== undefined && snakeValue !== undefined && camelValue !== snakeValue) return undefined;
  return camelValue !== undefined ? camelValue : snakeValue;
}

export function sanitizeProductEvent(
  name: string,
  props: Record<string, unknown>,
): ProductEvent | null {
  if (SIMPLE_EVENTS.has(name)) return { event: name, properties: {} };
  if (!TOUR_EVENTS.has(name) || !isRecord(props)) return null;

  const tourId = aliasedProperty(props, 'tourId', 'tour_id');
  const tourVersion = aliasedProperty(props, 'tourVersion', 'tour_version');
  const entrySource = aliasedProperty(props, 'entrySource', 'entry_source');
  const tour = FEATURE_TOURS.find(definition => definition.id === tourId);
  if (!tour || tourVersion !== tour.version) return null;

  // Step details are deliberately omitted, including untrusted step IDs/numbers.
  const properties: ProductEvent['properties'] = {
    tour_id: tour.id,
    tour_version: tour.version,
  };
  if (typeof entrySource === 'string' && ENTRY_SOURCES.has(entrySource)) {
    properties.entry_source = entrySource;
  }
  return { event: name, properties };
}

function sanitizeFrame(value: unknown): StackFrame | null {
  if (!isRecord(value) || typeof value.filename !== 'string' || !BUNDLE_FILENAMES.has(value.filename)) {
    return null;
  }
  const frame: StackFrame = { filename: value.filename };
  if (typeof value.lineno === 'number' && Number.isSafeInteger(value.lineno) && value.lineno >= 0) {
    frame.lineno = value.lineno;
  }
  if (typeof value.colno === 'number' && Number.isSafeInteger(value.colno) && value.colno >= 0) {
    frame.colno = value.colno;
  }
  if (typeof value.in_app === 'boolean') frame.in_app = value.in_app;
  return frame;
}

function sanitizeException(value: unknown): Exception | null {
  if (!isRecord(value)) return null;
  const exception: Exception = {
    type: typeof value.type === 'string' && ERROR_TYPES.has(value.type) ? value.type : 'Error',
    value: REDACTED_MESSAGE,
  };
  if (isRecord(value.stacktrace) && Array.isArray(value.stacktrace.frames)) {
    const frames: StackFrame[] = [];
    for (const candidate of value.stacktrace.frames) {
      const frame = sanitizeFrame(candidate);
      if (frame) frames.push(frame);
    }
    if (frames.length > 0) exception.stacktrace = { frames };
  }
  return exception;
}

// This filters JS event bodies only; the caller must separately deny envelope attachments/native sends.
export function sanitizeDiagnosticEvent(value: unknown): ErrorEvent | null {
  if (!isRecord(value) || value.type !== undefined) return null;
  if (value.platform !== undefined && value.platform !== 'javascript') return null;
  if (!isRecord(value.exception) || !Array.isArray(value.exception.values)) return null;

  const values: Exception[] = [];
  for (const candidate of value.exception.values) {
    const exception = sanitizeException(candidate);
    if (exception) values.push(exception);
  }
  if (values.length === 0) return null;

  const event: ErrorEvent = {
    type: undefined,
    platform: 'javascript',
    level: 'error',
    exception: { values },
  };
  if (typeof value.event_id === 'string' && value.event_id.length === 32 && /^[a-f\d]{32}$/i.test(value.event_id)) {
    event.event_id = value.event_id;
  }
  if (typeof value.timestamp === 'number' && Number.isFinite(value.timestamp)) {
    event.timestamp = value.timestamp;
  }
  if (isRecord(value.debug_meta) && Array.isArray(value.debug_meta.images)) {
    const images: NonNullable<ErrorEvent['debug_meta']>['images'] = [];
    for (const image of value.debug_meta.images) {
      if (!isRecord(image) || image.type !== 'sourcemap') continue;
      if (typeof image.code_file !== 'string' || !SOURCEMAP_CODE_FILES.has(image.code_file)) continue;
      if (typeof image.debug_id !== 'string' || image.debug_id.length !== 36 || !UUID_PATTERN.test(image.debug_id)) continue;
      images.push({ type: 'sourcemap', code_file: image.code_file, debug_id: image.debug_id });
    }
    if (images.length > 0) event.debug_meta = { images };
  }
  return event;
}
