import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { buildRouteReviewObservations } from '../../src/utils/outdoorAnalysis';
import { OUTDOOR_SPORTS } from '../../src/utils/outdoorSports';
import type { ActiveOutdoorSessionProps } from '../../src/components/activity/ActiveOutdoorSession';

function harness(platform = 'web', width = 320, fontScale = 1) {
  const filename = resolve('src/components/activity/ActiveOutdoorSession.tsx');
  const require = createRequire(filename);
  const centers: unknown[] = [];
  let following = true;
  let metricWidth: number | null = null;
  const mocks: Record<string, unknown> = {
    react: { useMemo: (action: () => unknown) => action(), useRef: () => ({ current: { animateToRegion: (...args: unknown[]) => centers.push(args) } }),
      useState: (initial: unknown) => typeof initial === 'boolean'
        ? [following, (next: boolean) => { following = next; }]
        : [metricWidth, (next: number) => { metricWidth = next; }] },
    'react-native': { Platform: { OS: platform }, ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View',
      useWindowDimensions: () => ({ width, height: 740, fontScale }), StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1, absoluteFill: {} } },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'react-native-svg': { __esModule: true, default: 'Svg', Circle: 'Circle', Polyline: 'SvgPolyline' },
    '../maps/MapComponents': { __esModule: true, default: 'MapView', Marker: 'Marker', Polyline: 'Polyline' },
    '../../theme/useColors': { useColors: () => ({ bg: '#11100F', text: '#fff', accent: '#abc', primary: '#789' }) },
    '../../utils/outdoorAnalysis': { buildRouteReviewObservations },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : require(id) });
  return { ...module.exports, centers };
}

function mapboxAdapterHarness() {
  const filename = resolve('src/components/maps/MapComponents.native.tsx');
  const require = createRequire(filename);
  const React = require('react');
  const cameraCommands: unknown[] = [];
  const mocks: Record<string, unknown> = {
    react: { __esModule: true, ...React, default: React,
      forwardRef: (render: unknown) => render,
      useEffect() {}, useMemo: (action: () => unknown) => action(),
      useState: (value: unknown) => [value, () => {}],
      useRef: () => ({ current: { setCamera: (command: unknown) => cameraCommands.push(command) } }),
      useImperativeHandle: (ref: any, create: () => unknown) => { if (ref) ref.current = create(); },
    },
    'react-native': { View: 'View', StyleSheet: { create: (styles: unknown) => styles } },
    '@rnmapbox/maps': { __esModule: true, default: { StyleURL: { SatelliteStreet: 'synthetic-satellite' } },
      Camera: 'MapboxCamera', MapView: 'MapboxMapView', UserLocation: 'MapboxUserLocation',
      PointAnnotation: 'MapboxPointAnnotation', ShapeSource: 'MapboxShapeSource', LineLayer: 'MapboxLineLayer' },
    '../../lib/mapboxConfig': { isMapboxConfigured: () => false, MAPBOX_STYLE_URL: 'synthetic-style' },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText, { module, exports: module.exports, require: (id: string) => Object.hasOwn(mocks, id) ? mocks[id] : require(id) });
  return { render: (props: unknown) => module.exports.default(props, null), cameraCommands };
}

function nodes(element: any): any[] {
  if (!element || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return [element, ...nodes(element.props?.children)];
}
const startedAt = 1_760_000_000_000;
const points = Array.from({ length: 10 }, (_, i) => ({ latitude: 45 + i * 0.00003, longitude: 7 + i * 0.00001,
  timestamp: startedAt + i * 1000, accuracyMeters: 5 }));
function fixture(overrides: Partial<ActiveOutdoorSessionProps> = {}): ActiveOutdoorSessionProps {
  return { name: 'Walk', activityType: 'walking', paused: false, startedAt, points, recordingPauses: [],
    timeLabel: '42:18', distanceLabel: '3.24', distanceUnit: 'km',
    primaryMetrics: [{ label: 'Avg pace', value: '13:03 /km' }, { label: 'Heart rate', value: '--' }, { label: 'Elevation gain', value: '140 m' }],
    additionalMetrics: [{ label: 'Elevation loss', value: '52 m' }], watchStatus: 'No paired Apple Watch',
    coachingControls: null, onPauseResume() {}, onFinish() {}, ...overrides };
}

test('actual session puts an unframed map before paired primary metrics and fixed controls outside scrolling content', () => {
  const tree = harness().default(fixture());
  const scroll = tree.props.children[0];
  assert.equal(scroll.type, 'ScrollView');
  assert.equal(scroll.props.children[0].props.testID, 'active-outdoor-map');
  assert.equal(scroll.props.children[1].props.children[0].props.testID, 'active-outdoor-primary');
  assert.ok(nodes(tree.props.children[1]).some(node => node.props?.accessibilityLabel === 'Complete activity'));
  const mapStyle = scroll.props.children[0].props.style;
  assert.equal(mapStyle[0].borderRadius, undefined);
  assert.equal(mapStyle[1].height, 229.4);
});

test('actual web renderer draws the supplied GPS trace with finite coordinates, not a blank map stub', () => {
  const all = nodes(harness().default(fixture()));
  assert.ok(all.some(node => node.type === 'Svg'));
  const lines = all.filter(node => node.type === 'SvgPolyline');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].props.points.split(' ').length, points.length);
  assert.doesNotMatch(lines[0].props.points, /NaN|Infinity/);
  assert.equal(all.filter(node => node.type === 'Circle').length, 2);
});

test('native map draws recording coordinates separately from its current-location recenter control', () => {
  const native = harness('ios');
  const all = nodes(native.default(fixture()));
  const map = all.find(node => node.type === 'MapView');
  assert.equal(map.props.showsUserLocation, true);
  assert.equal(map.props.initialRegion.latitude, points.at(-1)!.latitude);
  assert.equal(all.find(node => node.type === 'Polyline').props.coordinates.length, points.length);
  const button = all.find(node => node.props?.accessibilityLabel === 'Recenter map on current location');
  assert.equal(button.props.disabled, false);
  button.props.onPress();
  assert.equal(native.centers.length, 0, 'Recenter must not animate to a stale recorded coordinate');
});

test('native map follows initially, a pan releases following, and Recenter restores it without changing navigation', () => {
  const native = harness('ios');
  const props = fixture();
  let all = nodes(native.default(props));
  assert.equal(all.find(node => node.type === 'MapView').props.followsUserLocation, true);
  all.find(node => node.type === 'MapView').props.onPanDrag();
  all = nodes(native.default(props));
  assert.equal(all.find(node => node.type === 'MapView').props.followsUserLocation, false);
  all.find(node => node.props?.accessibilityLabel === 'Recenter map on current location').props.onPress();
  all = nodes(native.default(props));
  assert.equal(all.find(node => node.type === 'MapView').props.followsUserLocation, true);
  assert.equal(native.centers.length, 0);
  assert.equal(props.instruction, undefined);
});

test('actual Mapbox adapter forwards user gestures to release following and Recenter restores device follow without coordinate commands', () => {
  const session = harness('ios');
  const adapter = mapboxAdapterHarness();
  const props = fixture({ instruction: 'Continue on trail' });
  const render = () => {
    const sessionNodes = nodes(session.default(props));
    const wrapper = sessionNodes.find(node => node.type === 'MapView');
    const nativeMap = adapter.render(wrapper.props);
    const camera = nodes(nativeMap).find(node => node.type === 'MapboxCamera');
    return { sessionNodes, nativeMap, camera };
  };
  let view = render();
  assert.equal(view.camera.props.followUserLocation, true);
  assert.ok(nodes(view.nativeMap).some(node => node.type === 'MapboxUserLocation'));
  view.nativeMap.props.onCameraChanged({ gestures: { isGestureActive: false } });
  assert.equal(render().camera.props.followUserLocation, true, 'programmatic camera updates do not release following');
  view.nativeMap.props.onCameraChanged({ gestures: { isGestureActive: true } });
  view = render();
  assert.equal(view.camera.props.followUserLocation, false, 'real adapter gesture callback releases device following');
  view.sessionNodes.find(node => node.props?.accessibilityLabel === 'Recenter map on current location').props.onPress();
  view = render();
  assert.equal(view.camera.props.followUserLocation, true);
  assert.equal(adapter.cameraCommands.length, 0, 'current-device follow does not compete with an accepted-point camera animation');
  assert.equal(props.instruction, 'Continue on trail', 'map gestures never change navigation instructions');
});

test('no GPS fix never invents a city, marker or usable recenter action', () => {
  const all = nodes(harness('ios').default(fixture({ points: [] })));
  assert.equal(all.some(node => node.type === 'MapView' || node.type === 'Marker'), false);
  const recenter = all.find(node => node.props?.accessibilityLabel === 'Recenter map on current location');
  assert.equal(recenter.props.disabled, true);
  assert.ok(all.some(node => node.props?.children === 'Waiting for an accurate GPS location'));
});

test('map reuses vetted accuracy and gap rules without mutating the recording or reconnecting a pause', () => {
  const { liveOutdoorMapSegments } = harness();
  const raw = [...points.slice(0, 5), { ...points[5]!, latitude: 80, accuracyMeters: 500 }, ...points.slice(6)];
  const before = JSON.stringify(raw);
  const groups = liveOutdoorMapSegments(raw, 'walking', startedAt, [{ startTime: startedAt + 4000, endTime: startedAt + 6000 }]);
  assert.equal(groups.length, 2);
  assert.equal(groups.flat().length, 9);
  assert.equal(JSON.stringify(raw), before);
});

test('all nine sports retain caller metrics and provenance without manufacturing swimming or sensor values', () => {
  for (const activityType of Object.keys(OUTDOOR_SPORTS) as ActiveOutdoorSessionProps['activityType'][]) {
    const metrics = [{ label: activityType === 'cycling' ? 'Measured power' : 'Heart rate', value: '--' }];
    const all = nodes(harness().default(fixture({ activityType, additionalMetrics: metrics })));
    assert.ok(all.some(node => node.props?.metric === metrics[0]));
    assert.ok(all.some(node => node.props?.children === 'No paired Apple Watch'));
    assert.equal(all.some(node => node.props?.children === 'Swimming'), false);
  }
});

test('Pause/Resume and Finish call only the supplied actions; paused state remains visible', () => {
  for (const paused of [false, true]) {
    let pauses = 0, finishes = 0;
    const all = nodes(harness().default(fixture({ paused, onPauseResume: () => { pauses++; }, onFinish: () => { finishes++; } })));
    all.find(node => node.props?.accessibilityLabel === (paused ? 'Resume activity' : 'Pause activity')).props.onPress();
    all.find(node => node.props?.accessibilityLabel === 'Complete activity').props.onPress();
    assert.equal(pauses, 1); assert.equal(finishes, 1);
    assert.ok(all.some(node => node.props?.children === (paused ? 'Paused' : 'Recording')));
  }
});

test('retained End shows Finishing, disables Pause/Resume accessibly, and keeps Finish retry available', () => {
  for (const paused of [false, true]) {
    let pauses = 0, retries = 0;
    const all = nodes(harness().default(fixture({ paused, ending: true,
      onPauseResume: () => { pauses++; }, onFinish: () => { retries++; } })));
    assert.ok(all.some(node => node.props?.children === 'Finishing'));
    const pause = all.find(node => node.props?.accessibilityLabel === 'Activity ending');
    assert.equal(pause.props.disabled, true);
    assert.equal(pause.props.accessibilityState.disabled, true);
    assert.equal(pause.props.onPress, undefined);
    assert.equal(all.some(node => node.props?.accessibilityLabel === 'Resume activity'), false);
    const retry = all.find(node => node.props?.accessibilityLabel === 'Retry finish activity');
    assert.notEqual(retry.props.disabled, true);
    retry.props.onPress();
    assert.equal(pauses, 0); assert.equal(retries, 1);
  }
});

test('numeric type keeps a readable floor and starts at full size before measurement; long values reflow instead of collapsing', () => {
  const { fitMetricFontSize } = harness();
  for (const width of [98, 112, 132, 155]) {
    for (const [value, unit] of [['42:18', ''], ['4.20', 'km'], ['1666:39', ''], ['9999.99', 'mi']]) {
      const font = fitMetricFontSize(value, width, 53, 40, unit);
      assert.ok(font >= 40 && font <= 53);
    }
  }
  for (const value of ['18.4 km/h', '138 bpm', '13:03 /km', '112 spm']) {
    const font = fitMetricFontSize(value, 72, 20, 18);
    assert.equal(font, 18);
  }
  assert.equal(fitMetricFontSize('42:18', null, 53, 40), 53, 'pre-layout rendering must not flash microscopic text');
  assert.equal(fitMetricFontSize('42:18', 132, 40, 18), fitMetricFontSize('42:18', 132, 40, 18), 'only container width and content influence sizing');
  for (const fontScale of [1, 1.3, 2]) {
    const font = fitMetricFontSize('123:59:59', 350, 53, 40, '', fontScale);
    assert.ok(font * fontScale >= 40);
    assert.ok(font * fontScale * 9 * 0.65 <= 350);
    const distanceFont = fitMetricFontSize('12345.67', 350, 53, 40, 'km', fontScale);
    assert.ok(distanceFont * fontScale >= 40);
    assert.ok((distanceFont * 8 * 0.65 + 3 * 16 * 0.65) * fontScale <= 350);
  }
});

test('native long-duration and accessibility layouts wrap bounded cells rather than constraining a tiny one-line value', () => {
  for (const width of [320, 390, 430]) for (const fontScale of [1, 1.3, 2]) {
    const tree = harness('ios', width, fontScale).default(fixture({ timeLabel: '123:59:59', distanceLabel: '12345.67' }));
    const primary = nodes(tree).find(node => node.props?.testID === 'active-outdoor-primary');
    assert.equal(primary.props.style.flexWrap, 'wrap');
    for (const cell of primary.props.children) {
      assert.equal(cell.props.style[0].maxWidth, '100%');
      const typography = cell.props.children[0];
      const rendered = typography.type(typography.props);
      const value = nodes(rendered).find(node => node.type === 'Text');
      assert.equal(value.props.adjustsFontSizeToFit, undefined);
      assert.equal(value.props.numberOfLines, undefined);
      assert.ok(value.props.style[1].fontSize >= 40);
    }
  }
});

test('actual native metric onLayout uses font scale and retains its full value without the iOS text fitter', () => {
  for (const fontScale of [1, 1.3, 2]) {
    const { FittedMetricText } = harness('ios', 390, fontScale);
    const props = { value: '123:59:59', primary: true, color: '#fff' };
    const initial = FittedMetricText(props);
    initial.props.onLayout({ nativeEvent: { layout: { width: 350 } } });
    const measured = FittedMetricText(props);
    const text = nodes(measured).find(node => node.type === 'Text');
    const effectiveSize = text.props.style[1].fontSize * fontScale;
    assert.ok(effectiveSize >= 40);
    assert.ok(effectiveSize * props.value.length * 0.65 <= 350);
    assert.equal(text.props.children, props.value);
    assert.equal(text.props.adjustsFontSizeToFit, undefined);
    assert.equal(text.props.numberOfLines, undefined);
  }
});
