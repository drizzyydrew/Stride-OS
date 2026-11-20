import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('actual HealthKit cold-launch handler starts Other with unknown environment and preserves legacy Run + active guards', { skip: process.platform !== 'darwin' }, () => {
  const source = readFileSync('targets/StrideOSWatch/StrideWatchWorkoutManager.swift', 'utf8');
  const start = source.indexOf('  func startProvisionalWorkoutFromLaunch(');
  assert.ok(start > 0);
  const brace = source.indexOf('{', start);
  let depth = 1, end = brace + 1;
  while (depth && end < source.length) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; end++; }
  const method = source.slice(start, end);
  const swift = `import Foundation
  enum HKWorkoutActivityType { case other, running, cycling, traditionalStrengthTraining, flexibility, walking, hiking, downhillSkiing, crossCountrySkiing, snowboarding, unsupported }
  enum HKWorkoutSessionLocationType { case unknown, indoor, outdoor }
  struct HKWorkoutConfiguration { var activityType: HKWorkoutActivityType; var locationType: HKWorkoutSessionLocationType }
  enum StrideWatchWorkoutKind: String { case other, run, cycling, strength, mobility, walking, hiking, downhillSkiing, crossCountrySkiing, snowboarding }
  enum StrideWatchStartTrail { static func mark(_ text: String) {} }
  final class Launch {
    var isActive = false; var isStartingWorkout = false; var isProvisionalLaunch = false
    var calls: [(StrideWatchWorkoutKind, String, String)] = []; var errors: [String] = []; var timeouts = 0
    func onMain(_ action: () -> Void) { action() }
    func scheduleConnectivityActivation(reportErrors: Bool, delay: Double) {}
    func publishError(_ text: String) { errors.append(text) }
    func armProvisionalTimeout() { timeouts += 1 }
    func startWorkout(kind: StrideWatchWorkoutKind, title: String?, workoutInstanceId: String, environment: String, targetZone: Int?) -> String? {
      calls.append((kind, environment, workoutInstanceId)); return nil
    }
    ${method}
  }
  let open = Launch(); open.startProvisionalWorkoutFromLaunch(.init(activityType: .other, locationType: .unknown))
  precondition(open.calls.count == 1 && open.calls[0].0 == .other && open.calls[0].1 == "unknown")
  precondition(open.calls[0].2.hasPrefix("launch_") && open.isProvisionalLaunch && open.timeouts == 1 && open.errors.isEmpty)
  let run = Launch(); run.startProvisionalWorkoutFromLaunch(.init(activityType: .running, locationType: .outdoor))
  precondition(run.calls.count == 1 && run.calls[0].0 == .run && run.calls[0].1 == "outdoor")
  let active = Launch(); active.isActive = true; active.startProvisionalWorkoutFromLaunch(.init(activityType: .other, locationType: .unknown)); precondition(active.calls.isEmpty)
  let busy = Launch(); busy.isStartingWorkout = true; busy.startProvisionalWorkoutFromLaunch(.init(activityType: .other, locationType: .unknown)); precondition(busy.calls.isEmpty)
  let unknown = Launch(); unknown.startProvisionalWorkoutFromLaunch(.init(activityType: .unsupported, locationType: .unknown)); precondition(unknown.calls.isEmpty && unknown.errors == ["Unsupported workout type"])
  print("OPEN_LAUNCH_PASS")`;
  const result = spawnSync('xcrun', ['swift', '-'], { input: swift, encoding: 'utf8', timeout: 90_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OPEN_LAUNCH_PASS/);
  assert.doesNotMatch(method, /Int\(Date\(\).timeIntervalSince1970 \* 1000\)/);
});
