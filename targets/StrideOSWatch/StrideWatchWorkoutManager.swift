import Combine
import Foundation
import HealthKit
import WatchConnectivity

enum StrideWatchWorkoutKind: String, CaseIterable, Identifiable {
  case run
  case strength
  case mobility
  case cycling

  var id: String { rawValue }

  var title: String {
    switch self {
    case .run: return "Run"
    case .strength: return "Strength"
    case .mobility: return "Mobility"
    case .cycling: return "Cycling"
    }
  }

  var workoutTitle: String {
    switch self {
    case .run: return "StrideOS Run"
    case .strength: return "StrideOS Strength"
    case .mobility: return "StrideOS Mobility"
    case .cycling: return "StrideOS Ride"
    }
  }

  var symbolName: String {
    switch self {
    case .run: return "figure.run"
    case .strength: return "dumbbell.fill"
    case .mobility: return "figure.cooldown"
    case .cycling: return "bicycle"
    }
  }

  var activityType: HKWorkoutActivityType {
    switch self {
    case .run: return .running
    case .strength: return .traditionalStrengthTraining
    case .mobility: return .flexibility
    case .cycling: return .cycling
    }
  }

  var distanceIdentifier: HKQuantityTypeIdentifier? {
    switch self {
    case .run: return .distanceWalkingRunning
    case .cycling: return .distanceCycling
    case .strength, .mobility: return nil
    }
  }

  var tracksDistance: Bool {
    distanceIdentifier != nil
  }

  static func from(_ value: String?) -> StrideWatchWorkoutKind {
    guard let value, let kind = StrideWatchWorkoutKind(rawValue: value) else { return .run }
    return kind
  }
}

enum StrideWatchMetricPage: Int, CaseIterable, Identifiable {
  case elapsed
  case heartRate
  case distance
  case pace
  case heartRateZone
  case energy

  var id: Int { rawValue }

  var title: String {
    switch self {
    case .elapsed: return "Time"
    case .heartRate: return "Heart Rate"
    case .distance: return "Distance"
    case .pace: return "Pace"
    case .heartRateZone: return "HR Zone"
    case .energy: return "Energy"
    }
  }
}

final class StrideWatchWorkoutManager: NSObject, ObservableObject {
  static let shared = StrideWatchWorkoutManager()

  @Published private(set) var heartRateBpm: Int?
  @Published private(set) var state: HKWorkoutSessionState = .notStarted
  @Published private(set) var elapsedSeconds: Int = 0
  @Published private(set) var lastError: String?
  @Published private(set) var selectedWorkoutKind: StrideWatchWorkoutKind = .run
  @Published private(set) var distanceMeters: Double = 0
  @Published private(set) var activeEnergyKilocalories: Double = 0
  @Published private(set) var pendingSyncCount: Int = 0
  @Published private(set) var preferredUnitSystem: String = "imperial"
  @Published private(set) var metricPage: StrideWatchMetricPage = .heartRate
  @Published private(set) var isStartingWorkout: Bool = false
  // Runtime diagnostics shown on the watch screen (main thread only).
  @Published private(set) var connectivityLabel: String = "WC: not activated"
  @Published private(set) var lastCommandLabel: String = "Cmd: none"
  @Published private(set) var healthKitLabel: String = "HK: idle"
  @Published private(set) var workoutIdLabel: String = "ID: --"
  /// Where the previous workout start ended up. When the last recorded step is
  /// not terminal, the app was killed during that step (i.e. it crashed there).
  @Published private(set) var startTrailLabel: String?
  @Published private(set) var startTrailCrashed: Bool = false

  private var maxHeartRateBpm: Int = 190
  private var targetZone: Int?

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var workoutInstanceId: String?
  private var workoutEnvironment: String = "outdoor"
  private var startedAt: Date?
  private var pausedAt: Date?
  private var pausedSeconds: TimeInterval = 0
  private var timer: Timer?
  private var endedStateSentForWorkoutInstanceId: String?
  private var handledPhoneCommandKeys: [String] = []
  private var isEnding = false
  private var startWatchdog: DispatchWorkItem?
  private var lastCommandReceivedAt: Date?
  private var queuedOutboundPayloads: [[String: Any]] = []
  private var pendingConnectivityActivationWorkItem: DispatchWorkItem?
  private var suppressNextConnectivityActivationError = false
  private let stalePhoneCommandWindowMs: Double = 2 * 60 * 1000
  private let stalePhoneContextWindowMs: Double = 4 * 60 * 60 * 1000

  var isActive: Bool {
    state == .running || state == .paused || state == .prepared
  }

  var isRunning: Bool {
    state == .running
  }

  var isPaused: Bool {
    state == .paused
  }

  var statusLabel: String {
    if let lastError {
      return lastError
    }
    switch state {
    case .notStarted: return "Ready"
    case .prepared: return "Preparing"
    case .running: return "Running"
    case .paused: return "Paused"
    case .stopped: return "Stopping"
    case .ended: return "Complete"
    @unknown default: return "Ready"
    }
  }

  var syncLabel: String {
    if pendingSyncCount > 0 {
      return "\(pendingSyncCount) queued"
    }
    return WCSession.isSupported() && WCSession.default.isReachable ? "Phone live" : "Offline ready"
  }

  var availableMetricPages: [StrideWatchMetricPage] {
    selectedWorkoutKind.tracksDistance
      ? [.heartRate, .heartRateZone, .distance, .pace, .elapsed, .energy]
      : [.heartRate, .heartRateZone, .elapsed, .energy]
  }

  var elapsedLabel: String {
    let hours = elapsedSeconds / 3600
    let minutes = (elapsedSeconds % 3600) / 60
    let seconds = elapsedSeconds % 60
    if hours > 0 {
      return "\(hours):\(String(format: "%02d", minutes)):\(String(format: "%02d", seconds))"
    }
    return "\(minutes):\(String(format: "%02d", seconds))"
  }

  var distanceLabel: String {
    guard selectedWorkoutKind.tracksDistance else { return "--" }
    let value = preferredUnitSystem == "metric" ? distanceMeters / 1000 : distanceMeters / 1609.344
    return String(format: value >= 10 ? "%.1f" : "%.2f", value)
  }

  var distanceUnitLabel: String {
    preferredUnitSystem == "metric" ? "km" : "mi"
  }

  var paceLabel: String {
    guard selectedWorkoutKind.tracksDistance, distanceMeters > 10, elapsedSeconds > 0 else {
      return "--:--"
    }
    let unitDistance = preferredUnitSystem == "metric" ? distanceMeters / 1000 : distanceMeters / 1609.344
    guard unitDistance > 0 else { return "--:--" }
    let secondsPerUnit = Int((Double(elapsedSeconds) / unitDistance).rounded())
    return "\(secondsPerUnit / 60):\(String(format: "%02d", secondsPerUnit % 60))"
  }

  var paceUnitLabel: String {
    preferredUnitSystem == "metric" ? "/km" : "/mi"
  }

  var heartRateZoneLabel: String {
    guard let bpm = heartRateBpm, bpm > 0 else {
      return targetZone.map { "Z\($0)" } ?? "Z--"
    }
    let ratio = Double(bpm) / Double(max(maxHeartRateBpm, 1))
    if ratio < 0.60 { return "Z1" }
    if ratio < 0.70 { return "Z2" }
    if ratio < 0.80 { return "Z3" }
    if ratio < 0.90 { return "Z4" }
    return "Z5"
  }

  var metricValueLabel: String {
    switch metricPage {
    case .elapsed: return elapsedLabel
    case .heartRate: return heartRateBpm.map(String.init) ?? "--"
    case .distance: return distanceLabel
    case .pace: return paceLabel
    case .heartRateZone: return heartRateZoneLabel
    case .energy: return String(Int(activeEnergyKilocalories.rounded()))
    }
  }

  var metricUnitLabel: String {
    switch metricPage {
    case .elapsed: return ""
    case .heartRate: return "bpm"
    case .distance: return distanceUnitLabel
    case .pace: return paceUnitLabel
    case .heartRateZone: return ""
    case .energy: return "kcal"
    }
  }

  private override init() {
    super.init()
    StrideWatchStartTrail.installExceptionHandler()
    if let previous = StrideWatchStartTrail.read() {
      startTrailCrashed = !previous.terminal
      startTrailLabel = previous.terminal
        ? "Last start: \(previous.step)"
        : "Crashed at: \(previous.step)"
    }
  }

  // MARK: - Threading
  //
  // HealthKit and WatchConnectivity deliver delegate callbacks on background
  // queues. Every method below that touches published state, the outbound
  // queue, or the workout session runs on the main thread; callbacks hop in
  // before doing anything else.

  private func onMain(_ block: @escaping () -> Void) {
    if Thread.isMainThread {
      block()
    } else {
      DispatchQueue.main.async(execute: block)
    }
  }

  func prepareForPhoneControl() {
    guard WCSession.isSupported() else { return }
    scheduleConnectivityActivation(reportErrors: false, delay: 1.5)
  }

  /// Returns nil when the start was accepted, or a short rejection reason.
  /// Must be called on the main thread.
  @discardableResult
  func startWorkout(
    kind: StrideWatchWorkoutKind = .run,
    title: String?,
    workoutInstanceId: String?,
    environment: String?,
    targetZone: Int?
  ) -> String? {
    guard !isActive else { return "already_active" }
    guard !isStartingWorkout else { return "already_starting" }
    StrideWatchStartTrail.mark("2 start accepted (\(kind.rawValue))")
    lastError = nil
    isStartingWorkout = true
    isEnding = false
    healthKitLabel = "HK: requesting auth"
    let resolvedEnvironment = environment ?? ((kind == .run || kind == .cycling) ? "outdoor" : "indoor")
    let resolvedId = workoutInstanceId ?? "watch_\(kind.rawValue)_\(Int(Date().timeIntervalSince1970 * 1000))"
    self.workoutInstanceId = resolvedId
    self.workoutIdLabel = "ID: \(String(resolvedId.suffix(8)))"
    self.endedStateSentForWorkoutInstanceId = nil
    self.selectedWorkoutKind = kind
    self.workoutEnvironment = resolvedEnvironment
    self.targetZone = targetZone
    self.metricPage = kind.tracksDistance ? .heartRate : .elapsed
    armStartWatchdog()

    StrideWatchStartTrail.mark("3 auth request")
    requestAuthorization { [weak self] granted in
      guard let self else { return }
      StrideWatchStartTrail.mark("5 auth done granted=\(granted)")
      self.onMain {
        StrideWatchStartTrail.mark("6 main hop")
        guard granted else {
          self.failStart("Health permission needed.", label: "HK: auth denied")
          return
        }
        self.healthKitLabel = "HK: starting"
        self.beginWorkout(kind: kind, environment: resolvedEnvironment)
      }
    }
    return nil
  }

  func selectWorkoutKind(_ kind: StrideWatchWorkoutKind) {
    guard !isActive else { return }
    selectedWorkoutKind = kind
    metricPage = kind.tracksDistance ? .heartRate : .elapsed
  }

  func cycleMetricPage() {
    let pages = availableMetricPages
    guard let currentIndex = pages.firstIndex(of: metricPage) else {
      metricPage = pages.first ?? .heartRate
      return
    }
    metricPage = pages[(currentIndex + 1) % pages.count]
  }

  func pauseWorkout() {
    guard let session, session.state == .running else { return }
    session.pause()
    pausedAt = Date()
    // "paused" is published from the HealthKit delegate callback.
  }

  func resumeWorkout() {
    guard let session, session.state == .paused else { return }
    if let pausedAt {
      pausedSeconds += Date().timeIntervalSince(pausedAt)
    }
    pausedAt = nil
    session.resume()
    // "running" is published from the HealthKit delegate callback.
  }

  func endWorkout() {
    guard !isEnding else { return }
    guard let session else {
      if isActive {
        isEnding = true
        timer?.invalidate()
        timer = nil
        sendEndedStateOnce()
      }
      return
    }
    // HealthKit throws "Unable to perform 'end' from current state" if end()
    // is called again once the session is stopping or ended.
    guard session.state == .running || session.state == .paused || session.state == .prepared else { return }
    isEnding = true
    healthKitLabel = "HK: ending"
    session.end()
    timer?.invalidate()
    timer = nil
  }

  private func armStartWatchdog() {
    startWatchdog?.cancel()
    let item = DispatchWorkItem { [weak self] in
      guard let self, self.isStartingWorkout, self.state != .running else { return }
      self.failStart("Workout did not start. Try again from iPhone.", label: "HK: start timed out")
    }
    startWatchdog = item
    DispatchQueue.main.asyncAfter(deadline: .now() + 12, execute: item)
  }

  private func clearStartWatchdog() {
    startWatchdog?.cancel()
    startWatchdog = nil
  }

  private func failStart(_ message: String, label: String) {
    StrideWatchStartTrail.mark("failed: \(message)", terminal: true)
    clearStartWatchdog()
    isStartingWorkout = false
    healthKitLabel = label
    publishError(message)
  }

  private func beginWorkout(kind: StrideWatchWorkoutKind, environment: String?) {
    if let existing = session {
      if existing.state == .running || existing.state == .paused || existing.state == .prepared {
        existing.end()
      }
      session = nil
      builder = nil
    }

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = kind.activityType
    if kind == .run || kind == .cycling {
      configuration.locationType = environment == "indoor" ? .indoor : .outdoor
    } else {
      configuration.locationType = .indoor
    }

    do {
      StrideWatchStartTrail.mark("7 create session")
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      StrideWatchStartTrail.mark("8 get builder")
      let builder = session.associatedWorkoutBuilder()
      StrideWatchStartTrail.mark("9 data source")
      builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
      StrideWatchStartTrail.mark("10 set delegates")
      session.delegate = self
      builder.delegate = self
      self.session = session
      self.builder = builder

      let now = Date()
      startedAt = now
      pausedAt = nil
      pausedSeconds = 0
      elapsedSeconds = 0
      heartRateBpm = nil
      distanceMeters = 0
      activeEnergyKilocalories = 0

      StrideWatchStartTrail.mark("11 startActivity")
      session.startActivity(with: now)
      StrideWatchStartTrail.mark("12 beginCollection")
      builder.beginCollection(withStart: now) { [weak self] success, error in
        StrideWatchStartTrail.mark("14 collection cb ok=\(success)")
        guard let self else { return }
        if let error {
          self.publishError(error.localizedDescription)
        } else if !success {
          self.publishError("Workout collection did not start")
        }
      }
      StrideWatchStartTrail.mark("13 timer")
      startTimer()
      // isStartingWorkout stays true and "running" is published only when the
      // HealthKit delegate reports .running, so the phone never sees a running
      // workout that HealthKit has not actually started.
    } catch {
      failStart("HealthKit did not start: \(error.localizedDescription)", label: "HK: error")
    }
  }

  private func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
    guard HKHealthStore.isHealthDataAvailable() else {
      completion(false)
      return
    }

    let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate)
    let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)
    let runDistance = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)
    let cyclingDistance = HKObjectType.quantityType(forIdentifier: .distanceCycling)
    let readTypes = Set([heartRate, activeEnergy, runDistance, cyclingDistance].compactMap { $0 })
    let shareTypes: Set<HKSampleType> = [HKObjectType.workoutType()]

    healthStore.requestAuthorization(toShare: shareTypes, read: readTypes) { [weak self] granted, error in
      StrideWatchStartTrail.mark("4 auth callback")
      if let error {
        self?.publishError(error.localizedDescription)
      }
      completion(granted)
    }
  }

  private func startTimer() {
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      self?.refreshElapsed()
    }
  }

  private func refreshElapsed() {
    guard let startedAt else {
      elapsedSeconds = 0
      return
    }
    let activePause = pausedAt.map { Date().timeIntervalSince($0) } ?? 0
    elapsedSeconds = max(0, Int(Date().timeIntervalSince(startedAt) - pausedSeconds - activePause))
  }

  private func finishBuilderIfNeeded() {
    guard let builder else { return }
    builder.endCollection(withEnd: Date()) { [weak self] _, _ in
      builder.finishWorkout { _, error in
        if let error {
          self?.publishError(error.localizedDescription)
        }
      }
    }
  }

  private func activateWatchConnectivity(reportErrors: Bool = true) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    if session.activationState == .notActivated {
      suppressNextConnectivityActivationError = !reportErrors
      session.activate()
    }
    refreshConnectivityLabel()
  }

  private func scheduleConnectivityActivation(reportErrors: Bool = false, delay: TimeInterval = 2.0) {
    guard WCSession.isSupported() else { return }
    pendingConnectivityActivationWorkItem?.cancel()
    let workItem = DispatchWorkItem { [weak self] in
      self?.activateWatchConnectivity(reportErrors: reportErrors)
    }
    pendingConnectivityActivationWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
  }

  private func refreshConnectivityLabel() {
    onMain {
      guard WCSession.isSupported() else {
        self.connectivityLabel = "WC: unsupported"
        return
      }
      let session = WCSession.default
      let activation: String
      switch session.activationState {
      case .activated: activation = "active"
      case .inactive: activation = "inactive"
      case .notActivated: activation = "not activated"
      @unknown default: activation = "unknown"
      }
      self.connectivityLabel = "WC: \(activation) · \(session.isReachable ? "reachable" : "not reachable")"
    }
  }

  private func sendHeartRate(_ bpm: Int) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.sendHeartRate(bpm) }
      return
    }
    var payload: [String: Any] = [
      "type": "heartRate",
      "heartRate": bpm,
      "elapsedSeconds": elapsedSeconds,
      "workoutKind": selectedWorkoutKind.rawValue,
      "environment": workoutEnvironment,
      "distanceMeters": distanceMeters,
      "activeEnergyKilocalories": activeEnergyKilocalories,
      "heartRateZone": heartRateZoneLabel,
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "source": "apple_watch",
    ]
    if let workoutInstanceId {
      payload["workoutInstanceId"] = workoutInstanceId
    }
    sendToPhone(payload)
  }

  private func sendWorkoutState(_ label: String) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.sendWorkoutState(label) }
      return
    }
    refreshElapsed()
    var payload: [String: Any] = [
      "type": "workoutState",
      "state": label,
      "elapsedSeconds": elapsedSeconds,
      "workoutKind": selectedWorkoutKind.rawValue,
      "environment": workoutEnvironment,
      "distanceMeters": distanceMeters,
      "activeEnergyKilocalories": activeEnergyKilocalories,
      "heartRateZone": heartRateZoneLabel,
      "pendingSyncCount": pendingSyncCount,
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "source": "apple_watch",
    ]
    if let heartRateBpm {
      payload["heartRate"] = heartRateBpm
    }
    if let workoutInstanceId {
      payload["workoutInstanceId"] = workoutInstanceId
    }
    sendToPhone(payload)
  }

  private func sendEndedStateOnce() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.sendEndedStateOnce() }
      return
    }
    let key = workoutInstanceId ?? "ended_\(selectedWorkoutKind.rawValue)"
    guard endedStateSentForWorkoutInstanceId != key else { return }
    endedStateSentForWorkoutInstanceId = key
    sendWorkoutState("ended")
  }

  private func sendCommandAck(
    command: String,
    message: [String: Any],
    reason: String?
  ) {
    var payload: [String: Any] = [
      "type": "commandAck",
      "command": command,
      "accepted": reason == nil,
      "healthKitState": statusLabel.lowercased(),
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ]
    if let reason {
      payload["reason"] = reason
    }
    if let id = (message["workoutInstanceId"] as? String) ?? workoutInstanceId {
      payload["workoutInstanceId"] = id
    }
    sendToPhone(payload)
  }

  private func sendToPhone(_ payload: [String: Any], reportFailures: Bool = true) {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.sendToPhone(payload, reportFailures: reportFailures) }
      return
    }
    guard WCSession.isSupported() else { return }
    let session = WCSession.default

    guard session.activationState == .activated else {
      queuedOutboundPayloads.append(payload)
      if queuedOutboundPayloads.count > 40 {
        queuedOutboundPayloads.removeFirst(queuedOutboundPayloads.count - 40)
      }
      scheduleConnectivityActivation(reportErrors: false)
      return
    }

    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil) { [weak self] error in
        guard let self else { return }
        // Live delivery failed (phone went unreachable mid-send). State, acks,
        // and errors must still reach the phone, so queue them; heart-rate
        // samples are high-frequency and superseded, so they are dropped.
        let type = payload["type"] as? String
        if type == "workoutState" || type == "commandAck" || type == "error" {
          DispatchQueue.main.async {
            var queuedPayload = payload
            queuedPayload["queued"] = true
            WCSession.default.transferUserInfo(queuedPayload)
            self.pendingSyncCount += 1
          }
        }
        if reportFailures {
          self.recordLocalError(error.localizedDescription)
        }
      }
    } else {
      var queuedPayload = payload
      queuedPayload["queued"] = true
      session.transferUserInfo(queuedPayload)
      pendingSyncCount += 1
    }
  }

  private func flushQueuedOutboundPayloads() {
    guard Thread.isMainThread else {
      DispatchQueue.main.async { self.flushQueuedOutboundPayloads() }
      return
    }
    guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
    let payloads = queuedOutboundPayloads
    queuedOutboundPayloads.removeAll()
    payloads.forEach { sendToPhone($0) }
  }

  private func publishError(_ message: String) {
    onMain {
      self.lastError = message
      self.sendToPhone([
        "type": "error",
        "message": message,
        "timestamp": Date().timeIntervalSince1970 * 1000,
      ], reportFailures: false)
    }
  }

  private func recordLocalError(_ message: String) {
    DispatchQueue.main.async {
      self.lastError = message
    }
  }

  fileprivate func handleWorkoutSessionStateChange(_ toState: HKWorkoutSessionState) {
    state = toState

    switch toState {
    case .running:
      if isStartingWorkout {
        StrideWatchStartTrail.mark("running OK", terminal: true)
      }
      clearStartWatchdog()
      isStartingWorkout = false
      healthKitLabel = "HK: running"
      sendWorkoutState("running")
    case .paused:
      healthKitLabel = "HK: paused"
      sendWorkoutState("paused")
    case .ended:
      clearStartWatchdog()
      healthKitLabel = "HK: ended"
      finishBuilderIfNeeded()
      sendEndedStateOnce()
      isStartingWorkout = false
      isEnding = false
      timer?.invalidate()
      timer = nil
      session = nil
      builder = nil
    case .prepared:
      healthKitLabel = "HK: prepared"
    case .stopped:
      healthKitLabel = "HK: stopping"
    default:
      break
    }
  }

  fileprivate func handleWorkoutSessionFailure(_ error: Error) {
    StrideWatchStartTrail.mark("HK failure: \(error.localizedDescription)", terminal: true)
    clearStartWatchdog()
    isStartingWorkout = false
    healthKitLabel = "HK: error"
    publishError(error.localizedDescription)
  }

  fileprivate func handleActivationCompleted(error: Error?) {
    pendingConnectivityActivationWorkItem?.cancel()
    pendingConnectivityActivationWorkItem = nil
    if let error {
      let shouldSuppress = suppressNextConnectivityActivationError
      suppressNextConnectivityActivationError = false
      if !shouldSuppress {
        publishError(error.localizedDescription)
      }
    } else {
      suppressNextConnectivityActivationError = false
    }
    refreshConnectivityLabel()
    flushQueuedOutboundPayloads()
  }

  fileprivate func noteCommand(_ type: String, via: String, result: String) {
    lastCommandReceivedAt = Date()
    lastCommandLabel = "Cmd: \(type) \(via) \(result)"
  }

  fileprivate func handlePhoneCommand(
    _ message: [String: Any],
    via: String,
    fromApplicationContext: Bool = false
  ) {
    let type = message["type"] as? String
    let commandWorkoutInstanceId = message["workoutInstanceId"] as? String ?? ""
    let sentAt: Double
    if let value = message["sentAt"] as? NSNumber {
      sentAt = value.doubleValue
    } else if let value = message["sentAt"] as? Double {
      sentAt = value
    } else {
      sentAt = 0
    }
    let commandKey = "\(type ?? "")|\(commandWorkoutInstanceId)|\(Int(sentAt.rounded()))"
    onMain {
      guard let type else { return }
      self.refreshConnectivityLabel()
      if self.isStaleControlCommand(type: type, sentAt: sentAt, fromApplicationContext: fromApplicationContext) {
        self.noteCommand(type, via: via, result: "stale")
        return
      }
      // The same command normally arrives over several channels (message,
      // userInfo, applicationContext). Remember recent keys so replays and
      // late duplicates never restart or re-end a workout.
      if sentAt > 0 && self.handledPhoneCommandKeys.contains(commandKey) {
        self.noteCommand(type, via: via, result: "dup")
        return
      }
      // Only a live start (phone sent it while this app was open) may start
      // HealthKit. Starts queued while the app was closed are replayed on the
      // next launch; running them there turned one bad start into a crash on
      // every launch. The key is not recorded here, so the live copy of the
      // same start (which may arrive after its applicationContext copy) still
      // runs.
      let isStart = type == "startWorkout" || type == "startRun"
      if isStart && via != "msg" {
        self.noteCommand(type, via: via, result: "queued_start_ignored")
        self.sendCommandAck(command: type, message: message, reason: "queued_start_ignored")
        return
      }
      if sentAt > 0 {
        self.handledPhoneCommandKeys.append(commandKey)
        if self.handledPhoneCommandKeys.count > 40 {
          self.handledPhoneCommandKeys.removeFirst(self.handledPhoneCommandKeys.count - 40)
        }
      }

      switch type {
      case "startWorkout", "startRun":
        StrideWatchStartTrail.mark("1 cmd \(type) live")
        let kind: StrideWatchWorkoutKind = type == "startRun"
          ? .run
          : StrideWatchWorkoutKind.from(message["workoutKind"] as? String)
        let reason = self.startWorkout(
          kind: kind,
          title: message["title"] as? String,
          workoutInstanceId: message["workoutInstanceId"] as? String,
          environment: message["environment"] as? String,
          targetZone: message["targetZone"] as? Int
        )
        self.noteCommand(type, via: via, result: reason ?? "ok")
        self.sendCommandAck(command: type, message: message, reason: reason)
      case "pauseWorkout", "pauseRun":
        let reason = self.controlRejection(message)
        if reason == nil { self.pauseWorkout() }
        self.noteCommand(type, via: via, result: reason ?? "ok")
        self.sendCommandAck(command: type, message: message, reason: reason)
      case "resumeWorkout", "resumeRun":
        let reason = self.controlRejection(message)
        if reason == nil { self.resumeWorkout() }
        self.noteCommand(type, via: via, result: reason ?? "ok")
        self.sendCommandAck(command: type, message: message, reason: reason)
      case "endWorkout", "endRun":
        let reason = self.controlRejection(message)
        if reason == nil { self.endWorkout() }
        self.noteCommand(type, via: via, result: reason ?? "ok")
        self.sendCommandAck(command: type, message: message, reason: reason)
      case "setContext":
        self.applyPhoneContext(message)
        self.noteCommand(type, via: via, result: "ok")
      default:
        break
      }
    }
  }

  /// nil when a pause/resume/end command applies to the current workout.
  private func controlRejection(_ message: [String: Any]) -> String? {
    guard isActive || session != nil else { return "no_active_workout" }
    if let requestedId = message["workoutInstanceId"] as? String, !requestedId.isEmpty,
      let currentId = workoutInstanceId, !currentId.isEmpty, requestedId != currentId
    {
      return "id_mismatch"
    }
    return nil
  }

  private func isStaleControlCommand(type: String?, sentAt: Double, fromApplicationContext: Bool = false) -> Bool {
    guard sentAt > 0, let type else { return false }
    let controlCommands = [
      "startWorkout",
      "startRun",
      "pauseWorkout",
      "pauseRun",
      "resumeWorkout",
      "resumeRun",
      "endWorkout",
      "endRun",
    ]
    guard controlCommands.contains(type) else { return false }
    let nowMs = Date().timeIntervalSince1970 * 1000
    let window = fromApplicationContext ? stalePhoneContextWindowMs : stalePhoneCommandWindowMs
    return nowMs - sentAt > window
  }

  private func applyPhoneContext(_ message: [String: Any]) {
    if let unitSystem = message["unitSystem"] as? String {
      preferredUnitSystem = unitSystem == "metric" ? "metric" : "imperial"
    }
    if let maxHeartRate = message["maxHeartRateBpm"] as? Int, maxHeartRate > 0 {
      maxHeartRateBpm = maxHeartRate
    }
    if let targetZone = message["targetZone"] as? Int {
      self.targetZone = targetZone
    }
  }

  var lastCommandAgeLabel: String? {
    guard let lastCommandReceivedAt else { return nil }
    let seconds = Int(Date().timeIntervalSince(lastCommandReceivedAt))
    return seconds < 60 ? "\(seconds)s ago" : "\(seconds / 60)m ago"
  }
}

extension StrideWatchWorkoutManager: HKWorkoutSessionDelegate {
  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    if toState != .running {
      StrideWatchStartTrail.markIfStarting("15 HK state \(toState.rawValue)")
    }
    DispatchQueue.main.async {
      // A previous session can report .ended after a new workout has started;
      // it must not clear or end the current session.
      guard workoutSession === self.session else { return }
      self.handleWorkoutSessionStateChange(toState)
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    DispatchQueue.main.async {
      guard workoutSession === self.session else { return }
      self.handleWorkoutSessionFailure(error)
    }
  }
}

extension StrideWatchWorkoutManager: HKLiveWorkoutBuilderDelegate {
  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
    if
      let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate),
      collectedTypes.contains(heartRateType),
      let statistics = workoutBuilder.statistics(for: heartRateType),
      let quantity = statistics.mostRecentQuantity()
    {
      let bpm = Int(quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())).rounded())
      DispatchQueue.main.async {
        self.heartRateBpm = bpm
        self.sendHeartRate(bpm)
      }
    }

    if
      let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
      collectedTypes.contains(energyType),
      let statistics = workoutBuilder.statistics(for: energyType),
      let quantity = statistics.sumQuantity()
    {
      let kilocalories = quantity.doubleValue(for: .kilocalorie())
      DispatchQueue.main.async {
        self.activeEnergyKilocalories = kilocalories
      }
    }

    DispatchQueue.main.async {
      guard
        let distanceIdentifier = self.selectedWorkoutKind.distanceIdentifier,
        let distanceType = HKObjectType.quantityType(forIdentifier: distanceIdentifier),
        collectedTypes.contains(distanceType),
        let statistics = workoutBuilder.statistics(for: distanceType),
        let quantity = statistics.sumQuantity()
      else { return }
      self.distanceMeters = quantity.doubleValue(for: .meter())
    }
  }
}

extension StrideWatchWorkoutManager: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.handleActivationCompleted(error: error)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async {
      self.refreshConnectivityLabel()
      self.flushQueuedOutboundPayloads()
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handlePhoneCommand(message, via: "msg")
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handlePhoneCommand(userInfo, via: "info")
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    handlePhoneCommand(applicationContext, via: "ctx", fromApplicationContext: true)
  }

  func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
    DispatchQueue.main.async {
      self.pendingSyncCount = max(0, self.pendingSyncCount - 1)
      if let error {
        self.lastError = error.localizedDescription
      }
    }
  }
}

/// Records each step of a workout start synchronously to a small file so the
/// next launch can show exactly where a start died. A step marked terminal is
/// a clean outcome (running, failed, ended); a non-terminal last step means the
/// process was killed during it.
enum StrideWatchStartTrail {
  private static let fileURL: URL = {
    let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
      ?? FileManager.default.temporaryDirectory
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("stride-start-trail.txt")
  }()

  private static let lock = NSLock()
  private static var starting = false

  static func mark(_ step: String, terminal: Bool = false) {
    lock.lock()
    defer { lock.unlock() }
    starting = !terminal
    let line = "\(terminal ? "T" : "S")|\(Int(Date().timeIntervalSince1970))|\(step)"
    try? Data(line.utf8).write(to: fileURL, options: .atomic)
  }

  /// Marks only while a start is in flight, so steady-state callbacks never
  /// overwrite the outcome of the last start.
  static func markIfStarting(_ step: String) {
    lock.lock()
    let isStarting = starting
    lock.unlock()
    if isStarting { mark(step) }
  }

  static func read() -> (step: String, terminal: Bool, at: Date)? {
    guard let text = try? String(contentsOf: fileURL, encoding: .utf8) else { return nil }
    let parts = text.split(separator: "|", maxSplits: 2, omittingEmptySubsequences: false)
    guard parts.count == 3, let seconds = TimeInterval(parts[1]) else { return nil }
    return (String(parts[2]), parts[0] == "T", Date(timeIntervalSince1970: seconds))
  }

  /// Captures Objective-C exceptions (HealthKit raises these for invalid use)
  /// with the step they happened in. Swift traps cannot be caught; for those
  /// the last non-terminal step is the evidence.
  static func installExceptionHandler() {
    NSSetUncaughtExceptionHandler { exception in
      let previous = StrideWatchStartTrail.read()?.step ?? "no step"
      let reason = String((exception.reason ?? "").prefix(160))
      StrideWatchStartTrail.mark("EXC \(exception.name.rawValue) during [\(previous)]: \(reason)")
    }
  }
}
