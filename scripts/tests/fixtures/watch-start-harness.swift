import Foundation
setbuf(stdout, nil)
enum TestClock { static var seconds: Double = 1_800_000_000; static var ms: Double { seconds * 1000 } }
enum WCSessionActivationState { case activated, inactive, notActivated }
protocol WCSessionDelegate {}
final class WCSession {
  static var defaultSession = WCSession()
  static func isSupported() -> Bool { true }
  var activationState: WCSessionActivationState = .activated
  var isPaired = true; var isWatchAppInstalled = true; var isReachable = true
  var delegate: WCSessionDelegate?
  var messages: [[String: Any]] = []; var queued: [[String: Any]] = []; var contexts: [[String: Any]] = []
  var failures: [(Error) -> Void] = []; var failSynchronously = false
  func activate() {}
  func updateApplicationContext(_ payload: [String: Any]) throws { contexts.append(payload) }
  func sendMessage(_ payload: [String: Any], replyHandler: (([String: Any]) -> Void)?, errorHandler: @escaping (Error) -> Void) {
    messages.append(payload); failures.append(errorHandler)
    if failSynchronously && payload["type"] as? String == "startWorkout" { errorHandler(NSError(domain:"WC", code:7007)) }
  }
  func transferUserInfo(_ payload: [String: Any]) { queued.append(payload) }
}
enum HKWorkoutActivityType { case running, cycling, traditionalStrengthTraining, flexibility, walking, hiking, downhillSkiing, crossCountrySkiing, snowboarding }
enum HKWorkoutSessionLocationType { case indoor, outdoor }
final class HKWorkoutConfiguration { var activityType: HKWorkoutActivityType = .running; var locationType: HKWorkoutSessionLocationType = .outdoor }
typealias HKSampleType = String
enum HKQuantityTypeIdentifier: String { case heartRate, activeEnergyBurned, distanceWalkingRunning, distanceCycling }
enum HKObjectType {
  static func quantityType(forIdentifier value: HKQuantityTypeIdentifier) -> String? { value.rawValue }
  static func workoutType() -> String { "workout" }
}
final class HKHealthStore {
  static var launchCallbacks: [(Bool, Error?) -> Void] = []
  var authCallbacks: [(Bool, Error?) -> Void] = []
  static func isHealthDataAvailable() -> Bool { true }
  func startWatchApp(with configuration: HKWorkoutConfiguration, completion: @escaping (Bool, Error?) -> Void) { Self.launchCallbacks.append(completion) }
  func requestAuthorization(toShare: Set<String>, read: Set<String>, completion: @escaping (Bool, Error?) -> Void) { authCallbacks.append(completion) }
}
func settle() { Thread.sleep(forTimeInterval: 0.04) }
func eventually(_ predicate: () -> Bool) {
  let deadline = Date().addingTimeInterval(3)
  while !predicate() && Date() < deadline { Thread.sleep(forTimeInterval: 0.001) }
  precondition(predicate(), "asynchronous operation did not complete")
}
// PRODUCTION_PHONE
// PRODUCTION_FENCE
enum HKWorkoutSessionState: Int { case notStarted, running, paused, ended, prepared, stopped }
final class HKWorkoutSession {
  var state: HKWorkoutSessionState
  var endCount = 0
  init(_ state: HKWorkoutSessionState = .prepared) { self.state = state }
  func end() { endCount += 1; state = .ended }
}
final class FakeBuilder { var discarded = false; func discardWorkout() { discarded = true } }
final class FakePedometer { func stopUpdates() {} }
final class FakeHealthSetup { var inFlightId: String?; func enqueue(id: String, requestedAt: Double, now: Double) -> Bool { false } }
enum StrideWatchWorkoutKind: String, CaseIterable {
  case run, cycling
  var tracksDistance: Bool { true }
  static func from(_ value: String?) -> Self? { value == nil ? .run : Self(rawValue: value!) }
}
enum FakePage { case heartRate, elapsed }
enum StrideWatchStartTrail { static func mark(_ value: String, terminal: Bool = false) {} }
final class WatchScheduler {
  static let main = WatchScheduler(); var items: [DispatchWorkItem] = []
  func asyncAfter(deadline: DispatchTime, execute: DispatchWorkItem) { items.append(execute) }
}
final class WatchHarness {
  let startFence: StrideWatchStartFence
  let healthStore = HKHealthStore(); let healthSetup = FakeHealthSetup(); let pedometer = FakePedometer()
  var phoneStartIdentity: StrideWatchStartIdentity?; var startAttemptID = UUID()
  var pendingFencedStart: [String: Any]?; var pendingFencedPause: Bool?; var pendingPauseIdentity: StrideWatchStartIdentity?
  var session: HKWorkoutSession?; var builder: FakeBuilder?
  var isStartingWorkout = false; var isEnding = false; var isProvisionalLaunch = false
  weak var discardSession: HKWorkoutSession?; var discardWhenRunning = false
  var provisionalTimeout: DispatchWorkItem?; let provisionalLaunchWindowSeconds: Double = 60
  var startWatchdog: DispatchWorkItem?; var timer: Timer?
  var state: HKWorkoutSessionState = .notStarted
  var isActive: Bool { state == .running || state == .paused }
  var workoutInstanceId: String?; var workoutIdLabel = ""; var endedStateSentForWorkoutInstanceId: String?
  var selectedWorkoutKind: StrideWatchWorkoutKind = .run; var workoutEnvironment = "outdoor"; var targetZone: Int?
  var metricPage: FakePage = .heartRate; var lastError: String?; var healthKitLabel = ""; var statusLabel = "Running"
  var handledPhoneCommandKeys: [String] = []
  let stalePhoneCommandWindowMs: Double = 120_000; let stalePhoneContextWindowMs: Double = 14_400_000
  var outbound: [[String: Any]] = []; var emittedStates: [String] = []
  var errors: [String] = []; var saves = 0; var begins = 0; var metrics = 0; var pauses = 0
  init(fence: StrideWatchStartFence? = nil) { startFence = fence ?? StrideWatchStartFence(read: { nil }, write: { _ in }) }
  func onMain(_ body: @escaping () -> Void) { body() }
  func refreshConnectivityLabel() {}
  func noteCommand(_ type: String, via: String, result: String) {}
  func presentPendingHealthSetupWhenIdle() {}
  func applyPhoneContext(_ value: [String: Any]) {}
  func adoptPhoneStartIfProvisional(_ value: [String: Any]) -> Bool { false }
  func sendToPhone(_ payload: [String: Any]) { outbound.append(payload) }
  func publishError(_ value: String, startIdentity: StrideWatchStartIdentity? = nil) { errors.append(value) }
  func abandonRoute() {}
  func beginWorkout(kind: StrideWatchWorkoutKind, environment: String?) {
    begins += 1; metrics = 0; session = HKWorkoutSession(); builder = FakeBuilder()
  }
  func pauseWorkout() { pauses += 1; session?.state = .paused }
  func resumeWorkout() { session?.state = .running }
  func sendWorkoutState(_ value: String) { if !isProvisionalLaunch { emittedStates.append(value) } }
  func sendEndedStateOnce() { emittedStates.append("ended") }
  func stopRouteRecording() {}
  func finishRoute(for workout: String?) {}
  func finishBuilderIfNeeded() { saves += 1 }
  // PRODUCTION_WATCH_MEMBERS
}
func packet(_ id: String = "session", _ nonce: String = "N1", _ epoch: String = "E1", type: String = "startWorkout") -> [String: Any] {
  ["type":type, "workoutKind":"run", "workoutInstanceId":id, "startNonce":nonce, "ownerEpoch":epoch, "sentAt":TestClock.ms]
}
func receive(_ watch: WatchHarness, _ message: [String: Any], via: String = "msg") { watch.handlePhoneCommand(message, via: via) }
func running(_ watch: WatchHarness) { watch.session?.state = .running; watch.handleWorkoutSessionStateChange(.running) }
func finishDiscard(_ watch: WatchHarness) { watch.handleWorkoutSessionStateChange(.ended) }
func advertise(_ coordinator: StrideWatchConnectivityCoordinator, version: Int = 1) throws {
  let request = try coordinator.sendCommand("requestCapabilities", payload: [:])
  coordinator.session(WCSession.defaultSession, didReceiveMessage: ["type":"capabilities", "timestamp":TestClock.ms,
    "supportedWorkoutKinds":["run"], "startFenceProtocolVersion":version,
    "capabilityRequestNonce":request["capabilityRequestNonce"]!])
}
func newPhone() -> StrideWatchConnectivityCoordinator {
  WCSession.defaultSession = WCSession(); HKHealthStore.launchCallbacks = []
  return StrideWatchConnectivityCoordinator()
}
func requireEndFailure(_ phone: StrideWatchConnectivityCoordinator, _ id: String) {
  var rejected=false
  do { _ = try phone.endPreparedWorkout(id) } catch { rejected=true }
  precondition(rejected, "exact cleanup must retain its durable journal on native delivery failure")
}
func start(_ phone: StrideWatchConnectivityCoordinator, id: String = "session") throws -> (String, [String: Any]) {
  let nonce = phone.prepareWorkoutStart(id)
  try phone.startPreparedWorkout(nonce, payload: ["workoutInstanceId":id, "workoutKind":"run", "environment":"outdoor"])
  return (nonce, WCSession.defaultSession.contexts.last!)
}
func ack(_ phone: StrideWatchConnectivityCoordinator, _ original: [String: Any], accepted: Bool = true, reason: String? = nil) {
  var message = original; message["type"] = "commandAck"; message["command"] = "startWorkout"; message["accepted"] = accepted
  if let reason { message["reason"] = reason }
  phone.session(WCSession.defaultSession, didReceiveMessage: message)
}
// ADVERSARIAL_CASES
do {
  let phone = newPhone(); try advertise(phone)
  let (nonce, original) = try start(phone)
  precondition(phone.prepareWorkoutStart("session") == nonce)
  let failed = WCSession.defaultSession.failures.last!
  failed(NSError(domain:"WC",code:7007))
  PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.count == 1, "cached reachability must not suppress recovery launch")
  HKHealthStore.launchCallbacks[0](true,nil); PhoneScheduler.drain()
  let starts = WCSession.defaultSession.messages.filter { $0["type"] as? String == "startWorkout" }
  precondition(starts.count == 2 && NSDictionary(dictionary: starts[0]).isEqual(to: starts[1]))
  phone.sessionReachabilityDidChange(WCSession.defaultSession); PhoneScheduler.drain()
  precondition(WCSession.defaultSession.messages.filter { $0["type"] as? String == "startWorkout" }.count == 2)
  ack(phone,original); failed(NSError(domain:"WC",code:7007)); PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.count == 1)
  phone.cancelPendingStart()
  precondition(!WCSession.defaultSession.queued.contains { $0["type"] as? String == "cancelStart" }, "refresh must preserve accepted work")
  let end = try phone.endPreparedWorkout(nil)
  precondition(end != nil && WCSession.defaultSession.contexts.last?["startNonce"] as? String == nonce)
  print("PHONE recovery/exact retry/idempotent prepare/ACK-before-error/benign refresh/exact global End passed")
}
do {
  let phone = newPhone(); try advertise(phone)
  let (nonce, _) = try start(phone); let failed = WCSession.defaultSession.failures.last!
  phone.cancelPendingStart(revokeRemote:true); failed(NSError(domain:"WC",code:7007)); PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.isEmpty)
  do { try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"session","workoutKind":"run"]); preconditionFailure() } catch {}
  let fresh = phone.prepareWorkoutStart("session"); precondition(fresh != nonce)
  print("PHONE owner cancellation rejects late callback and queued old registration passed")
}
do {
  let phone = newPhone(); try advertise(phone)
  let (_, original) = try start(phone); let failed = WCSession.defaultSession.failures.last!
  var wrong = original; wrong["startNonce"] = "old"
  ack(phone,wrong); failed(NSError(domain:"WC",code:7007)); PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.count == 1)
  phone.cancelPendingStart(); HKHealthStore.launchCallbacks[0](true,nil); PhoneScheduler.drain()
  precondition(WCSession.defaultSession.messages.filter { $0["type"] as? String == "startWorkout" }.count == 1)
  let other = phone.prepareWorkoutStart("other")
  _ = try phone.sendCommand("endWorkout",payload:["workoutInstanceId":"session"])
  try phone.startPreparedWorkout(other,payload:["workoutInstanceId":"other","workoutKind":"run"])
  phone.sessionWatchStateDidChange(WCSession.defaultSession)
  precondition(phone.snapshot()["startFenceProtocolVersion"] as? Int == 0)
  print("PHONE stale ACK/old End/new token/cancelled launch completion/peer capability reset passed")
}
do {
  let phone = newPhone(); try advertise(phone,version:0)
  _ = try start(phone); WCSession.defaultSession.failures.last!(NSError(domain:"WC",code:7007)); PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.isEmpty)
  let second = newPhone(); try advertise(second); WCSession.defaultSession.failSynchronously = true
  _ = try start(second); PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.count == 1)
  let third = newPhone(); try advertise(third)
  let (_, original) = try start(third); let failed = WCSession.defaultSession.failures.last!
  ack(third,original,accepted:false,reason:"health_setup_in_progress")
  failed(NSError(domain:"WC",code:7007)); PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.isEmpty)
  print("PHONE old Watch opt-out/synchronous callback without deadlock/negative ACK terminal passed")
}
do {
  let phone = newPhone(); WCSession.defaultSession.activationState = .notActivated
  let nonce = phone.prepareWorkoutStart("cold")
  try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"cold","workoutKind":"run"])
  precondition(WCSession.defaultSession.messages.isEmpty)
  let beforeEndQueue=WCSession.defaultSession.queued.count
  requireEndFailure(phone,"cold")
  precondition(WCSession.defaultSession.queued.count == beforeEndQueue)
  WCSession.defaultSession.activationState = .activated
  phone.session(WCSession.defaultSession,activationDidCompleteWith:.activated,error:nil)
  precondition(!WCSession.defaultSession.messages.contains { $0["type"] as? String == "startWorkout" })
  precondition(WCSession.defaultSession.queued.contains { $0["type"] as? String == "endRecording" && $0["workoutInstanceId"] as? String == "cold" })
  let next = phone.prepareWorkoutStart("new-cold")
  WCSession.defaultSession.activationState = .notActivated
  try phone.startPreparedWorkout(next,payload:["workoutInstanceId":"new-cold","workoutKind":"run"])
  _ = try phone.sendCommand("pauseWorkout",payload:[:])
  WCSession.defaultSession.activationState = .activated
  phone.session(WCSession.defaultSession,activationDidCompleteWith:.activated,error:nil)
  precondition(WCSession.defaultSession.messages.contains { $0["type"] as? String == "startWorkout" && $0["startNonce"] as? String == next })
  let coldControls = WCSession.defaultSession.messages.filter { ["startWorkout", "pauseWorkout"].contains($0["type"] as? String ?? "") }
  precondition(coldControls.last?["type"] as? String == "pauseWorkout")
  precondition(coldControls.last?["startNonce"] as? String == next)
  print("PHONE cold activation queue/Stop before execution/global pause preservation passed")
}
do {
  let watch = WatchHarness(); let original = packet()
  receive(watch,packet(type:"endWorkout")); receive(watch,original)
  precondition(watch.healthStore.authCallbacks.isEmpty && watch.begins == 0)
  let startsFirst = WatchHarness(); receive(startsFirst,original)
  startsFirst.healthStore.authCallbacks[0](true,nil); running(startsFirst)
  receive(startsFirst,packet(type:"endWorkout")); receive(startsFirst,packet(type:"endWorkout"))
  precondition(startsFirst.session?.endCount == 1)
  startsFirst.handleWorkoutSessionStateChange(.ended)
  precondition(startsFirst.saves == 1)
  receive(startsFirst,original); precondition(startsFirst.begins == 1)
  print("WATCH End-before-Start / Start-before-End / no duplicate save or restart passed")
}
do {
  let watch = WatchHarness(); receive(watch,packet())
  let oldAuth = watch.healthStore.authCallbacks[0]
  receive(watch,packet(type:"cancelStart"))
  receive(watch,packet("session","N2","E2"))
  oldAuth(false,NSError(domain:"oldAuth",code:1))
  precondition(watch.errors.isEmpty && watch.begins == 0)
  watch.healthStore.authCallbacks[1](true,nil)
  precondition(watch.begins == 1)
  receive(watch,packet(type:"endWorkout"))
  precondition(watch.session?.endCount == 0)
  let denied = WatchHarness(); receive(denied,packet())
  denied.healthStore.authCallbacks[0](false,nil)
  precondition(denied.phoneStartIdentity == nil && !denied.isStartingWorkout)
  receive(denied,packet()); precondition(denied.healthStore.authCallbacks.count == 1)
  receive(denied,packet("session","N2","E1")); precondition(denied.healthStore.authCallbacks.count == 2)
  print("WATCH cancelled auth grants/denials cannot mutate new epoch; failed identity retired; genuine retry passed")
}
do {
  let watch = WatchHarness(); receive(watch,packet())
  watch.healthStore.authCallbacks[0](true,nil); running(watch)
  let builder = watch.builder!
  // No phone Running delivery is simulated. Actual HK state remains decisive.
  receive(watch,packet(type:"cancelStart")); receive(watch,packet(type:"cancelStart"))
  precondition(watch.session?.endCount == 1 && !builder.discarded)
  finishDiscard(watch)
  precondition(watch.saves == 1 && !builder.discarded)
  print("WATCH hard owner revocation preserves actual running Health workout despite lost status/ACK passed")
}
do {
  let watch = WatchHarness()
  watch.isProvisionalLaunch = true; watch.isStartingWorkout = true; watch.state = .running
  let old = HKWorkoutSession(.running); let builder = FakeBuilder()
  watch.session = old; watch.builder = builder; watch.metrics = 888
  watch.armProvisionalTimeout(); let staleTimeout = watch.provisionalTimeout!
  receive(watch,packet())
  precondition(old.endCount == 1 && watch.healthStore.authCallbacks.isEmpty)
  receive(watch,packet())
  precondition(watch.outbound.last?["accepted"] as? Bool == true, "duplicate pending start must ACK idempotently")
  receive(watch,packet(type:"pauseWorkout"))
  receive(watch,packet("old-session","old-N","old-E",type:"cancelStart"))
  finishDiscard(watch)
  precondition(builder.discarded && watch.saves == 0 && watch.healthStore.authCallbacks.count == 1)
  watch.healthStore.authCallbacks[0](true,nil); staleTimeout.perform()
  precondition(watch.metrics == 0 && watch.session !== old)
  running(watch)
  precondition(watch.pauses == 1 && !watch.emittedStates.contains("running"))
  let queued = WatchHarness(); receive(queued,packet(),via:"info")
  precondition(queued.healthStore.authCallbacks.isEmpty)
  var legacy = packet(); legacy.removeValue(forKey:"startNonce"); legacy.removeValue(forKey:"ownerEpoch")
  let oldPhone = WatchHarness(); receive(oldPhone,legacy)
  precondition(oldPhone.healthStore.authCallbacks.count == 1)
  print("WATCH fresh builder handoff / stale timeout / B pause survives A cancel / legacy / queued-start-ignore passed")
}
do {
  var bytes: Data?
  let fence = StrideWatchStartFence(read:{bytes},write:{bytes=$0})
  let identity = StrideWatchStartIdentity(packet())!
  precondition(fence.revoke(identity,now:TestClock.ms))
  let restarted = StrideWatchStartFence(read:{bytes},write:{bytes=$0})
  precondition(!restarted.allows(identity,sentAt:TestClock.ms+14_400_000,now:TestClock.ms+14_400_000))
  let corrupt = StrideWatchStartFence(read:{Data("bad".utf8)},write:{_ in})
  precondition(!corrupt.allows(identity,sentAt:TestClock.ms,now:TestClock.ms))
  let rollback = StrideWatchStartFence(read:{nil},write:{_ in})
  precondition(rollback.allows(identity,sentAt:TestClock.ms,now:TestClock.ms))
  precondition(!rollback.allows(identity,sentAt:TestClock.ms-6000,now:TestClock.ms-6000))
  var fullBytes: Data?
  let full = StrideWatchStartFence(read:{fullBytes},write:{fullBytes=$0})
  for index in 0..<128 { precondition(full.revoke(StrideWatchStartIdentity(packet("id\(index)","N\(index)"))!,now:TestClock.ms)) }
  precondition(!full.revoke(identity,now:TestClock.ms+1000))
  let fullRestart = StrideWatchStartFence(read:{fullBytes},write:{fullBytes=$0})
  precondition(!fullRestart.allows(identity,sentAt:TestClock.ms+2000,now:TestClock.ms+2000))
  print("WATCH persistent revocation / four-hour+skew / corruption / saturation / rollback passed")
}
print("ALL WATCH START FENCE CASES PASSED")
do {
  let phone = newPhone(); try advertise(phone)
  let (nonce, _) = try start(phone)
  phone.cancelPendingStart()
  precondition(!WCSession.defaultSession.queued.contains { $0["type"] as? String == "cancelStart" })
  _ = try phone.endPreparedWorkout("session")
  precondition(WCSession.defaultSession.contexts.last?["startNonce"] as? String == nonce)
  let unpaired = newPhone(); try advertise(unpaired)
  _ = try start(unpaired); let failed = WCSession.defaultSession.failures.last!
  WCSession.defaultSession.isPaired = false
  requireEndFailure(unpaired,"session")
  WCSession.defaultSession.isPaired = true
  failed(NSError(domain:"WC",code:7007)); PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.isEmpty)
  print("PHONE lost ACK benign cleanup preserves association; End fences even when pairing temporarily false passed")
}
do {
  let watch = WatchHarness(); receive(watch,packet("resume","original-N","original-E"))
  watch.healthStore.authCallbacks[0](true,nil); running(watch)
  let originalSession = watch.session!
  let phone = newPhone()
  let prepared = phone.prepareWorkoutStart("resume")
  let request = WCSession.defaultSession.messages.last!
  receive(watch,request)
  let response = watch.outbound.last!
  phone.session(WCSession.defaultSession,didReceiveMessage:response)
  try phone.startPreparedWorkout(prepared,payload:["workoutInstanceId":"resume","workoutKind":"run"])
  precondition(!WCSession.defaultSession.messages.contains { $0["type"] as? String == "startWorkout" })
  precondition(HKHealthStore.launchCallbacks.isEmpty && watch.session === originalSession)
  _ = try phone.endPreparedWorkout("resume")
  let end = WCSession.defaultSession.contexts.last!
  precondition(end["startNonce"] as? String == "original-N")
  receive(watch,end); precondition(originalSession.endCount == 1)
  print("RECOVERY fresh matching capability preserves original session/nonce and exact End after phone restart passed")
}
do {
  let phone = newPhone(); try advertise(phone)
  let (_, original) = try start(phone)
  let watch = WatchHarness(); receive(watch,original)
  ack(phone,original)
  watch.healthStore.authCallbacks[0](false,nil)
  let failed = watch.outbound.last { $0["type"] as? String == "commandAck" && $0["accepted"] as? Bool == false }!
  phone.session(WCSession.defaultSession,didReceiveMessage:failed)
  let next = phone.prepareWorkoutStart("session")
  precondition(next != original["startNonce"] as? String)
  try phone.startPreparedWorkout(next,payload:["workoutInstanceId":"session","workoutKind":"run"])
  let fresh = WCSession.defaultSession.contexts.last!
  receive(watch,fresh)
  precondition(watch.healthStore.authCallbacks.count == 2)
  watch.healthStore.authCallbacks[1](true,nil); running(watch)
  precondition(watch.begins == 1 && watch.session?.state == .running)
  precondition(HKHealthStore.launchCallbacks.isEmpty, "failure must not automatically launch")
  print("RETRY accepted ACK then denial retires exact attempt; explicit new nonce retry starts after grant passed")
}
print("RECOVERY AND FAILURE CASES PASSED")
for mode in ["end", "revoke", "peer-reset", "new-B", "end-auth"] {
  let watch = WatchHarness()
  receive(watch,packet("resume","original-N","original-E"))
  if mode != "end-auth" { watch.healthStore.authCallbacks[0](true,nil); running(watch) }
  let originalSession = watch.session
  let phone = newPhone()
  let nonce = phone.prepareWorkoutStart("resume")
  let request = WCSession.defaultSession.messages.last!
  receive(watch,request)
  let lateResponse = watch.outbound.last!
  try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"resume","workoutKind":"run"])
  receive(watch,WCSession.defaultSession.contexts.last!)
  if let rejected = watch.outbound.last, rejected["type"] as? String == "commandAck" {
    phone.session(WCSession.defaultSession,didReceiveMessage:rejected)
  }
  if mode == "revoke" { phone.cancelPendingStart(revokeRemote:true) }
  else { _ = try phone.endPreparedWorkout("resume") }
  var newerSession: HKWorkoutSession?
  var newerNonce: String?
  if mode == "peer-reset" { phone.sessionWatchStateDidChange(WCSession.defaultSession) }
  if mode == "new-B" {
    receive(watch,packet("resume","original-N","original-E",type:"endWorkout"))
    finishDiscard(watch)
    let next = phone.prepareWorkoutStart("B"); newerNonce = next
    try phone.startPreparedWorkout(next,payload:["workoutInstanceId":"B","workoutKind":"run"])
    receive(watch,WCSession.defaultSession.contexts.last!)
    watch.healthStore.authCallbacks.last!(true,nil); running(watch); newerSession = watch.session
  }
  let before = WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:lateResponse)
  let controls = WCSession.defaultSession.messages.dropFirst(before).filter { ["endWorkout","cancelStart","endRecording"].contains($0["type"] as? String ?? "") }
  if mode == "peer-reset" { precondition(controls.isEmpty && originalSession?.endCount == 0) }
  else {
    precondition(controls.count == 1)
    precondition(mode == "revoke" ? controls[0]["startNonce"] as? String == "original-N" : controls[0]["type"] as? String == "endRecording")
    precondition(controls[0]["workoutInstanceId"] as? String == "resume")
    receive(watch,controls[0])
    if mode == "new-B" {
      precondition(watch.session === newerSession && newerSession?.endCount == 0)
      precondition(phone.prepareWorkoutStart("B") == newerNonce)
    } else if mode == "end-auth" {
      watch.healthStore.authCallbacks[0](true,nil)
      precondition(watch.begins == 0)
    } else { precondition(originalSession?.endCount == 1) }
  }
}
print("LATE CAPABILITY End/revoke/peer-reset/new-B/pending-auth orderings passed")
do {
  let watch = WatchHarness(); receive(watch,packet("offline-resume","original-N","original-E"))
  watch.healthStore.authCallbacks[0](true,nil); running(watch)
  let original = watch.session!
  let phone = newPhone(); let nonce = phone.prepareWorkoutStart("offline-resume")
  receive(watch,WCSession.defaultSession.messages.last!); let lateResponse = watch.outbound.last!
  try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"offline-resume","workoutKind":"run"])
  WCSession.defaultSession.isPaired = false
  requireEndFailure(phone,"offline-resume")
  let before = WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:lateResponse)
  precondition(WCSession.defaultSession.messages.count == before && original.endCount == 0)
  WCSession.defaultSession.isPaired = true
  phone.sessionReachabilityDidChange(WCSession.defaultSession)
  let freshRequest = WCSession.defaultSession.messages.last!
  precondition(freshRequest["type"] as? String == "requestCapabilities")
  precondition(freshRequest["expectedWorkoutInstanceId"] as? String == "offline-resume")
  precondition(freshRequest["capabilityRequestNonce"] as? String != lateResponse["capabilityRequestNonce"] as? String)
  receive(watch,freshRequest); let reply = watch.outbound.last!
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  let exactEnd = WCSession.defaultSession.messages.last!
  precondition(exactEnd["type"] as? String == "endRecording" && exactEnd["workoutInstanceId"] as? String == "offline-resume")
  receive(watch,exactEnd); receive(watch,WCSession.defaultSession.queued.last!,via:"info")
  precondition(original.endCount == 1)
  watch.handleWorkoutSessionStateChange(.ended); precondition(watch.saves == 1)
  let delivered = WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  precondition(WCSession.defaultSession.messages.count == delivered)
}
print("UNPAIRED End retained through fresh correlated reconnect, exact original End/save once passed")
do {
  let phone = newPhone(); try advertise(phone)
  let (_, original) = try start(phone)
  ack(phone,original,accepted:false,reason:"Watch start safety data could not be read. Phone recording can continue.")
  precondition((phone.snapshot()["lastError"] as? String)?.contains("could not be read") == true)
  let next = phone.prepareWorkoutStart("new-visible")
  try phone.startPreparedWorkout(next,payload:["workoutInstanceId":"new-visible","workoutKind":"run"])
  let current = WCSession.defaultSession.contexts.last!
  ack(phone,current)
  ack(phone,original,accepted:false,reason:"old failure")
  precondition(phone.snapshot()["lastError"] is NSNull)
}
print("VISIBLE scoped negative ACK and stale old error isolation passed")
for mode in ["running", "pending-auth", "unpaired", "unrelated", "new-B", "legacy"] {
  let watch = WatchHarness()
  if mode == "legacy" {
    var legacy = packet("cold-stop"); legacy.removeValue(forKey:"startNonce"); legacy.removeValue(forKey:"ownerEpoch")
    receive(watch,legacy)
  } else { receive(watch,packet(mode == "unrelated" ? "B" : "cold-stop","original-N","original-E")) }
  if mode != "pending-auth" { watch.healthStore.authCallbacks[0](true,nil); running(watch) }
  let original = watch.session
  let phone = newPhone()
  if mode == "unpaired" { WCSession.defaultSession.isPaired = false }
  let association:[String:Any]?
  association = try phone.endPreparedWorkout("cold-stop")
  precondition(association == nil)
  if mode == "unpaired" {
    precondition(WCSession.defaultSession.messages.isEmpty)
    WCSession.defaultSession.isPaired = true
    phone.sessionReachabilityDidChange(WCSession.defaultSession)
  }
  let request = WCSession.defaultSession.messages.last!
  precondition(request["type"] as? String == "requestCapabilities" && request["expectedWorkoutInstanceId"] as? String == "cold-stop")
  receive(watch,request); var reply = watch.outbound.last!
  if mode == "legacy" { reply["startFenceProtocolVersion"] = 0; reply.removeValue(forKey:"activeStart") }
  // This is the actual wrapper's unchanged legacy fallback after sync nil.
  _ = try phone.sendCommand("endWorkout",payload:["workoutInstanceId":"cold-stop"])
  receive(watch,WCSession.defaultSession.messages.last!)
  var newer: HKWorkoutSession?
  if mode == "new-B" {
    receive(watch,packet("cold-stop","original-N","original-E",type:"endWorkout")); finishDiscard(watch)
    receive(watch,packet("B","new-N","new-E")); watch.healthStore.authCallbacks.last!(true,nil); running(watch); newer = watch.session
  }
  let before = WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  let controls = WCSession.defaultSession.messages.dropFirst(before).filter { $0["type"] as? String == "endRecording" }
  if ["unrelated","legacy"].contains(mode) {
    precondition(controls.isEmpty)
    precondition(original?.endCount == (mode == "legacy" ? 1 : 0))
  } else {
    precondition(controls.count == 1 && controls[0]["workoutInstanceId"] as? String == "cold-stop" && controls[0]["startNonce"] == nil)
    receive(watch,controls[0]); receive(watch,WCSession.defaultSession.queued.last!,via:"info")
    if mode == "new-B" { precondition(watch.session === newer && newer?.endCount == 0) }
    else if mode == "pending-auth" { watch.healthStore.authCallbacks[0](true,nil); precondition(watch.begins == 0) }
    else { precondition(original?.endCount == 1); watch.handleWorkoutSessionStateChange(.ended); precondition(watch.saves == 1) }
  }
  precondition(!WCSession.defaultSession.messages.contains { ["startWorkout","startRun"].contains($0["type"] as? String ?? "") })
  precondition(HKHealthStore.launchCallbacks.isEmpty)
}
print("COLD RecoveryPrompt Stop without prepare: running/auth/unpaired/unrelated/new-B/legacy exact End only passed")
for intent in ["pauseWorkout", "resumeWorkout", "endWorkout"] {
  let watch = WatchHarness(); receive(watch,packet("resume-control","original-N","original-E"))
  watch.healthStore.authCallbacks[0](true,nil); running(watch)
  if intent == "resumeWorkout" { watch.pauseWorkout() }
  let original = watch.session!
  let phone = newPhone(); let nonce = phone.prepareWorkoutStart("resume-control")
  receive(watch,WCSession.defaultSession.messages.last!); let reply = watch.outbound.last!
  try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"resume-control","workoutKind":"run"])
  _ = try phone.sendExplicitWorkoutControl("pauseWorkout",id:"resume-control")
  if intent == "endWorkout" { _ = try phone.endPreparedWorkout("resume-control") }
  else if intent == "resumeWorkout" { _ = try phone.sendExplicitWorkoutControl(intent,id:"resume-control") }
  let before = WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  let controls = WCSession.defaultSession.messages.dropFirst(before).filter { ["pauseWorkout","resumeWorkout","endWorkout","endRecording"].contains($0["type"] as? String ?? "") }
  precondition(controls.count == 1 && controls[0]["type"] as? String == (intent == "endWorkout" ? "endRecording" : intent))
  precondition(intent == "endWorkout" ? controls[0]["startNonce"] == nil : controls[0]["startNonce"] as? String == "original-N")
  receive(watch,controls[0])
  if intent == "pauseWorkout" {
    precondition(original.state == .paused && watch.pauses == 1)
    let oldFailure = WCSession.defaultSession.failures.last!
    _ = try phone.sendExplicitWorkoutControl("resumeWorkout",id:"resume-control")
    receive(watch,WCSession.defaultSession.messages.last!)
    let queued = WCSession.defaultSession.queued.count
    oldFailure(NSError(domain:"WC",code:7007)); PhoneScheduler.drain()
    precondition(WCSession.defaultSession.queued.count == queued && original.state == .running)
  }
  else if intent == "resumeWorkout" { precondition(original.state == .running) }
  else { precondition(original.endCount == 1) }
  let delivered = WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  precondition(WCSession.defaultSession.messages.count == delivered)
  precondition(HKHealthStore.launchCallbacks.isEmpty)
}
print("RECOVERY latest explicit Pause/Resume applied once to original tuple; terminal End wins passed")
for prepared in [false,true] {
  var disk: Data?
  let fence = StrideWatchStartFence(read:{disk},write:{disk=$0})
  let watch=WatchHarness(fence:fence);let phone=newPhone()
  var pending: [String:Any]?
  if prepared { let nonce=phone.prepareWorkoutStart("ended-ID");try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"ended-ID","workoutKind":"run"]);pending=WCSession.defaultSession.contexts.last }
  _ = try phone.endPreparedWorkout("ended-ID")
  let terminal=WCSession.defaultSession.messages.first { $0["type"] as? String == "endRecording" }!
  precondition(terminal["workoutInstanceId"] as? String == "ended-ID" && terminal["startNonce"] == nil)
  precondition(WCSession.defaultSession.queued.contains { $0["type"] as? String == "endRecording" && $0["workoutInstanceId"] as? String == "ended-ID" && $0["sentAt"] as? Double == terminal["sentAt"] as? Double })
  // No capability reply has been received. Stop must already be on the wire.
  receive(watch,terminal)
  receive(watch,packet("ended-ID","unknown-N1","old-E"))
  if let pending { receive(watch,pending) }
  receive(watch,packet("ended-ID","new-N2","new-E"))
  precondition(watch.healthStore.authCallbacks.isEmpty && watch.begins == 0)
  let relaunched=WatchHarness(fence:StrideWatchStartFence(read:{disk},write:{disk=$0}))
  receive(relaunched,packet("ended-ID","unknown-N3","new-E"))
  precondition(relaunched.healthStore.authCallbacks.isEmpty)
  receive(relaunched,packet("new-UUID-B","N4","new-E"))
  precondition(relaunched.healthStore.authCallbacks.count == 1)
  precondition(HKHealthStore.launchCallbacks.isEmpty)
}
do {
  let watch=WatchHarness();receive(watch,packet("retry-ID","N1","E1",type:"endWorkout"))
  receive(watch,packet("retry-ID","N2","E1"));watch.healthStore.authCallbacks[0](true,nil);running(watch)
  let current=watch.session!
  receive(watch,packet("retry-ID","N1","E1",type:"cancelStart"));receive(watch,packet("retry-ID","N1","E1",type:"endWorkout"))
  precondition(current.endCount == 0 && current.state == .running)
  var logical=packet("retry-ID",type:"endRecording");logical.removeValue(forKey:"startNonce");logical.removeValue(forKey:"ownerEpoch")
  receive(watch,logical);receive(watch,logical,via:"info");precondition(current.endCount == 1)
  watch.handleWorkoutSessionStateChange(.ended);precondition(watch.saves == 1)
  receive(watch,packet("retry-ID","N3","E1"));precondition(watch.healthStore.authCallbacks.count == 1)
  let oldFormat = Data("{\"revocations\":[],\"lastClock\":0}".utf8)
  let migrated=StrideWatchStartFence(read:{oldFormat},write:{_ in})
  precondition(migrated.allows(StrideWatchStartIdentity(packet())!,sentAt:TestClock.ms,now:TestClock.ms))
  var disk:Data?;let mixed=StrideWatchStartFence(read:{disk},write:{disk=$0})
  for n in 0..<64 { precondition(mixed.revoke(StrideWatchStartIdentity(packet("x\(n)"))!,now:TestClock.ms));precondition(mixed.endRecording("ended\(n)",now:TestClock.ms)) }
  precondition(!mixed.endRecording("overflow",now:TestClock.ms))
  let restarted=StrideWatchStartFence(read:{disk},write:{disk=$0})
  precondition(!restarted.allows(StrideWatchStartIdentity(packet("unrelated"))!,sentAt:TestClock.ms,now:TestClock.ms))
}
print("LOGICAL End immediate before unknown live Start, prepared restart, persistent relaunch, new-B, exact-attempt retry and shared capacity passed")
do {
  let phone=newPhone();WCSession.defaultSession.isPaired=false
  let absent = try phone.endPreparedWorkout("offline-ended");precondition(absent == nil)
  phone.cancelPendingStart(revokeRemote:true)
  WCSession.defaultSession.isPaired=true;phone.sessionReachabilityDidChange(WCSession.defaultSession)
  let terminal=WCSession.defaultSession.messages.first { $0["type"] as? String == "endRecording" }!
  let watch=WatchHarness();receive(watch,terminal);receive(watch,packet("offline-ended","unknown-N","old-E"))
  precondition(watch.healthStore.authCallbacks.isEmpty)
}
for mode in ["pause", "resume", "End", "owner", "peer", "new-B", "expired", "generic", "failed-old"] {
  let watch=WatchHarness();receive(watch,packet("cold-control","original-N","original-E"))
  watch.healthStore.authCallbacks[0](true,nil);running(watch)
  let original=watch.session!
  if mode == "resume" { watch.pauseWorkout() }
  let phone=newPhone()
  _ = try phone.sendExplicitWorkoutControl("pauseWorkout",id:"cold-control")
  let firstRequest=WCSession.defaultSession.messages.last!;receive(watch,firstRequest);let oldReply=watch.outbound.last!
  var reply=oldReply
  if mode == "resume" {
    _ = try phone.sendExplicitWorkoutControl("resumeWorkout",id:"cold-control")
    receive(watch,WCSession.defaultSession.messages.last!);reply=watch.outbound.last!
    let count=WCSession.defaultSession.messages.count;phone.session(WCSession.defaultSession,didReceiveMessage:oldReply)
    precondition(WCSession.defaultSession.messages.count == count)
  } else if mode == "End" {
    _ = try phone.endPreparedWorkout("cold-control")
    receive(watch,WCSession.defaultSession.messages.last { $0["type"] as? String == "endRecording" }!)
  }
  else if mode == "owner" { phone.cancelPendingStart(revokeRemote:true) }
  else if mode == "peer" { phone.sessionWatchStateDidChange(WCSession.defaultSession) }
  else if mode == "expired" { TestClock.seconds += 91 }
  else if mode == "generic" { _ = try phone.sendCommand("resumeWorkout",payload:["workoutInstanceId":"cold-control"]) }
  var newer:HKWorkoutSession?
  if mode == "new-B" {
    receive(watch,packet("cold-control","original-N","original-E",type:"endWorkout"));finishDiscard(watch)
    receive(watch,packet("new-B","B-N","B-E"));watch.healthStore.authCallbacks.last!(true,nil);running(watch);newer=watch.session
  }
  let before=WCSession.defaultSession.messages.count;let queued=WCSession.defaultSession.queued.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  let controls=Array(WCSession.defaultSession.messages.dropFirst(before))
  if ["peer","expired","generic","End"].contains(mode) {
    precondition(controls.isEmpty)
    if mode == "End" { precondition(original.endCount == 1) }
  }
  else {
    precondition(controls.count == 1)
    let expected=mode == "End" ? "endRecording" : mode == "owner" ? "cancelStart" : mode == "resume" ? "resumeWorkout" : "pauseWorkout"
    precondition(controls[0]["type"] as? String == expected)
    if expected != "endRecording" { precondition(controls[0]["startNonce"] as? String == "original-N") }
    let failure=WCSession.defaultSession.failures.last!
    receive(watch,controls[0])
    if mode == "pause" { precondition(original.state == .paused) }
    if mode == "resume" { precondition(original.state == .running) }
    if mode == "new-B" { precondition(watch.session === newer && newer?.state == .running && watch.pauses == 0) }
    if mode == "failed-old" {
      _ = try phone.sendExplicitWorkoutControl("resumeWorkout",id:"cold-control")
      failure(NSError(domain:"WC",code:7007));PhoneScheduler.drain()
      precondition(WCSession.defaultSession.queued.count == queued)
    }
    if ["pause","resume","failed-old","new-B"].contains(mode) { precondition(WCSession.defaultSession.queued.count == queued) }
  }
  let count=WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  precondition(WCSession.defaultSession.messages.count == count)
  precondition(!WCSession.defaultSession.messages.contains { ["startWorkout","startRun"].contains($0["type"] as? String ?? "") })
  precondition(HKHealthStore.launchCallbacks.isEmpty)
}
do {
  let phone=newPhone()
  _ = try phone.sendCommand("resumeWorkout",payload:["workoutInstanceId":"cold-auto"])
  precondition(!WCSession.defaultSession.messages.contains { $0["type"] as? String == "requestCapabilities" })
}
do {
  let watch=WatchHarness();receive(watch,packet("auto-recovery","original-N","original-E"))
  watch.healthStore.authCallbacks[0](true,nil);running(watch);watch.pauseWorkout()
  let phone=newPhone();let nonce=phone.prepareWorkoutStart("auto-recovery")
  receive(watch,WCSession.defaultSession.messages.last!);let reply=watch.outbound.last!
  try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"auto-recovery","workoutKind":"run"])
  _ = try phone.sendCommand("resumeWorkout",payload:["workoutInstanceId":"auto-recovery"])
  let before=WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  precondition(WCSession.defaultSession.messages.count == before && watch.session?.state == .paused)
}
print("COLD explicit Pause/Resume without prepare: latest-only/live-only/End/owner/peer/new-B/expiry/failure; generic auto never looks up or starts passed")
do {
  let watch=WatchHarness();receive(watch,packet("readonly-resume","original-N","original-E"))
  watch.healthStore.authCallbacks[0](true,nil);running(watch);watch.pauseWorkout()
  let originalSession=watch.session!;let originalBuilder=watch.builder!
  let phone=newPhone();_ = phone.prepareWorkoutStart("readonly-resume")
  let request=WCSession.defaultSession.messages.last!;receive(watch,request);let reply=watch.outbound.last!
  // A persisted auto decision is generic, and must not replay when discovered.
  _ = try phone.sendCommand("resumeWorkout",payload:["workoutInstanceId":"readonly-resume"])
  let before=WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  precondition(WCSession.defaultSession.messages.count == before && originalSession.state == .paused)
  for type in ["pauseWorkout","resumeWorkout"] {
    _ = try phone.sendCommand(type,payload:["workoutInstanceId":"readonly-resume"])
    let command=WCSession.defaultSession.messages.last!
    precondition(command["startNonce"] as? String == "original-N" && command["ownerEpoch"] as? String == "original-E")
    receive(watch,command)
  }
  precondition(originalSession.state == .running && watch.session === originalSession && watch.builder === originalBuilder && watch.begins == 1)
  precondition(!WCSession.defaultSession.messages.contains { ["startWorkout","startRun"].contains($0["type"] as? String ?? "") })
  precondition(HKHealthStore.launchCallbacks.isEmpty)
  let unavailable=newPhone();_ = unavailable.prepareWorkoutStart("no-reply")
  unavailable.sessionReachabilityDidChange(WCSession.defaultSession)
  precondition(!WCSession.defaultSession.messages.contains { ["startWorkout","startRun"].contains($0["type"] as? String ?? "") })
  precondition(HKHealthStore.launchCallbacks.isEmpty)
}
print("READONLY actual Resume prepare without Start: no generic replay/new builder/HK launch, future generic controls retain original identity passed")
do {
  let phone=newPhone();let (_,original)=try start(phone,id:"long-running")
  let watch=WatchHarness();receive(watch,original);watch.healthStore.authCallbacks[0](true,nil);running(watch)
  ack(phone,original);phone.cancelPendingStart()
  TestClock.seconds += 3_601
  _ = try phone.sendCommand("requestCapabilities",payload:[:]) // prune normal discovery expectations
  WCSession.defaultSession.isPaired=false
  requireEndFailure(phone,"long-running")
  WCSession.defaultSession.isPaired=true
  let before=WCSession.defaultSession.messages.count
  phone.sessionReachabilityDidChange(WCSession.defaultSession)
  let terminal=WCSession.defaultSession.messages.dropFirst(before).first { $0["type"] as? String == "endRecording" }!
  receive(watch,terminal);receive(watch,terminal,via:"info")
  precondition(watch.session?.endCount == 1)
  watch.handleWorkoutSessionStateChange(.ended);precondition(watch.saves == 1)
}
print("LONG acknowledged association after normal discovery expiry retains explicit offline End through reconnection passed")
do {
  let phone=newPhone()
  // Each cold End retains its base intent and echoed discovery request.
  for n in 0..<16 { _ = try phone.endPreparedWorkout("queued-end-\(n)") }
  let nonce=phone.prepareWorkoutStart("full-target")
  try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"full-target","workoutKind":"run"])
  let startPacket=WCSession.defaultSession.contexts.last!;let failedStart=WCSession.defaultSession.failures.last!
  let watch=WatchHarness();receive(watch,startPacket);watch.healthStore.authCallbacks[0](true,nil);running(watch)
  WCSession.defaultSession.isPaired=false
  var rejected=false
  do { _ = try phone.endPreparedWorkout("full-target") } catch { rejected=true }
  precondition(rejected && phone.snapshot()["lastError"] as? String != nil)
  failedStart(NSError(domain:"WC",code:7007));PhoneScheduler.drain()
  precondition(HKHealthStore.launchCallbacks.isEmpty)
  TestClock.seconds += 14_406;WCSession.defaultSession.isPaired=true
  _ = try phone.endPreparedWorkout("full-target")
  receive(watch,WCSession.defaultSession.messages.last { $0["type"] as? String == "endRecording" }!)
  precondition(watch.session?.endCount == 1)
}
print("PHONE terminal intent saturation throws for exact cleanup retry, fences Start, then permits End after expiry passed")
for mode in ["no-watch", "no-app", "readonly", "unknown-activation", "unsubmitted-message", "full-no-watch"] {
  let phone=newPhone()
  if mode == "full-no-watch" { for n in 0..<16 { _ = try phone.endPreparedWorkout("other-end-\(n)") } }
  if ["readonly","unknown-activation","unsubmitted-message"].contains(mode) { _ = phone.prepareWorkoutStart("phone-only") }
  if mode == "unsubmitted-message" {
    WCSession.defaultSession.activationState = .notActivated
    let nonce=phone.prepareWorkoutStart("phone-only")
    try phone.startPreparedWorkout(nonce,payload:["workoutInstanceId":"phone-only","workoutKind":"run"])
    WCSession.defaultSession.activationState = .activated
  }
  if mode == "no-app" { WCSession.defaultSession.isWatchAppInstalled=false }
  else { WCSession.defaultSession.isPaired=false }
  if mode == "unknown-activation" { WCSession.defaultSession.activationState = .notActivated; requireEndFailure(phone,"phone-only") }
  else { let result=try phone.endPreparedWorkout("phone-only");precondition(result == nil) }
  let before=WCSession.defaultSession.messages.count
  WCSession.defaultSession.isPaired=true;WCSession.defaultSession.isWatchAppInstalled=true
  WCSession.defaultSession.activationState = .activated
  phone.sessionReachabilityDidChange(WCSession.defaultSession)
  precondition(!WCSession.defaultSession.messages.dropFirst(before).contains { ["startWorkout","startRun"].contains($0["type"] as? String ?? "") })
  precondition(HKHealthStore.launchCallbacks.isEmpty)
}
print("OPTIONAL Watch activated absence permits phone-only/read-only/unsubmitted/capacity cleanup; inactive flags remain unknown and no Start can escape passed")
do {
  let watch=WatchHarness();receive(watch,packet("expired-readonly","original-N","original-E"))
  watch.healthStore.authCallbacks[0](true,nil);running(watch)
  let original=watch.session!;let originalBuilder=watch.builder!
  let phone=newPhone();_ = phone.prepareWorkoutStart("expired-readonly")
  TestClock.seconds += 91 // the initial read-only capability request was lost
  _ = try phone.sendExplicitWorkoutControl("pauseWorkout",id:"expired-readonly")
  let fresh=WCSession.defaultSession.messages.last!
  precondition(fresh["type"] as? String == "requestCapabilities", "explicit Pause must refresh expired read-only discovery")
  receive(watch,fresh);let reply=watch.outbound.last!
  let before=WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:reply)
  let control=WCSession.defaultSession.messages.dropFirst(before).first { $0["type"] as? String == "pauseWorkout" }!
  precondition(control["startNonce"] as? String == "original-N")
  receive(watch,control)
  precondition(original.state == .paused && watch.session === original && watch.builder === originalBuilder && watch.begins == 1)
  for type in ["resumeWorkout","pauseWorkout"] {
    TestClock.seconds += 1 // newly issued decisions, rather than duplicate packets
    _ = try phone.sendCommand(type,payload:["workoutInstanceId":"expired-readonly"])
    let next=WCSession.defaultSession.messages.last!
    precondition(next["type"] as? String == type && next["startNonce"] as? String == "original-N")
    receive(watch,next)
  }
  precondition(original.state == .paused && watch.session === original && watch.builder === originalBuilder)
  precondition(!WCSession.defaultSession.messages.contains { ["startWorkout","startRun"].contains($0["type"] as? String ?? "") })
  precondition(HKHealthStore.launchCallbacks.isEmpty)
}
print("EXPIRED read-only discovery refreshes only explicit controls and preserves original session without Start/HK passed")
for replacement in ["same-ID", "different-B", "End"] {
  let watch=WatchHarness();receive(watch,packet("stale-readonly","original-N","original-E"))
  watch.healthStore.authCallbacks[0](true,nil);running(watch)
  let phone=newPhone();_ = phone.prepareWorkoutStart("stale-readonly");TestClock.seconds += 91
  _ = try phone.sendExplicitWorkoutControl("pauseWorkout",id:"stale-readonly")
  receive(watch,WCSession.defaultSession.messages.last!);let oldReply=watch.outbound.last!
  let nextId=replacement == "same-ID" ? "stale-readonly" : "B"
  var nextNonce:String?
  if replacement == "End" { _ = try phone.endPreparedWorkout("stale-readonly") }
  else { nextNonce=phone.prepareWorkoutStart(nextId) }
  let before=WCSession.defaultSession.messages.count
  phone.session(WCSession.defaultSession,didReceiveMessage:oldReply)
  let after=Array(WCSession.defaultSession.messages.dropFirst(before))
  if replacement == "same-ID" || replacement == "End" { precondition(after.isEmpty) }
  if replacement != "End" { precondition(phone.prepareWorkoutStart(nextId) == nextNonce) }
  precondition(!after.contains { ["startWorkout","startRun"].contains($0["type"] as? String ?? "") })
  precondition(HKHealthStore.launchCallbacks.isEmpty)
}
print("EXPIRED explicit lookup cannot retire/cache over newer same-ID/B token or terminal End passed")
