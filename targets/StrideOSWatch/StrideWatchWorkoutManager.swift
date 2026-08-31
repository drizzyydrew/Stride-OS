import Combine
import Foundation
import HealthKit
import WatchConnectivity

final class StrideWatchWorkoutManager: NSObject, ObservableObject {
  static let shared = StrideWatchWorkoutManager()

  @Published private(set) var heartRateBpm: Int?
  @Published private(set) var state: HKWorkoutSessionState = .notStarted
  @Published private(set) var elapsedSeconds: Int = 0
  @Published private(set) var lastError: String?

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

  var elapsedLabel: String {
    let hours = elapsedSeconds / 3600
    let minutes = (elapsedSeconds % 3600) / 60
    let seconds = elapsedSeconds % 60
    if hours > 0 {
      return "\(hours):\(String(format: "%02d", minutes)):\(String(format: "%02d", seconds))"
    }
    return "\(minutes):\(String(format: "%02d", seconds))"
  }

  private override init() {
    super.init()
    activateWatchConnectivity()
  }

  func startWorkout(
    title: String?,
    workoutInstanceId: String?,
    environment: String?,
    targetZone: Int?
  ) {
    lastError = nil
    self.workoutInstanceId = workoutInstanceId

    requestAuthorization { [weak self] granted in
      guard let self else { return }
      guard granted else {
        self.publishError("Health permission needed")
        return
      }

      DispatchQueue.main.async {
        self.beginWorkout(environment: environment)
      }
    }
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

  private func beginWorkout(environment: String?) {
    if session != nil {
      session?.end()
      session = nil
      builder = nil
    }

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = .running
    configuration.locationType = environment == "indoor" ? .indoor : .outdoor

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
    let distance = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)
    let readTypes = Set([heartRate, activeEnergy, distance].compactMap { $0 })
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
      "timestamp": Date().timeIntervalSince1970 * 1000,
      "source": "apple_watch",
    ]
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
      session.transferUserInfo(payload)
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
    guard
      let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate),
      collectedTypes.contains(heartRateType),
      let statistics = workoutBuilder.statistics(for: heartRateType),
      let quantity = statistics.mostRecentQuantity()
    else {
      return
    }

    let bpm = Int(quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())).rounded())
    DispatchQueue.main.async {
      self.heartRateBpm = bpm
    }
    sendHeartRate(bpm)
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

  private func handlePhoneCommand(_ message: [String: Any]) {
    let type = message["type"] as? String
    DispatchQueue.main.async {
      switch type {
      case "startRun":
        self.startWorkout(
          title: message["title"] as? String,
          workoutInstanceId: message["workoutInstanceId"] as? String,
          environment: message["environment"] as? String,
          targetZone: message["targetZone"] as? Int
        )
      case "pauseRun":
        self.pauseWorkout()
      case "resumeRun":
        self.resumeWorkout()
      case "endRun":
        self.endWorkout()
      default:
        break
      }
    }
  }
}
