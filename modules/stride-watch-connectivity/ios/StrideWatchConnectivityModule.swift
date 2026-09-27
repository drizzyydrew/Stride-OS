import ExpoModulesCore
import Foundation
import HealthKit
import WatchConnectivity

private enum StrideWatchMessageType {
  static let startWorkout = "startWorkout"
  static let startRun = "startRun"
  static let pauseWorkout = "pauseWorkout"
  static let pauseRun = "pauseRun"
  static let resumeWorkout = "resumeWorkout"
  static let resumeRun = "resumeRun"
  static let endWorkout = "endWorkout"
  static let endRun = "endRun"
  static let setContext = "setContext"
  static let heartRate = "heartRate"
  static let workoutState = "workoutState"
  static let commandAck = "commandAck"
  static let error = "error"
}

private final class StrideWatchConnectivityCoordinator: NSObject, WCSessionDelegate {
  static let shared = StrideWatchConnectivityCoordinator()

  private var session: WCSession? {
    WCSession.isSupported() ? WCSession.default : nil
  }

  // WCSession delegate callbacks arrive on a background queue while JS calls
  // arrive on the module queue. All mutable state below is guarded by `lock`.
  private let lock = NSLock()
  private var eventSink: ((String, [String: Any]) -> Void)?
  private var pendingEvents: [(String, [String: Any])] = []
  private var pendingCommands: [[String: Any]] = []
  private var lastMessageAt: TimeInterval = 0
  private var lastError: String?
  private var lastCommandType: String?
  private var lastCommandAt: TimeInterval = 0
  private var lastCommandMethod: String?
  private var lastAckAt: TimeInterval = 0
  private var lastAckCommand: String?
  private var lastAckAccepted: Bool?
  private var lastAckReason: String?
  private var lastWatchStateAt: TimeInterval = 0
  private var lastWatchState: String?
  // Auto-launch: a start sent while the watch app wasn't running. Resent over
  // the live channel once the launched app becomes reachable (the watch only
  // starts HealthKit from a live start), then cleared. An end clears it.
  private var pendingLiveStart: [String: Any]?
  private var pendingLiveStartExpiresAt: TimeInterval = 0
  // Latest pause/resume sent while a launch start was pending; re-sent (with a
  // fresh sentAt, so the watch's dedupe doesn't drop it) right after the start.
  private var pendingLiveFollowUpType: String?
  private let pendingLiveStartWindowSeconds: TimeInterval = 90
  private let healthStore = HKHealthStore()

  private func locked<T>(_ body: () -> T) -> T {
    lock.lock()
    defer { lock.unlock() }
    return body()
  }

  func setEventSink(_ sink: ((String, [String: Any]) -> Void)?) {
    locked { eventSink = sink }
    activate()
    flushPendingEventsIfNeeded()
  }

  func activate() {
    guard let session else { return }
    session.delegate = self
    if session.activationState == .notActivated {
      session.activate()
    }
  }

  func snapshot() -> [String: Any] {
    let diagnostics: [String: Any] = locked {
      [
        "lastMessageAt": lastMessageAt,
        "lastError": lastError ?? NSNull(),
        "lastCommandType": lastCommandType ?? NSNull(),
        "lastCommandAt": lastCommandAt,
        "lastCommandMethod": lastCommandMethod ?? NSNull(),
        "lastAckAt": lastAckAt,
        "lastAckCommand": lastAckCommand ?? NSNull(),
        "lastAckAccepted": lastAckAccepted.map { $0 as Any } ?? NSNull(),
        "lastAckReason": lastAckReason ?? NSNull(),
        "lastWatchStateAt": lastWatchStateAt,
        "lastWatchState": lastWatchState ?? NSNull(),
      ]
    }

    var result = diagnostics
    guard let session else {
      result["isSupported"] = false
      result["isPaired"] = false
      result["isWatchAppInstalled"] = false
      result["isReachable"] = false
      result["activationState"] = "unsupported"
      return result
    }

    result["isSupported"] = true
    result["isPaired"] = session.isPaired
    result["isWatchAppInstalled"] = session.isWatchAppInstalled
    result["isReachable"] = session.isReachable
    result["activationState"] = activationStateLabel(session.activationState)
    return result
  }

  @discardableResult
  func sendCommand(_ type: String, payload: [String: Any]) throws -> [String: Any] {
    guard let session else {
      throw NSError(domain: "StrideWatchConnectivity", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Apple Watch connectivity is unavailable on this device.",
      ])
    }

    activate()

    var message = payload
    message["type"] = type
    message["sentAt"] = Date().timeIntervalSince1970 * 1000

    if type == StrideWatchMessageType.endWorkout || type == StrideWatchMessageType.endRun {
      clearPendingLiveStart()
    } else if type == StrideWatchMessageType.pauseWorkout || type == StrideWatchMessageType.pauseRun
      || type == StrideWatchMessageType.resumeWorkout || type == StrideWatchMessageType.resumeRun {
      locked {
        if pendingLiveStart != nil { pendingLiveFollowUpType = type }
      }
    }

    guard session.isPaired && session.isWatchAppInstalled else {
      recordCommand(type, method: "none")
      throw NSError(domain: "StrideWatchConnectivity", code: 2, userInfo: [
        NSLocalizedDescriptionKey: "Open StrideOS on Apple Watch, then try again.",
      ])
    }

    if shouldPublishAsLatestContext(type) && session.activationState == .activated {
      try? session.updateApplicationContext(message)
    }

    if session.activationState != .activated {
      // Not activated yet: hold the command and flush from the activation callback.
      recordCommand(type, method: "queued")
      locked {
        pendingCommands.append(message)
        if pendingCommands.count > 20 {
          pendingCommands.removeFirst(pendingCommands.count - 20)
        }
      }
      if session.activationState == .notActivated {
        session.activate()
      }
      return message
    }

    if session.isReachable {
      recordCommand(type, method: "sendMessage")
      sendReachableOrFallback(message, session: session)
    } else {
      recordCommand(type, method: "transferUserInfo")
      session.transferUserInfo(message)
    }
    return message
  }

  /// When a start could not be delivered live (watch app not running), ask
  /// HealthKit to launch the StrideOS watch app and remember the start so it
  /// is resent live as soon as the app is reachable. No-op when the watch app
  /// is already reachable, so the proven open-app path is unchanged.
  func launchWatchAppIfNeeded(forStart message: [String: Any]) {
    guard let session, session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
    guard !session.isReachable, HKHealthStore.isHealthDataAvailable() else { return }

    locked {
      pendingLiveStart = message
      pendingLiveStartExpiresAt = Date().timeIntervalSince1970 + pendingLiveStartWindowSeconds
    }

    let configuration = HKWorkoutConfiguration()
    let kind = message["workoutKind"] as? String
    let environment = message["environment"] as? String
    switch kind {
    case "cycling": configuration.activityType = .cycling
    case "strength": configuration.activityType = .traditionalStrengthTraining
    case "mobility": configuration.activityType = .flexibility
    default: configuration.activityType = .running
    }
    configuration.locationType = (kind == "strength" || kind == "mobility" || environment == "indoor") ? .indoor : .outdoor

    healthStore.startWatchApp(with: configuration) { [weak self] success, error in
      guard let self else { return }
      if !success {
        self.locked { self.lastError = "Watch app launch failed: \(error?.localizedDescription ?? "unknown")" }
        self.emitStatus()
      }
    }
  }

  private func clearPendingLiveStart() {
    locked {
      pendingLiveStart = nil
      pendingLiveStartExpiresAt = 0
      pendingLiveFollowUpType = nil
    }
  }

  /// Resends a pending auto-launch start over the live channel once reachable.
  private func resendPendingLiveStartIfReachable() {
    guard let session, session.activationState == .activated, session.isReachable else { return }
    let (message, followUpType): ([String: Any]?, String?) = locked {
      let followUp = pendingLiveFollowUpType
      pendingLiveFollowUpType = nil
      guard let pending = pendingLiveStart, Date().timeIntervalSince1970 <= pendingLiveStartExpiresAt else {
        pendingLiveStart = nil
        return (nil, nil)
      }
      pendingLiveStart = nil
      return (pending, followUp)
    }
    guard let message else { return }
    recordCommand(message["type"] as? String ?? StrideWatchMessageType.startWorkout, method: "sendMessage")
    sendReachableOrFallback(message, session: session)
    if let followUpType {
      var followUp: [String: Any] = [
        "type": followUpType,
        "sentAt": Date().timeIntervalSince1970 * 1000,
      ]
      if let id = message["workoutInstanceId"] { followUp["workoutInstanceId"] = id }
      recordCommand(followUpType, method: "sendMessage")
      sendReachableOrFallback(followUp, session: session)
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if let error {
      recordError(error.localizedDescription)
    }
    flushPendingCommandsIfPossible()
    emitStatus()
  }

  func sessionDidBecomeInactive(_ session: WCSession) {
    emitStatus()
  }

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
    emitStatus()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    flushPendingCommandsIfPossible()
    resendPendingLiveStartIfReachable()
    emitStatus()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    emitStatus()
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    handleIncoming(message)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handleIncoming(userInfo)
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    handleIncoming(applicationContext)
  }

  private func handleIncoming(_ message: [String: Any]) {
    let now = Date().timeIntervalSince1970 * 1000
    let type = message["type"] as? String ?? ""
    locked { lastMessageAt = now }

    switch type {
    case StrideWatchMessageType.heartRate:
      emit("onWatchHeartRate", sanitizePayload(message))
    case StrideWatchMessageType.workoutState:
      locked {
        lastWatchStateAt = now
        lastWatchState = message["state"] as? String
      }
      emit("onWatchWorkoutState", sanitizePayload(message))
      emitStatus()
    case StrideWatchMessageType.commandAck:
      locked {
        lastAckAt = now
        lastAckCommand = message["command"] as? String
        lastAckAccepted = message["accepted"] as? Bool
        lastAckReason = message["reason"] as? String
      }
      emit("onWatchAck", sanitizePayload(message))
      emitStatus()
    case StrideWatchMessageType.error:
      locked { lastError = message["message"] as? String }
      emit("onWatchError", sanitizePayload(message))
      emitStatus()
    default:
      // Unknown types (including echoed phone commands from applicationContext)
      // must not be treated as watch workout state.
      break
    }
  }

  private func recordCommand(_ type: String, method: String) {
    locked {
      lastCommandType = type
      lastCommandAt = Date().timeIntervalSince1970 * 1000
      lastCommandMethod = method
    }
    emitStatus()
  }

  private func emitStatus() {
    emit("onWatchStatus", snapshot())
  }

  private func flushPendingCommandsIfPossible() {
    guard let session, session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else {
      return
    }
    let commands: [[String: Any]] = locked {
      let queued = pendingCommands
      pendingCommands.removeAll()
      return queued
    }
    for command in commands {
      let type = command["type"] as? String
      if shouldPublishAsLatestContext(type) {
        try? session.updateApplicationContext(command)
      }
      if session.isReachable {
        recordCommand(type ?? "unknown", method: "sendMessage")
        sendReachableOrFallback(command, session: session)
      } else {
        recordCommand(type ?? "unknown", method: "transferUserInfo")
        session.transferUserInfo(command)
      }
    }
  }

  private func sendReachableOrFallback(_ message: [String: Any], session: WCSession) {
    session.sendMessage(message, replyHandler: nil) { [weak self] error in
      guard let self else { return }
      if session.activationState == .activated && session.isPaired && session.isWatchAppInstalled {
        // Live delivery failed; make sure the watch still gets it when it wakes.
        session.transferUserInfo(message)
        self.recordCommand(message["type"] as? String ?? "unknown", method: "transferUserInfo")
        self.locked { self.lastError = "sendMessage failed: \(error.localizedDescription)" }
        self.emitStatus()
      } else {
        self.recordError(error.localizedDescription)
      }
    }
  }

  private func shouldPublishAsLatestContext(_ type: String?) -> Bool {
    switch type {
    case StrideWatchMessageType.startWorkout,
      StrideWatchMessageType.startRun,
      StrideWatchMessageType.pauseWorkout,
      StrideWatchMessageType.pauseRun,
      StrideWatchMessageType.resumeWorkout,
      StrideWatchMessageType.resumeRun,
      StrideWatchMessageType.endWorkout,
      StrideWatchMessageType.endRun,
      StrideWatchMessageType.setContext:
      return true
    default:
      return false
    }
  }

  private func recordError(_ message: String) {
    locked { lastError = message }
    emit("onWatchError", [
      "type": StrideWatchMessageType.error,
      "message": message,
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ])
    emitStatus()
  }

  private func emit(_ name: String, _ payload: [String: Any]) {
    let sink: ((String, [String: Any]) -> Void)? = locked {
      if eventSink == nil {
        pendingEvents.append((name, payload))
        if pendingEvents.count > 50 {
          pendingEvents.removeFirst(pendingEvents.count - 50)
        }
      }
      return eventSink
    }
    sink?(name, payload)
  }

  private func flushPendingEventsIfNeeded() {
    let (sink, events): (((String, [String: Any]) -> Void)?, [(String, [String: Any])]) = locked {
      guard eventSink != nil, !pendingEvents.isEmpty else { return (nil, []) }
      let events = pendingEvents
      pendingEvents.removeAll()
      return (eventSink, events)
    }
    guard let sink else { return }
    events.forEach { name, payload in
      sink(name, payload)
    }
  }

  private func sanitizePayload(_ payload: [String: Any]) -> [String: Any] {
    payload.mapValues { value in
      switch value {
      case let number as NSNumber:
        return number
      case let string as String:
        return string
      case let bool as Bool:
        return bool
      default:
        return value
      }
    }
  }

  private func activationStateLabel(_ state: WCSessionActivationState) -> String {
    switch state {
    case .activated: return "activated"
    case .inactive: return "inactive"
    case .notActivated: return "notActivated"
    @unknown default: return "unknown"
    }
  }
}

public final class StrideWatchConnectivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StrideWatchConnectivity")

    Events("onWatchStatus", "onWatchHeartRate", "onWatchWorkoutState", "onWatchError", "onWatchAck")

    OnCreate {
      StrideWatchConnectivityCoordinator.shared.activate()
    }

    OnStartObserving {
      StrideWatchConnectivityCoordinator.shared.setEventSink { [weak self] name, payload in
        self?.sendEvent(name, payload)
      }
    }

    OnStopObserving {
      StrideWatchConnectivityCoordinator.shared.setEventSink(nil)
    }

    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    Function("snapshot") { () -> [String: Any] in
      StrideWatchConnectivityCoordinator.shared.activate()
      return StrideWatchConnectivityCoordinator.shared.snapshot()
    }

    AsyncFunction("activate") { (promise: Promise) in
      StrideWatchConnectivityCoordinator.shared.activate()
      promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
    }

    AsyncFunction("startRun") {
      (
        workoutInstanceId: String?,
        title: String?,
        environment: String?,
        targetZone: Int?,
        promise: Promise
      ) in
      do {
        var payload: [String: Any] = [:]
        if let workoutInstanceId {
          payload["workoutInstanceId"] = workoutInstanceId
        }
        if let title {
          payload["title"] = title
        }
        if let environment {
          payload["environment"] = environment
        }
        if let targetZone {
          payload["targetZone"] = targetZone
        }
        let message = try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.startRun, payload: payload)
        StrideWatchConnectivityCoordinator.shared.launchWatchAppIfNeeded(forStart: message)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_START", error.localizedDescription)
      }
    }

    AsyncFunction("startWorkout") {
      (
        workoutKind: String?,
        workoutInstanceId: String?,
        title: String?,
        environment: String?,
        targetZone: Int?,
        promise: Promise
      ) in
      do {
        var payload: [String: Any] = [:]
        if let workoutKind {
          payload["workoutKind"] = workoutKind
        }
        if let workoutInstanceId {
          payload["workoutInstanceId"] = workoutInstanceId
        }
        if let title {
          payload["title"] = title
        }
        if let environment {
          payload["environment"] = environment
        }
        if let targetZone {
          payload["targetZone"] = targetZone
        }
        let message = try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.startWorkout, payload: payload)
        StrideWatchConnectivityCoordinator.shared.launchWatchAppIfNeeded(forStart: message)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_START_WORKOUT", error.localizedDescription)
      }
    }

    AsyncFunction("pauseRun") { (workoutInstanceId: String?, promise: Promise) in
      do {
        var payload: [String: Any] = [:]
        if let workoutInstanceId {
          payload["workoutInstanceId"] = workoutInstanceId
        }
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.pauseRun, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_PAUSE", error.localizedDescription)
      }
    }

    AsyncFunction("pauseWorkout") { (workoutInstanceId: String?, promise: Promise) in
      do {
        var payload: [String: Any] = [:]
        if let workoutInstanceId {
          payload["workoutInstanceId"] = workoutInstanceId
        }
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.pauseWorkout, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_PAUSE_WORKOUT", error.localizedDescription)
      }
    }

    AsyncFunction("resumeRun") { (workoutInstanceId: String?, promise: Promise) in
      do {
        var payload: [String: Any] = [:]
        if let workoutInstanceId {
          payload["workoutInstanceId"] = workoutInstanceId
        }
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.resumeRun, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_RESUME", error.localizedDescription)
      }
    }

    AsyncFunction("resumeWorkout") { (workoutInstanceId: String?, promise: Promise) in
      do {
        var payload: [String: Any] = [:]
        if let workoutInstanceId {
          payload["workoutInstanceId"] = workoutInstanceId
        }
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.resumeWorkout, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_RESUME_WORKOUT", error.localizedDescription)
      }
    }

    AsyncFunction("endRun") { (workoutInstanceId: String?, promise: Promise) in
      do {
        var payload: [String: Any] = [:]
        if let workoutInstanceId {
          payload["workoutInstanceId"] = workoutInstanceId
        }
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.endRun, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_END", error.localizedDescription)
      }
    }

    AsyncFunction("endWorkout") { (workoutInstanceId: String?, promise: Promise) in
      do {
        var payload: [String: Any] = [:]
        if let workoutInstanceId {
          payload["workoutInstanceId"] = workoutInstanceId
        }
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.endWorkout, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_END_WORKOUT", error.localizedDescription)
      }
    }

    AsyncFunction("setWorkoutContext") {
      (
        unitSystem: String?,
        maxHeartRateBpm: Int?,
        targetZone: Int?,
        promise: Promise
      ) in
      do {
        var payload: [String: Any] = [:]
        if let unitSystem {
          payload["unitSystem"] = unitSystem
        }
        if let maxHeartRateBpm {
          payload["maxHeartRateBpm"] = maxHeartRateBpm
        }
        if let targetZone {
          payload["targetZone"] = targetZone
        }
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.setContext, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_CONTEXT", error.localizedDescription)
      }
    }
  }
}
