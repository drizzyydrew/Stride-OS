import ExpoModulesCore
import Foundation
import CoreMotion
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
  private var supportedWorkoutKinds: [String] = []
  private final class PreparedStart {
    let nonce: String
    let id: String
    let epoch: String
    let peer: Int
    let expiresAt: TimeInterval
    var message: [String: Any]?
    var acknowledged = false
    var terminal = false
    var submitted = false
    var launchRequested = false
    var liveResendUsed = false
    var recoveryNeeded = false
    var recoveryRequiresFence = false
    var followUp: String?
    var followUpIsExplicit = false
    var recoveredFromNonce: String?
    init(id: String, epoch: String, peer: Int, now: TimeInterval, nonce: String? = nil) {
      self.id = id; self.epoch = epoch; self.peer = peer
      self.nonce = nonce ?? UUID().uuidString; expiresAt = now + 90
    }
  }
  private var preparedStart: PreparedStart?
  private var confirmedStarts: [String: PreparedStart] = [:]
  private struct CapabilityExpectation {
    let id: String
    let nonce: String
    let epoch: String
    let peer: Int
    var action: String?
    var expiresAt: TimeInterval
    var submitted = false
    var preparedNonce: String?
  }
  private var capabilityExpectations: [String: CapabilityExpectation] = [:]
  private var ownerEpoch = UUID().uuidString
  private var peerGeneration = 0
  private var capabilityRequestNonce: String?
  private var startFenceValidatedAt: TimeInterval = 0
  private var startFenceVersion = 0
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

  private func locked<T>(_ body: () throws -> T) rethrows -> T {
    lock.lock()
    defer { lock.unlock() }
    return try body()
  }

  private func fenceAvailableLocked() -> Bool {
    let age = Date().timeIntervalSince1970 - startFenceValidatedAt
    return startFenceVersion == 1 && age >= 0 && age <= 120
  }

  /// Synchronous registration precedes the queued Expo AsyncFunction body.
  func prepareWorkoutStart(_ id: String) -> String {
    if let existing: String = locked({
      guard let start = preparedStart, start.id == id, start.peer == peerGeneration,
        !start.terminal,
        start.acknowledged || Date().timeIntervalSince1970 <= start.expiresAt else { return nil }
      return start.nonce
    }) { return existing }
    if let confirmed: String = locked({
      guard let existing = confirmedStarts[id], existing.peer == peerGeneration,
        existing.acknowledged, !existing.terminal else { return nil }
      preparedStart = existing
      return existing.nonce
    }) { return confirmed }
    cancelPendingStart()
    let nonce = locked {
      retireControlIntentsLocked(id)
      let start = PreparedStart(id: id, epoch: ownerEpoch, peer: peerGeneration, now: Date().timeIntervalSince1970)
      preparedStart = start
      return start.nonce
    }
    _ = try? sendCommand("requestCapabilities", payload: [:])
    return nonce
  }

  /// Linearizes cancellation with every prepared transport submission. No
  /// callback executes directly beneath the lock, including synchronous mocks.
  func cancelPendingStart(revokeRemote: Bool = false) {
    locked {
      let old = preparedStart
      if revokeRemote {
        for key in Array(capabilityExpectations.keys) {
          if capabilityExpectations[key]?.peer == peerGeneration {
            if capabilityExpectations[key]?.action != "endRecording" { capabilityExpectations[key]?.action = "cancelStart" }
            capabilityExpectations[key]?.expiresAt = Date().timeIntervalSince1970 + 14_405
          }
        }
      }
      preparedStart = nil
      if revokeRemote { ownerEpoch = UUID().uuidString }
      capabilityRequestNonce = nil
      if !revokeRemote, let old, old.message != nil { confirmedStarts[old.id] = old }
      var revoked = revokeRemote ? Array(confirmedStarts.values) : []
      if let old, revokeRemote, !revoked.contains(where: { $0.nonce == old.nonce }) { revoked.append(old) }
      if revokeRemote { confirmedStarts = [:] }
      for old in revoked {
        pendingCommands.removeAll { ($0["startNonce"] as? String) == old.nonce }
        if let session, session.activationState == .activated, old.message != nil {
          let cancel: [String: Any] = ["type": "cancelStart", "workoutInstanceId": old.id,
            "startNonce": old.nonce, "ownerEpoch": old.epoch, "sentAt": Date().timeIntervalSince1970 * 1000]
          try? session.updateApplicationContext(cancel)
          session.transferUserInfo(cancel)
          if session.isReachable { session.sendMessage(cancel, replyHandler: nil, errorHandler: { _ in }) }
        }
      }
    }
  }

  private func currentPreparedLocked(_ nonce: String) -> PreparedStart? {
    guard let start = preparedStart, start.nonce == nonce, start.peer == peerGeneration,
      (start.epoch == ownerEpoch || start.acknowledged), start.acknowledged || Date().timeIntervalSince1970 <= start.expiresAt else { return nil }
    return start
  }

  func endPreparedWorkout(_ id: String?) throws -> [String: Any]? {
    var intentFailed = false
    var hadWatchAttempt = false
    let target: String? = locked {
      if let id, !id.isEmpty, id.count <= 256 {
        retireControlIntentsLocked(id)
        intentFailed = !ensureLogicalEndIntentLocked(id)
      }
      let selected: PreparedStart?
      if let id { selected = preparedStart?.id == id ? preparedStart : confirmedStarts[id] }
      else { selected = preparedStart ?? confirmedStarts.values.max(by: { $0.expiresAt < $1.expiresAt }) }
      hadWatchAttempt = selected?.submitted == true || selected?.acknowledged == true || selected?.launchRequested == true
      selected?.terminal = true
      if let selected { markCapabilityIntentLocked(selected, action: id == nil ? StrideWatchMessageType.endWorkout : "endRecording") }
      return selected?.id
    }
    // Pair/app flags are authoritative only after activation. A pure read-only
    // lookup or an unsubmitted token is not evidence of a Watch recording.
    // Keep its terminal intent best-effort without making Watch installation a
    // requirement for finishing the phone activity, even if that queue is full.
    if let id, !hadWatchAttempt, locked({
      if let session {
        guard session.activationState == .activated,
          !session.isPaired || !session.isWatchAppInstalled else { return false }
      } else if WCSession.isSupported() { return false }
      if preparedStart?.id == id { preparedStart = nil }
      confirmedStarts.removeValue(forKey: id)
      return true
    }) { return nil }
    if intentFailed {
      // Keep the association for exact cleanup retry while its terminal flag
      // already prevents any new Start submission or launch callback.
      throw NSError(domain: "StrideWatchConnectivity", code: 6,
        userInfo: [NSLocalizedDescriptionKey: "Watch recovery requests are full. Retry ending this recording after old requests expire."])
    }
    guard let target else {
      // RecoveryPrompt can stop a persisted recording before any new Start or
      // prepare call. Discover only that ID's original tuple; never create a
      // start association, and keep the caller's legacy End fallback intact.
      guard let id, !id.isEmpty, id.count <= 256 else { return nil }
      let registered = locked { ensureLogicalEndIntentLocked(id) }
      // Safe to send immediately: old Watch ignores this distinct command and
      // the caller still executes its legacy End fallback after nil.
      do { try sendCommand("endRecording", payload: ["workoutInstanceId": id]) }
      catch { locked { lastError = "Watch End could not be delivered: \(error.localizedDescription)" }; throw error }
      if registered { _ = try? sendCommand("requestCapabilities", payload: ["expectedWorkoutInstanceId": id]) }
      return nil
    }
    if let id, !id.isEmpty, id.count <= 256 {
      do { try sendCommand("endRecording", payload: ["workoutInstanceId": id]) }
      catch { locked { lastError = "Watch End could not be delivered: \(error.localizedDescription)" }; throw error }
    }
    do { try sendCommand(StrideWatchMessageType.endWorkout, payload: ["workoutInstanceId": target]) }
    catch { locked { lastError = "Watch End could not be delivered: \(error.localizedDescription)" }; throw error }
    return snapshot()
  }

  private func markCapabilityIntentLocked(_ start: PreparedStart, action: String) {
    for key in Array(capabilityExpectations.keys) {
      if capabilityExpectations[key]?.id == start.id, capabilityExpectations[key]?.nonce == start.nonce,
        capabilityExpectations[key]?.peer == peerGeneration {
        if capabilityExpectations[key]?.action == "endRecording", action != "cancelStart" { continue }
        capabilityExpectations[key]?.action = action
        capabilityExpectations[key]?.expiresAt = Date().timeIntervalSince1970 + 14_405
      }
    }
  }

  private func ensureLogicalEndIntentLocked(_ id: String) -> Bool {
    capabilityExpectations = capabilityExpectations.filter { $0.value.expiresAt >= Date().timeIntervalSince1970 }
    if capabilityExpectations.values.contains(where: { $0.id == id && $0.peer == peerGeneration && $0.action == "endRecording" }) { return true }
    // An existing discovery slot for this recording can become its terminal
    // obligation without evicting another recording's still-live intent.
    let sameRecording = capabilityExpectations.keys.filter { capabilityExpectations[$0]?.id == id && capabilityExpectations[$0]?.peer == peerGeneration }
    if !sameRecording.isEmpty {
      for key in sameRecording {
        capabilityExpectations[key]?.action = "endRecording"
        capabilityExpectations[key]?.submitted = false
        capabilityExpectations[key]?.expiresAt = Date().timeIntervalSince1970 + 14_405
      }
      return true
    }
    guard capabilityExpectations.count < 32 else {
      lastError = "Watch recovery requests are full. Phone recording can continue."
      return false
    }
    capabilityExpectations[UUID().uuidString] = CapabilityExpectation(id: id, nonce: UUID().uuidString,
      epoch: ownerEpoch, peer: peerGeneration, action: "endRecording", expiresAt: Date().timeIntervalSince1970 + 14_405)
    return true
  }

  private func retireControlIntentsLocked(_ id: String) {
    capabilityExpectations = capabilityExpectations.filter {
      $0.value.id != id || !["pauseWorkout", "resumeWorkout", "pauseRun", "resumeRun"].contains($0.value.action ?? "")
    }
  }

  func sendExplicitWorkoutControl(_ type: String, id: String) throws -> [String: Any] {
    guard ["pauseWorkout", "resumeWorkout"].contains(type), !id.isEmpty, id.count <= 256 else {
      throw NSError(domain: "StrideWatchConnectivity", code: 5, userInfo: [NSLocalizedDescriptionKey: "Watch control requires the current recording ID."])
    }
    _ = try sendCommand(type, payload: ["workoutInstanceId": id], explicit: true)
    return snapshot()
  }

  private func retryCapabilityIntents() {
    let intents: [String: String] = locked {
      capabilityExpectations = capabilityExpectations.filter { $0.value.expiresAt >= Date().timeIntervalSince1970 }
      var result: [String: String] = [:]
      for intent in capabilityExpectations.values where intent.peer == peerGeneration && !intent.submitted {
        if let action = intent.action { result[intent.id] = action }
      }
      return result
    }
    for (id, action) in intents {
      if action == "endRecording" { _ = try? sendCommand(action, payload: ["workoutInstanceId": id]) }
      _ = try? sendCommand("requestCapabilities", payload: ["expectedWorkoutInstanceId": id])
    }
  }

  private func sendExactCapabilityIntent(_ requestNonce: String, active: [String: Any]) {
    locked {
      guard let request = capabilityExpectations[requestNonce], let action = request.action,
        request.peer == peerGeneration, request.expiresAt >= Date().timeIntervalSince1970,
        active["workoutInstanceId"] as? String == request.id,
        let nonce = active["startNonce"] as? String, !nonce.isEmpty, nonce.count <= 128,
        let epoch = active["ownerEpoch"] as? String, !epoch.isEmpty, epoch.count <= 128,
        let session, session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
      let explicitControl = ["pauseWorkout", "resumeWorkout", "pauseRun", "resumeRun"].contains(action)
      if explicitControl {
        guard request.epoch == ownerEpoch, !request.submitted, session.isReachable,
          ["running", "paused"].contains(active["state"] as? String ?? "") else { return }
        if let captured = request.preparedNonce {
          guard let pending = preparedStart, pending.id == request.id, pending.nonce == captured,
            pending.peer == request.peer, !pending.acknowledged, !pending.terminal,
            !pending.submitted || Date().timeIntervalSince1970 > pending.expiresAt else { return }
          pending.terminal = true
          preparedStart = nil
        } else if preparedStart?.id == request.id { return }
        // Fresh capability confirms a control identity, not permission to
        // start or relabel Watch recording. Never replace another local B.
        if preparedStart == nil {
          let confirmed = PreparedStart(id: request.id, epoch: epoch, peer: peerGeneration,
            now: Date().timeIntervalSince1970, nonce: nonce)
          confirmed.message = ["workoutInstanceId": request.id, "startNonce": nonce, "ownerEpoch": epoch]
          confirmed.acknowledged = true
          confirmed.submitted = true
          confirmedStarts[request.id] = confirmed
        }
      }
      var control: [String: Any] = ["type": action, "workoutInstanceId": request.id,
        "sentAt": Date().timeIntervalSince1970 * 1000]
      if action != "endRecording" { control["startNonce"] = nonce; control["ownerEpoch"] = epoch }
      if explicitControl {
        for key in Array(capabilityExpectations.keys) {
          if capabilityExpectations[key]?.id == request.id, capabilityExpectations[key]?.nonce == request.nonce,
            capabilityExpectations[key]?.action == action { capabilityExpectations[key]?.submitted = true }
        }
        session.sendMessage(control, replyHandler: nil) { [weak self] error in
          DispatchQueue.global().async {
            guard let self else { return }
            self.locked {
              guard let current = self.capabilityExpectations[requestNonce], current.action == action,
                current.nonce == request.nonce, current.peer == self.peerGeneration,
                current.epoch == self.ownerEpoch, current.expiresAt >= Date().timeIntervalSince1970 else { return }
              self.lastError = "Watch control could not be delivered. Retry from iPhone. \(error.localizedDescription)"
            }
            self.emitStatus()
          }
        }
        return
      }
      try? session.updateApplicationContext(control)
      // Background delivery survives a second reachability change. The exact
      // same packet can also arrive live; Watch dedup/tombstones make it safe.
      session.transferUserInfo(control)
      if session.isReachable { session.sendMessage(control, replyHandler: nil, errorHandler: { _ in }) }
      capabilityExpectations = capabilityExpectations.filter { $0.value.id != request.id || $0.value.action == nil }
    }
  }

  func startPreparedWorkout(_ nonce: String, payload: [String: Any]) throws {
    guard let session else { throw NSError(domain: "StrideWatchConnectivity", code: 1) }
    activate()
    let kind = payload["workoutKind"] as? String ?? "run"
    let known = ["run", "strength", "mobility", "cycling", "walking", "hiking", "downhill_skiing", "cross_country_skiing", "snowboarding", "ski_touring", "snowboard_touring"]
    guard known.contains(kind), ["run", "strength", "mobility", "cycling"].contains(kind)
      || locked({ supportedWorkoutKinds.contains(kind) }) else {
      throw NSError(domain: "StrideWatchConnectivity", code: 4, userInfo: [NSLocalizedDescriptionKey: "Open the updated StrideOS watch app to enable this sport. Phone recording is still available."])
    }
    try locked {
      if let recovered = preparedStart, recovered.acknowledged, recovered.id == payload["workoutInstanceId"] as? String,
        recovered.recoveredFromNonce == nonce { return }
      guard let start = currentPreparedLocked(nonce), start.id == payload["workoutInstanceId"] as? String else {
        throw NSError(domain: "StrideWatchConnectivity", code: 5, userInfo: [NSLocalizedDescriptionKey: "Watch start was cancelled."])
      }
      if session.activationState == .activated {
        guard session.isPaired && session.isWatchAppInstalled else {
          throw NSError(domain: "StrideWatchConnectivity", code: 2, userInfo: [NSLocalizedDescriptionKey: "Watch connection is still activating."])
        }
      }
      if start.message == nil {
        var message = payload
        message["type"] = StrideWatchMessageType.startWorkout
        message["sentAt"] = Date().timeIntervalSince1970 * 1000
        message["startNonce"] = start.nonce
        message["ownerEpoch"] = start.epoch
        start.message = message
        lastCommandType = StrideWatchMessageType.startWorkout
        lastCommandMethod = "queued"
      }
    }
    flushPreparedStartIfPossible()
    emitStatus()
  }

  private func flushPreparedStartIfPossible() {
    let nonce: String? = locked {
      guard let session, session.activationState == .activated, session.isPaired, session.isWatchAppInstalled,
        let pending = preparedStart, let start = currentPreparedLocked(pending.nonce), !start.terminal,
        !start.acknowledged, !start.submitted, let message = start.message else { return nil }
      start.submitted = true
      start.recoveryRequiresFence = session.isReachable
      try? session.updateApplicationContext(message)
      if session.isReachable { sendPreparedPacketLocked(start, session: session) }
      else { session.transferUserInfo(message) }
      return start.nonce
    }
    if let nonce { launchPreparedStart(nonce, force: false, requireFence: false) }
  }

  private func sendPreparedPacketLocked(_ start: PreparedStart, session: WCSession) {
    guard let message = start.message else { return }
    lastCommandType = StrideWatchMessageType.startWorkout
    lastCommandAt = Date().timeIntervalSince1970 * 1000
    lastCommandMethod = "sendMessage"
    session.sendMessage(message, replyHandler: nil) { [weak self] error in
      DispatchQueue.global().async { self?.preparedSendFailed(start.nonce, error: error) }
    }
    if let followUp = start.followUp {
      let control: [String: Any] = ["type": followUp, "workoutInstanceId": start.id,
        "startNonce": start.nonce, "ownerEpoch": start.epoch, "sentAt": Date().timeIntervalSince1970 * 1000]
      session.sendMessage(control, replyHandler: nil, errorHandler: { _ in })
    }
  }

  private func preparedSendFailed(_ nonce: String, error: Error) {
    let recover = locked { () -> Bool? in
      guard let start = currentPreparedLocked(nonce), !start.acknowledged, !start.terminal else { return nil }
      start.recoveryNeeded = true
      lastError = "sendMessage failed: \(error.localizedDescription)"
      return fenceAvailableLocked()
    }
    guard let recover else { return }
    if recover { launchPreparedStart(nonce, force: true, requireFence: true) }
    else { _ = try? sendCommand("requestCapabilities", payload: [:]) }
    emitStatus()
  }

  private func launchPreparedStart(_ nonce: String, force: Bool, requireFence: Bool) {
    locked {
      guard let session, session.activationState == .activated, session.isPaired, session.isWatchAppInstalled,
        let start = currentPreparedLocked(nonce), !start.acknowledged, !start.terminal, !start.launchRequested,
        let message = start.message, (!requireFence || fenceAvailableLocked()),
        (force || !session.isReachable), HKHealthStore.isHealthDataAvailable() else { return }
      let configuration = HKWorkoutConfiguration()
      switch message["workoutKind"] as? String {
      case nil, "run": configuration.activityType = .running
      case "cycling": configuration.activityType = .cycling
      case "strength": configuration.activityType = .traditionalStrengthTraining
      case "mobility": configuration.activityType = .flexibility
      case "walking": configuration.activityType = .walking
      case "hiking", "ski_touring", "snowboard_touring": configuration.activityType = .hiking
      case "downhill_skiing": configuration.activityType = .downhillSkiing
      case "cross_country_skiing": configuration.activityType = .crossCountrySkiing
      case "snowboarding": configuration.activityType = .snowboarding
      default: return
      }
      configuration.locationType = ["strength", "mobility"].contains(message["workoutKind"] as? String ?? "")
        || message["environment"] as? String == "indoor" ? .indoor : .outdoor
      start.launchRequested = true
      healthStore.startWatchApp(with: configuration) { [weak self] success, error in
        DispatchQueue.global().async {
          guard let self else { return }
          let current = self.locked { () -> Bool in
            guard let active = self.currentPreparedLocked(nonce), !active.acknowledged, !active.terminal else { return false }
            if !success { self.lastError = "Watch app launch failed: \(error?.localizedDescription ?? "unknown")" }
            return success
          }
          if current { self.resendPreparedStartIfReachable() }
          self.emitStatus()
        }
      }
    }
  }

  private func resendPreparedStartIfReachable() {
    locked {
      guard let session, session.activationState == .activated, session.isReachable,
        let pending = preparedStart, let start = currentPreparedLocked(pending.nonce), !start.acknowledged, !start.terminal,
        !start.liveResendUsed, start.launchRequested,
        (!start.recoveryRequiresFence || fenceAvailableLocked()) else { return }
      start.liveResendUsed = true
      sendPreparedPacketLocked(start, session: session)
    }
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
        "supportedWorkoutKinds": supportedWorkoutKinds,
        "startFenceProtocolVersion": fenceAvailableLocked() ? 1 : 0,
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
  func sendCommand(_ type: String, payload: [String: Any], explicit: Bool = false) throws -> [String: Any] {
    if type == StrideWatchMessageType.startWorkout, let kind = payload["workoutKind"] as? String {
      let known = ["run", "strength", "mobility", "cycling", "walking", "hiking", "downhill_skiing", "cross_country_skiing", "snowboarding", "ski_touring", "snowboard_touring"]
      guard known.contains(kind) else {
        throw NSError(domain: "StrideWatchConnectivity", code: 3, userInfo: [NSLocalizedDescriptionKey: "Unsupported workout type."])
      }
      if !["run", "strength", "mobility", "cycling"].contains(kind), !locked({ supportedWorkoutKinds.contains(kind) }) {
        throw NSError(domain: "StrideWatchConnectivity", code: 4, userInfo: [NSLocalizedDescriptionKey: "Open the updated StrideOS watch app to enable this sport. Phone recording is still available."])
      }
    }
    guard let session else {
      throw NSError(domain: "StrideWatchConnectivity", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Apple Watch connectivity is unavailable on this device.",
      ])
    }

    activate()

    var message = payload
    var controlLookupId: String?
    defer {
      if let controlLookupId { _ = try? sendCommand("requestCapabilities", payload: ["expectedWorkoutInstanceId": controlLookupId]) }
    }
    message["type"] = type
    message["sentAt"] = Date().timeIntervalSince1970 * 1000
    if type == "requestCapabilities" {
      let nonce = UUID().uuidString
      locked { capabilityRequestNonce = nonce }
      message["capabilityRequestNonce"] = nonce
      locked {
        capabilityExpectations = capabilityExpectations.filter { $0.value.expiresAt >= Date().timeIntervalSince1970 }
        let expected = payload["expectedWorkoutInstanceId"] as? String ?? preparedStart?.id
        if let expected {
          message["expectedWorkoutInstanceId"] = expected
          if let intent = capabilityExpectations.values.first(where: { $0.id == expected && $0.action != nil && $0.peer == peerGeneration }) {
            if capabilityExpectations.count >= 32 {
              capabilityExpectations = capabilityExpectations.filter { $0.value.id != expected || $0.value.action == nil }
            }
            if capabilityExpectations.count < 32 { capabilityExpectations[nonce] = intent }
          } else if let start = preparedStart, start.id == expected, capabilityExpectations.count < 32 {
            capabilityExpectations[nonce] = CapabilityExpectation(id: expected, nonce: start.nonce,
              epoch: ownerEpoch, peer: peerGeneration, action: nil, expiresAt: start.expiresAt)
          }
        }
      }
    }
    locked {
      let requestedId = payload["workoutInstanceId"] as? String
      let association: PreparedStart?
      if let requestedId {
        association = preparedStart?.id == requestedId ? preparedStart : confirmedStarts[requestedId]
      } else {
        association = preparedStart ?? confirmedStarts.values.max(by: { $0.expiresAt < $1.expiresAt })
      }
      if ["pauseWorkout", "resumeWorkout", "pauseRun", "resumeRun"].contains(type),
        let id = requestedId, !id.isEmpty, id.count <= 256 {
        retireControlIntentsLocked(id)
        let terminal = capabilityExpectations.values.contains { $0.id == id && $0.action == "endRecording" }
        let needsDiscovery = association == nil || (association?.acknowledged == false
          && (association?.submitted == false || Date().timeIntervalSince1970 > (association?.expiresAt ?? 0)))
        if explicit, needsDiscovery, association?.terminal != true, !terminal {
          capabilityExpectations = capabilityExpectations.filter { $0.value.expiresAt >= Date().timeIntervalSince1970 }
          if capabilityExpectations.count < 32 {
            let lookupKey = UUID().uuidString
            capabilityExpectations[lookupKey] = CapabilityExpectation(id: id, nonce: UUID().uuidString,
              epoch: ownerEpoch, peer: peerGeneration, action: type, expiresAt: Date().timeIntervalSince1970 + 90)
            capabilityExpectations[lookupKey]?.preparedNonce = association?.nonce
            controlLookupId = id
          } else { lastError = "Watch recovery requests are full. Retry from iPhone." }
        }
      }
      if let start = association, type != "endRecording", type.hasPrefix("pause") || type.hasPrefix("resume") || type.hasPrefix("end") {
        message["workoutInstanceId"] = start.id
        message["startNonce"] = start.nonce
        message["ownerEpoch"] = start.epoch
        if type == StrideWatchMessageType.endWorkout || type == StrideWatchMessageType.endRun {
          markCapabilityIntentLocked(start, action: type)
          if preparedStart?.nonce == start.nonce { preparedStart = nil }
          confirmedStarts.removeValue(forKey: start.id)
        } else if type.hasPrefix("pause") || type.hasPrefix("resume") {
          start.followUp = type
          start.followUpIsExplicit = explicit
        }
      }
    }

    if type == StrideWatchMessageType.endWorkout || type == StrideWatchMessageType.endRun {
      clearPendingLiveStart(matching: payload["workoutInstanceId"] as? String)
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

    if type == "endRecording" {
      guard session.activationState == .activated else {
        throw NSError(domain: "StrideWatchConnectivity", code: 7,
          userInfo: [NSLocalizedDescriptionKey: "Watch End is waiting for connectivity activation. Retry ending this recording."])
      }
      // Accept exact cleanup only after handing the terminal event to the OS
      // background queue, including when live delivery is currently reachable.
      // An in-memory activation queue alone cannot replace the durable journal.
      try? session.updateApplicationContext(message)
      session.transferUserInfo(message)
      if session.isReachable { session.sendMessage(message, replyHandler: nil, errorHandler: { _ in }) }
      recordCommand(type, method: "transferUserInfo")
      return message
    }

    let supersededEnd = (type == StrideWatchMessageType.endWorkout || type == StrideWatchMessageType.endRun) && locked {
      guard let requested = payload["workoutInstanceId"] as? String,
        let pending = pendingLiveStart?["workoutInstanceId"] as? String else { return false }
      return requested != pending
    }
    if !supersededEnd && shouldPublishAsLatestContext(type) && session.activationState == .activated {
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
    case nil, "run": configuration.activityType = .running
    case "cycling": configuration.activityType = .cycling
    case "strength": configuration.activityType = .traditionalStrengthTraining
    case "mobility": configuration.activityType = .flexibility
    case "walking": configuration.activityType = .walking
    case "hiking", "ski_touring", "snowboard_touring": configuration.activityType = .hiking
    case "downhill_skiing": configuration.activityType = .downhillSkiing
    case "cross_country_skiing": configuration.activityType = .crossCountrySkiing
    case "snowboarding": configuration.activityType = .snowboarding
    default: return
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

  private func clearPendingLiveStart(matching requestedId: String? = nil) {
    locked {
      if let requestedId, let pendingId = pendingLiveStart?["workoutInstanceId"] as? String, requestedId != pendingId { return }
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
    flushPreparedStartIfPossible()
    retryCapabilityIntents()
    emitStatus()
  }

  func sessionDidBecomeInactive(_ session: WCSession) {
    resetPeerCapabilities()
    emitStatus()
  }

  func sessionDidDeactivate(_ session: WCSession) {
    resetPeerCapabilities()
    session.activate()
    emitStatus()
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    if session.isReachable { _ = try? sendCommand("requestCapabilities", payload: [:]) }
    flushPendingCommandsIfPossible()
    flushPreparedStartIfPossible()
    resendPendingLiveStartIfReachable()
    resendPreparedStartIfReachable()
    retryCapabilityIntents()
    emitStatus()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    resetPeerCapabilities()
    emitStatus()
  }

  private func resetPeerCapabilities() {
    cancelPendingStart()
    locked {
      peerGeneration += 1
      supportedWorkoutKinds = []
      confirmedStarts = [:]
      startFenceVersion = 0
      startFenceValidatedAt = 0
      capabilityRequestNonce = nil
      capabilityExpectations = [:]
    }
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
    case "capabilities":
      guard let timestamp = message["timestamp"] as? NSNumber,
        abs(now - timestamp.doubleValue) <= 120_000 else { return }
      locked { supportedWorkoutKinds = message["supportedWorkoutKinds"] as? [String] ?? [] }
      let recovery: String? = locked {
        startFenceVersion = 0
        startFenceValidatedAt = 0
        guard session?.activationState == .activated,
          let nonce = message["capabilityRequestNonce"] as? String, nonce == capabilityRequestNonce else { return nil }
        startFenceVersion = (message["startFenceProtocolVersion"] as? NSNumber)?.intValue == 1 ? 1 : 0
        startFenceValidatedAt = Date().timeIntervalSince1970
        if fenceAvailableLocked(), let expectation = capabilityExpectations[nonce], expectation.action == nil,
          expectation.peer == peerGeneration, expectation.epoch == ownerEpoch,
          expectation.expiresAt >= Date().timeIntervalSince1970,
          let pending = preparedStart, currentPreparedLocked(pending.nonce) != nil, !pending.acknowledged,
          expectation.id == pending.id, expectation.nonce == pending.nonce,
          let active = message["activeStart"] as? [String: Any], active["workoutInstanceId"] as? String == pending.id,
          ["running", "paused"].contains(active["state"] as? String ?? ""),
          let nonce = active["startNonce"] as? String, !nonce.isEmpty, nonce.count <= 128,
          let epoch = active["ownerEpoch"] as? String, !epoch.isEmpty, epoch.count <= 128 {
          let recovered = PreparedStart(id: pending.id, epoch: epoch, peer: peerGeneration,
            now: Date().timeIntervalSince1970, nonce: nonce)
          recovered.message = ["workoutInstanceId": pending.id, "startNonce": nonce, "ownerEpoch": epoch]
          recovered.acknowledged = true
          recovered.submitted = true
          recovered.recoveredFromNonce = pending.nonce
          recovered.followUp = pending.followUpIsExplicit ? pending.followUp : nil
          recovered.followUpIsExplicit = pending.followUpIsExplicit
          preparedStart = recovered
          confirmedStarts[recovered.id] = recovered
          // Replay only the latest explicit control entered during this exact
          // discovery. An accepted original recording never gets a new Start.
          if let followUp = recovered.followUp, let session,
            session.activationState == .activated, session.isPaired, session.isWatchAppInstalled {
            let control: [String: Any] = ["type": followUp, "workoutInstanceId": recovered.id,
              "startNonce": recovered.nonce, "ownerEpoch": recovered.epoch,
              "sentAt": Date().timeIntervalSince1970 * 1000]
            if session.isReachable {
              session.sendMessage(control, replyHandler: nil) { [weak self] _ in
                DispatchQueue.global().async {
                  self?.locked {
                    guard let current = self?.currentPreparedLocked(recovered.nonce), !current.terminal,
                      current.followUp == followUp, session.activationState == .activated,
                      session.isPaired, session.isWatchAppInstalled else { return }
                    self?.lastError = "Watch control could not be delivered. Retry from iPhone."
                  }
                }
              }
            } else { lastError = "Watch control could not be delivered. Retry from iPhone." }
          }
        }
        return preparedStart?.recoveryNeeded == true && fenceAvailableLocked() ? preparedStart?.nonce : nil
      }
      if let requestNonce = message["capabilityRequestNonce"] as? String,
        (message["startFenceProtocolVersion"] as? NSNumber)?.intValue == 1,
        let active = message["activeStart"] as? [String: Any],
        ["starting", "running", "paused"].contains(active["state"] as? String ?? "") {
        sendExactCapabilityIntent(requestNonce, active: active)
      }
      if let recovery { launchPreparedStart(recovery, force: true, requireFence: true) }
      resendPreparedStartIfReachable()
      emitStatus()
    case "telemetry":
      emit("onWatchTelemetry", sanitizePayload(message))
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
        if let start = preparedStart, currentPreparedLocked(start.nonce) != nil, !start.terminal,
          message["workoutInstanceId"] as? String == start.id, message["startNonce"] as? String == start.nonce,
          message["ownerEpoch"] as? String == start.epoch,
          [StrideWatchMessageType.startWorkout, StrideWatchMessageType.startRun].contains(message["command"] as? String ?? ""),
          message["accepted"] as? Bool == true {
          start.acknowledged = true
          confirmedStarts[start.id] = start
          if confirmedStarts.count > 20, let oldest = confirmedStarts.values.filter({ $0.nonce != start.nonce })
            .min(by: { $0.expiresAt < $1.expiresAt }) { confirmedStarts.removeValue(forKey: oldest.id) }
          start.recoveryNeeded = false
          lastError = nil
        }
        if let start = preparedStart, currentPreparedLocked(start.nonce) != nil,
          message["workoutInstanceId"] as? String == start.id, message["startNonce"] as? String == start.nonce,
          message["ownerEpoch"] as? String == start.epoch,
          [StrideWatchMessageType.startWorkout, StrideWatchMessageType.startRun].contains(message["command"] as? String ?? ""),
          message["accepted"] as? Bool == false, message["reason"] as? String != "queued_start_ignored" {
          start.terminal = true
          start.recoveryNeeded = false
          lastError = message["reason"] as? String ?? "Watch start was rejected. Retry from iPhone."
        }
        lastAckAt = now
        lastAckCommand = message["command"] as? String
        lastAckAccepted = message["accepted"] as? Bool
        lastAckReason = message["reason"] as? String
      }
      emit("onWatchAck", sanitizePayload(message))
      emitStatus()
    case StrideWatchMessageType.error:
      if let nonce = message["startNonce"] as? String, let id = message["workoutInstanceId"] as? String {
        let current = locked { () -> Bool in
          guard let start = preparedStart?.id == id ? preparedStart : confirmedStarts[id] else { return false }
          return start.nonce == nonce && start.epoch == message["ownerEpoch"] as? String
        }
        guard current else { return }
      }
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
      "endRecording",
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
  private let pedometer = CMPedometer()
  private var cadenceSessionId: String?

  public func definition() -> ModuleDefinition {
    Name("StrideWatchConnectivity")

    Events("onWatchStatus", "onWatchHeartRate", "onWatchWorkoutState", "onWatchError", "onWatchAck", "onWatchTelemetry", "onPhoneCadence")

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
      _ = try? StrideWatchConnectivityCoordinator.shared.sendCommand("requestCapabilities", payload: [:])
      promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
    }

    // An explicit Health setup request, separate from workout commands. It may
    // queue until the Watch next opens; receipt is never an authorization grant.
    AsyncFunction("requestHealthSetup") { (promise: Promise) in
      let coordinator = StrideWatchConnectivityCoordinator.shared
      coordinator.activate()
      let status = coordinator.snapshot()
      guard status["isPaired"] as? Bool == true,
        status["isWatchAppInstalled"] as? Bool == true else {
        promise.resolve(false)
        return
      }
      do {
        try coordinator.sendCommand("setupHealthPermissions", payload: ["setupRequestId": UUID().uuidString])
        promise.resolve(true)
      } catch {
        promise.reject("ERR_STRIDE_WATCH_HEALTH_SETUP", error.localizedDescription)
      }
    }

    AsyncFunction("startPhoneCadence") { (id: String, promise: Promise) in
      DispatchQueue.main.async {
        // A missing usage description must never crash the production app.
        guard Bundle.main.object(forInfoDictionaryKey: "NSMotionUsageDescription") != nil,
          CMPedometer.isCadenceAvailable() else { promise.resolve(false); return }
        self.pedometer.stopUpdates()
        self.cadenceSessionId = id
        self.pedometer.startUpdates(from: Date()) { [weak self] data, _ in
          guard let self, let data, let cadence = data.currentCadence?.doubleValue,
            cadence.isFinite, cadence >= 0 else { return }
          DispatchQueue.main.async {
            guard self.cadenceSessionId == id else { return }
            self.sendEvent("onPhoneCadence", ["workoutInstanceId": id, "cadenceSpm": cadence * 60,
              "timestamp": data.endDate.timeIntervalSince1970 * 1000, "source": "phone_motion"])
          }
        }
        promise.resolve(true)
      }
    }

    Function("stopPhoneCadence") { (id: String) in
      DispatchQueue.main.async {
        guard self.cadenceSessionId == id else { return }
        self.cadenceSessionId = nil
        self.pedometer.stopUpdates()
      }
    }

    OnDestroy {
      StrideWatchConnectivityCoordinator.shared.cancelPendingStart()
      self.pedometer.stopUpdates()
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

    Function("prepareWorkoutStart") { (id: String) -> String in
      StrideWatchConnectivityCoordinator.shared.prepareWorkoutStart(id)
    }

    Function("cancelPendingStart") { (revokeRemote: Bool) in
      StrideWatchConnectivityCoordinator.shared.cancelPendingStart(revokeRemote: revokeRemote)
    }

    Function("endPreparedWorkout") { (id: String?) -> [String: Any]? in
      try StrideWatchConnectivityCoordinator.shared.endPreparedWorkout(id)
    }

    Function("sendExplicitWorkoutControl") { (type: String, id: String) -> [String: Any] in
      try StrideWatchConnectivityCoordinator.shared.sendExplicitWorkoutControl(type, id: id)
    }

    AsyncFunction("startPreparedWorkout") {
      (nonce: String, kind: String, id: String, title: String?, environment: String?, targetZone: Int?, promise: Promise) in
      do {
        var payload: [String: Any] = ["workoutKind": kind, "workoutInstanceId": id]
        if let title { payload["title"] = title }
        if let environment { payload["environment"] = environment }
        if let targetZone { payload["targetZone"] = targetZone }
        try StrideWatchConnectivityCoordinator.shared.startPreparedWorkout(nonce, payload: payload)
        promise.resolve(StrideWatchConnectivityCoordinator.shared.snapshot())
      } catch {
        promise.reject("ERR_STRIDE_WATCH_PREPARED_START", error.localizedDescription)
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
