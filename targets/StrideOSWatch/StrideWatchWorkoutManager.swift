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

  private var maxHeartRateBpm: Int = 190
  private var targetZone: Int?
  private var workoutEnvironment: String = "outdoor"

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var workoutInstanceId: String?
  private var startedAt: Date?
  private var pausedAt: Date?
  private var pausedSeconds: TimeInterval = 0
  private var timer: Timer?

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
    activateWatchConnectivity()
  }

  func startWorkout(
    kind: StrideWatchWorkoutKind = .run,
    title: String?,
    workoutInstanceId: String?,
    environment: String?,
    targetZone: Int?
  ) {
    lastError = nil
    let resolvedEnvironment = environment ?? ((kind == .run || kind == .cycling) ? "outdoor" : "indoor")
    self.workoutInstanceId = workoutInstanceId ?? "watch_\(kind.rawValue)_\(Int(Date().timeIntervalSince1970 * 1000))"
    self.selectedWorkoutKind = kind
    self.workoutEnvironment = resolvedEnvironment
    self.targetZone = targetZone
    self.metricPage = kind.tracksDistance ? .heartRate : .elapsed

    requestAuthorization { [weak self] granted in
      guard let self else { return }
      guard granted else {
        self.publishError("Health permission needed")
        return
      }

      DispatchQueue.main.async {
        self.beginWorkout(kind: kind, environment: resolvedEnvironment)
      }
    }
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
    session?.pause()
    pausedAt = Date()
    sendWorkoutState("paused")
  }

  func resumeWorkout() {
    if let pausedAt {
      pausedSeconds += Date().timeIntervalSince(pausedAt)
    }
    pausedAt = nil
    session?.resume()
    sendWorkoutState("running")
  }

  func endWorkout() {
    session?.end()
    timer?.invalidate()
    timer = nil
    sendWorkoutState("ended")
  }

  private func beginWorkout(kind: StrideWatchWorkoutKind, environment: String?) {
    if session != nil {
      session?.end()
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
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      let builder = session.associatedWorkoutBuilder()
      builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
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
      session.startActivity(with: now)
      builder.beginCollection(withStart: now) { [weak self] success, error in
        if let error {
          self?.publishError(error.localizedDescription)
        } else if !success {
          self?.publishError("Workout collection did not start")
        }
      }
      startTimer()
      sendWorkoutState("running")
    } catch {
      publishError(error.localizedDescription)
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

    healthStore.requestAuthorization(toShare: shareTypes, read: readTypes) { granted, error in
      if let error {
        self.publishError(error.localizedDescription)
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

  private func activateWatchConnectivity() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  private func sendHeartRate(_ bpm: Int) {
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

  private func sendToPhone(_ payload: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default

    if session.isReachable {
      session.sendMessage(payload, replyHandler: nil) { [weak self] error in
        self?.publishError(error.localizedDescription)
      }
    } else {
      var queuedPayload = payload
      queuedPayload["queued"] = true
      session.transferUserInfo(queuedPayload)
      DispatchQueue.main.async {
        self.pendingSyncCount += 1
      }
    }
  }

  private func publishError(_ message: String) {
    DispatchQueue.main.async {
      self.lastError = message
    }
    sendToPhone([
      "type": "error",
      "message": message,
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ])
  }
}

extension StrideWatchWorkoutManager: HKWorkoutSessionDelegate {
  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    DispatchQueue.main.async {
      self.state = toState
    }

    switch toState {
    case .running:
      sendWorkoutState("running")
    case .paused:
      sendWorkoutState("paused")
    case .ended:
      finishBuilderIfNeeded()
      sendWorkoutState("ended")
      DispatchQueue.main.async {
        self.timer?.invalidate()
        self.timer = nil
        self.session = nil
        self.builder = nil
      }
    default:
      sendWorkoutState(statusLabel.lowercased())
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    publishError(error.localizedDescription)
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
      }
      sendHeartRate(bpm)
    }

    if
      let energyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
      collectedTypes.contains(energyType),
      let statistics = workoutBuilder.statistics(for: energyType),
      let quantity = statistics.sumQuantity()
    {
      DispatchQueue.main.async {
        self.activeEnergyKilocalories = quantity.doubleValue(for: .kilocalorie())
      }
    }

    if
      let distanceIdentifier = selectedWorkoutKind.distanceIdentifier,
      let distanceType = HKObjectType.quantityType(forIdentifier: distanceIdentifier),
      collectedTypes.contains(distanceType),
      let statistics = workoutBuilder.statistics(for: distanceType),
      let quantity = statistics.sumQuantity()
    {
      DispatchQueue.main.async {
        self.distanceMeters = quantity.doubleValue(for: .meter())
      }
    }
  }
}

extension StrideWatchWorkoutManager: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error {
      publishError(error.localizedDescription)
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handlePhoneCommand(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handlePhoneCommand(userInfo)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    handlePhoneCommand(applicationContext)
  }

  private func handlePhoneCommand(_ message: [String: Any]) {
    let type = message["type"] as? String
    DispatchQueue.main.async {
      switch type {
      case "startWorkout":
        self.startWorkout(
          kind: StrideWatchWorkoutKind.from(message["workoutKind"] as? String),
          title: message["title"] as? String,
          workoutInstanceId: message["workoutInstanceId"] as? String,
          environment: message["environment"] as? String,
          targetZone: message["targetZone"] as? Int
        )
      case "startRun":
        self.startWorkout(
          kind: .run,
          title: message["title"] as? String,
          workoutInstanceId: message["workoutInstanceId"] as? String,
          environment: message["environment"] as? String,
          targetZone: message["targetZone"] as? Int
        )
      case "pauseWorkout", "pauseRun":
        self.pauseWorkout()
      case "resumeWorkout", "resumeRun":
        self.resumeWorkout()
      case "endWorkout", "endRun":
        self.endWorkout()
      case "setContext":
        self.applyPhoneContext(message)
      default:
        break
      }
    }
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

  func session(_ session: WCSession, didFinish userInfoTransfer: WCSessionUserInfoTransfer, error: Error?) {
    DispatchQueue.main.async {
      self.pendingSyncCount = max(0, self.pendingSyncCount - 1)
      if let error {
        self.lastError = error.localizedDescription
      }
    }
  }
}
