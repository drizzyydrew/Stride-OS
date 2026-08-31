import ExpoModulesCore
import Foundation
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
  static let error = "error"
}

private final class StrideWatchConnectivityCoordinator: NSObject, WCSessionDelegate {
  static let shared = StrideWatchConnectivityCoordinator()

  private var session: WCSession? {
    WCSession.isSupported() ? WCSession.default : nil
  }

  private var eventSink: ((String, [String: Any]) -> Void)?
  private var pendingEvents: [(String, [String: Any])] = []
  private var lastMessageAt: TimeInterval = 0
  private var lastError: String?

  func setEventSink(_ sink: ((String, [String: Any]) -> Void)?) {
    eventSink = sink
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
    guard let session else {
      return [
        "isSupported": false,
        "isPaired": false,
        "isWatchAppInstalled": false,
        "isReachable": false,
        "activationState": "unsupported",
        "lastMessageAt": lastMessageAt,
        "lastError": lastError ?? NSNull(),
      ]
    }

    return [
      "isSupported": true,
      "isPaired": session.isPaired,
      "isWatchAppInstalled": session.isWatchAppInstalled,
      "isReachable": session.isReachable,
      "activationState": activationStateLabel(session.activationState),
      "lastMessageAt": lastMessageAt,
      "lastError": lastError ?? NSNull(),
    ]
  }

  func sendCommand(_ type: String, payload: [String: Any]) throws {
    guard let session else {
      throw NSError(domain: "StrideWatchConnectivity", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Apple Watch connectivity is unavailable on this device.",
      ])
    }

    activate()

    var message = payload
    message["type"] = type
    message["sentAt"] = Date().timeIntervalSince1970 * 1000

    if session.isReachable {
      session.sendMessage(message, replyHandler: nil) { [weak self] error in
        self?.recordError(error.localizedDescription)
      }
    } else if session.activationState == .activated && session.isPaired && session.isWatchAppInstalled {
      session.transferUserInfo(message)
    } else {
      throw NSError(domain: "StrideWatchConnectivity", code: 2, userInfo: [
        NSLocalizedDescriptionKey: "Install and open the StrideOS Apple Watch app, then try again.",
      ])
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

  private func handleIncoming(_ message: [String: Any]) {
    lastMessageAt = Date().timeIntervalSince1970 * 1000
    let type = message["type"] as? String ?? ""

    switch type {
    case StrideWatchMessageType.heartRate:
      emit("onWatchHeartRate", sanitizePayload(message))
    case StrideWatchMessageType.workoutState:
      emit("onWatchWorkoutState", sanitizePayload(message))
    case StrideWatchMessageType.error:
      lastError = message["message"] as? String
      emit("onWatchError", sanitizePayload(message))
      emitStatus()
    default:
      emit("onWatchWorkoutState", sanitizePayload(message))
    }
  }

  private func emitStatus() {
    emit("onWatchStatus", snapshot())
  }

  private func recordError(_ message: String) {
    lastError = message
    emit("onWatchError", [
      "type": StrideWatchMessageType.error,
      "message": message,
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ])
    emitStatus()
  }

  private func emit(_ name: String, _ payload: [String: Any]) {
    if let eventSink {
      eventSink(name, payload)
    } else {
      pendingEvents.append((name, payload))
      if pendingEvents.count > 50 {
        pendingEvents.removeFirst(pendingEvents.count - 50)
      }
    }
  }

  private func flushPendingEventsIfNeeded() {
    guard let eventSink, !pendingEvents.isEmpty else { return }
    let events = pendingEvents
    pendingEvents.removeAll()
    events.forEach { name, payload in
      eventSink(name, payload)
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

    Events("onWatchStatus", "onWatchHeartRate", "onWatchWorkoutState", "onWatchError")

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
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.startRun, payload: payload)
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
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.startWorkout, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_START_WORKOUT", error.localizedDescription)
      }
    }

    AsyncFunction("pauseRun") { (promise: Promise) in
      do {
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.pauseRun, payload: [:])
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_PAUSE", error.localizedDescription)
      }
    }

    AsyncFunction("pauseWorkout") { (promise: Promise) in
      do {
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.pauseWorkout, payload: [:])
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_PAUSE_WORKOUT", error.localizedDescription)
      }
    }

    AsyncFunction("resumeRun") { (promise: Promise) in
      do {
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.resumeRun, payload: [:])
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_RESUME", error.localizedDescription)
      }
    }

    AsyncFunction("resumeWorkout") { (promise: Promise) in
      do {
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.resumeWorkout, payload: [:])
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_RESUME_WORKOUT", error.localizedDescription)
      }
    }

    AsyncFunction("endRun") { (promise: Promise) in
      do {
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.endRun, payload: [:])
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_END", error.localizedDescription)
      }
    }

    AsyncFunction("endWorkout") { (promise: Promise) in
      do {
        try StrideWatchConnectivityCoordinator.shared.sendCommand(StrideWatchMessageType.endWorkout, payload: [:])
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
