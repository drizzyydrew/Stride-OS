import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');
function member(source: string, marker: string) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, marker);
  const brace = source.indexOf('{', start);
  let depth = 1, end = brace + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  return source.slice(start, end).replace(/^(private|fileprivate) /, '')
    .replaceAll('Date().timeIntervalSince1970', 'TestClock.seconds')
    .replaceAll('DispatchQueue.main.asyncAfter', 'WatchScheduler.main.asyncAfter');
}

test('actual phone coordinator and Watch receive/start methods execute adversarial transport and owner ordering', { skip: process.platform !== 'darwin' }, () => {
  const phone = read('modules/stride-watch-connectivity/ios/StrideWatchConnectivityModule.swift');
  const coordinator = phone.slice(phone.indexOf('private enum StrideWatchMessageType'), phone.indexOf('public final class StrideWatchConnectivityModule'))
    .replace('private final class StrideWatchConnectivityCoordinator', 'final class StrideWatchConnectivityCoordinator')
    .replaceAll('Date().timeIntervalSince1970', 'TestClock.seconds')
    .replaceAll('WCSession.default', 'WCSession.defaultSession')
    .replaceAll('DispatchQueue.global().async', 'PhoneScheduler.enqueue');
  const watch = read('targets/StrideOSWatch/StrideWatchWorkoutManager.swift');
  const names = ['startWorkout', 'armStartWatchdog', 'clearStartWatchdog', 'armProvisionalTimeout', 'requestAuthorization',
    'endWorkout', 'failStart', 'handleWorkoutSessionStateChange', 'beginFencedPhoneStart', 'startFencedWorkoutNow',
    'discardProvisionalForFencedHandoff', 'startPendingFencedWorkoutIfIdle', 'discardFencedStart',
    'handlePhoneCommand', 'controlRejection', 'isStaleControlCommand', 'sendCommandAck', 'sendCapabilities'];
  const methods = names.map(name => member(watch, `${watch.includes(`private func ${name}(`) ? 'private ' : watch.includes(`fileprivate func ${name}(`) ? 'fileprivate ' : ''}func ${name}(`)).join('\n');
  const scheduler = 'enum PhoneScheduler { static var pending: [() -> Void] = []; static func enqueue(_ action: @escaping () -> Void) { pending.append(action) }; static func drain() { while !pending.isEmpty { pending.removeFirst()() } } }';
  const swift = read('scripts/tests/fixtures/watch-start-harness.swift')
    .replace('// PRODUCTION_PHONE', `${scheduler}\n${coordinator}`)
    .replace('// PRODUCTION_FENCE', read('targets/StrideOSWatch/StrideWatchStartFence.swift'))
    .replace('// PRODUCTION_WATCH_MEMBERS', `${member(watch, 'private var isDiscardingCurrentSession:')}\n${methods}`);
  // Keep a reviewable source extraction on failure without exposing user data.
  writeFileSync('/tmp/strideos-watch-start-source-test.swift', swift);
  const result = spawnSync('xcrun', ['swift', '-'], { input: swift, encoding: 'utf8', timeout: 90_000 });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /ALL WATCH START FENCE CASES PASSED/);
});
