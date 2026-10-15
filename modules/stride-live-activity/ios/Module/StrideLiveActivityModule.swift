import ActivityKit
import ExpoModulesCore
import StrideLiveActivityCore

private enum StrideLiveActivityStatus {
  static let running = "Running"
  static let paused = "Paused"
  static let finished = "Finished"
}

private enum StrideRunControlCommandStore {
  static let appGroupIdentifier = "group.com.mooremovement.strideos"
  static let idKey = "StrideOS.pendingRunControlCommand.id"
  static let actionKey = "StrideOS.pendingRunControlCommand.action"
  static let createdAtKey = "StrideOS.pendingRunControlCommand.createdAt"
  static let workoutIdKey = "StrideOS.pendingRunControlCommand.workoutInstanceId"
  static let sessionIdKey = "StrideOS.pendingRunControlCommand.sessionId"
  static let sourceKey = "StrideOS.pendingRunControlCommand.sessionSource"

  static func read() -> [String: Any]? {
    guard
      let defaults = UserDefaults(suiteName: appGroupIdentifier),
      let id = defaults.string(forKey: idKey),
      let action = defaults.string(forKey: actionKey)
    else {
      return nil
    }

    return [
      "id": id,
      "action": action,
      "createdAt": defaults.double(forKey: createdAtKey),
      "workoutInstanceId": defaults.string(forKey: workoutIdKey) ?? "",
      "sessionId": defaults.string(forKey: sessionIdKey) ?? "",
      "sessionSource": defaults.string(forKey: sourceKey) ?? "",
    ]
  }

  static func clear(id: String) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else { return }
    guard defaults.string(forKey: idKey) == id else { return }
    defaults.removeObject(forKey: idKey)
    defaults.removeObject(forKey: actionKey)
    defaults.removeObject(forKey: createdAtKey)
    defaults.removeObject(forKey: workoutIdKey)
    defaults.removeObject(forKey: sessionIdKey)
    defaults.removeObject(forKey: sourceKey)
    defaults.synchronize()
  }
}

public final class StrideLiveActivityModule: Module {
  private static var currentActivityId: String?
  private static var currentStrengthActivityId: String?
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("StrideLiveActivity")

    Events("onPauseIntent", "onResumeIntent", "onStopIntent",
           "onPauseStrengthIntent", "onResumeStrengthIntent", "onMarkSetCompleteIntent")

    OnStartObserving {
      let center = NotificationCenter.default
      self.observers.append(
        center.addObserver(forName: Notification.Name("StrideOS.pauseRun"), object: nil, queue: .main) { [weak self] _ in
          self?.sendEvent("onPauseIntent", [:])
        }
      )
      self.observers.append(
        center.addObserver(forName: Notification.Name("StrideOS.resumeRun"), object: nil, queue: .main) { [weak self] _ in
          self?.sendEvent("onResumeIntent", [:])
        }
      )
      self.observers.append(
        center.addObserver(forName: Notification.Name("StrideOS.stopRun"), object: nil, queue: .main) { [weak self] _ in
          self?.sendEvent("onStopIntent", [:])
        }
      )
      self.observers.append(
        center.addObserver(forName: Notification.Name("StrideOS.pauseStrength"), object: nil, queue: .main) { [weak self] _ in
          self?.sendEvent("onPauseStrengthIntent", [:])
        }
      )
      self.observers.append(
        center.addObserver(forName: Notification.Name("StrideOS.resumeStrength"), object: nil, queue: .main) { [weak self] _ in
          self?.sendEvent("onResumeStrengthIntent", [:])
        }
      )
      self.observers.append(
        center.addObserver(forName: Notification.Name("StrideOS.markSetComplete"), object: nil, queue: .main) { [weak self] _ in
          self?.sendEvent("onMarkSetCompleteIntent", [:])
        }
      )
    }

    OnStopObserving {
      self.observers.forEach { NotificationCenter.default.removeObserver($0) }
      self.observers = []
    }

    Function("isAvailable") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    Function("getPendingRunControlCommand") { () -> [String: Any]? in
      StrideRunControlCommandStore.read()
    }

    Function("clearPendingRunControlCommand") { (id: String) -> Void in
      StrideRunControlCommandStore.clear(id: id)
    }

    // Keep the original positional API for older JS/native combinations.
    AsyncFunction("startOutdoor") { (payload: [String: Any], promise: Promise) in
      guard #available(iOS 16.1, *) else { promise.resolve(nil); return }
      Task {
        do {
          await Self.endExistingActivityIfNeeded()
          let state = Self.makeOutdoorState(payload)
          let attributes = StrideRunActivityAttributes(runName: payload["runName"] as? String ?? "Activity")
          let activity: Activity<StrideRunActivityAttributes>
          if #available(iOS 16.2, *) {
            activity = try Activity.request(attributes: attributes,
              content: ActivityContent(state: state, staleDate: state.telemetryStaleDate()), pushType: nil)
          } else {
            activity = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
          }
          Self.currentActivityId = activity.id
          promise.resolve(activity.id)
        } catch { promise.reject("ERR_STRIDE_OUTDOOR_START", error.localizedDescription) }
      }
    }

    AsyncFunction("updateOutdoor") { (payload: [String: Any], promise: Promise) in
      guard #available(iOS 16.1, *) else { promise.resolve(nil); return }
      Task {
        guard let activity = Self.currentActivity(), Self.matchesSession(payload, state: activity.contentState) else { promise.resolve(nil); return }
        let state = Self.makeOutdoorState(payload)
        if #available(iOS 16.2, *) {
          await activity.update(ActivityContent(state: state, staleDate: state.telemetryStaleDate()))
        } else { await activity.update(using: state) }
        promise.resolve(nil)
      }
    }

    AsyncFunction("endOutdoor") { (payload: [String: Any], promise: Promise) in
      guard #available(iOS 16.1, *) else { promise.resolve(nil); return }
      Task {
        guard let activity = Self.currentActivity(), Self.matchesSession(payload, state: activity.contentState) else { promise.resolve(nil); return }
        var state = Self.makeOutdoorState(payload)
        state.status = StrideLiveActivityStatus.finished
        if #available(iOS 16.2, *) {
          await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
        } else { await activity.end(using: state, dismissalPolicy: .immediate) }
        if Self.currentActivityId == activity.id { Self.currentActivityId = nil }
        promise.resolve(nil)
      }
    }

    AsyncFunction("endOutdoorIfMatching") { (workoutInstanceId: String, promise: Promise) in
      guard !workoutInstanceId.isEmpty else { promise.resolve(false); return }
      guard #available(iOS 16.1, *) else { promise.resolve(true); return }
      Task {
        guard let activity = Activity<StrideRunActivityAttributes>.activities.first(where: {
          $0.contentState.workoutInstanceId == workoutInstanceId || $0.contentState.sessionId == workoutInstanceId
        }) else { promise.resolve(true); return }
        var state = activity.contentState
        state.status = StrideLiveActivityStatus.finished
        if #available(iOS 16.2, *) {
          await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
        } else { await activity.end(using: state, dismissalPolicy: .immediate) }
        if Self.currentActivityId == activity.id { Self.currentActivityId = nil }
        promise.resolve(true)
      }
    }

    AsyncFunction("start") {
      (
        runName: String,
        elapsedSeconds: Int,
        distanceMiles: Double,
        averagePace: String,
        heartRate: Int,
        zoneLabel: String,
        zoneStatus: String,
        status: String,
        isPaused: Bool,
        promise: Promise
      ) in
      guard #available(iOS 16.1, *) else {
        promise.resolve(nil)
        return
      }

      Task {
        do {
          await Self.endExistingActivityIfNeeded()
          let attributes = StrideRunActivityAttributes(runName: runName)
          let state = Self.makeState(
            elapsedSeconds: elapsedSeconds,
            distanceMiles: distanceMiles,
            averagePace: averagePace,
            heartRate: heartRate,
            zoneLabel: zoneLabel,
            zoneStatus: zoneStatus,
            status: status,
            isPaused: isPaused
          )

          let activity: Activity<StrideRunActivityAttributes>
          if #available(iOS 16.2, *) {
            let content = ActivityContent(
              state: state,
              staleDate: state.telemetryStaleDate(),
              relevanceScore: 0.95
            )
            activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
          } else {
            activity = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
          }

          Self.currentActivityId = activity.id
          promise.resolve(activity.id)
        } catch {
          promise.reject("ERR_STRIDE_LIVE_ACTIVITY_START", error.localizedDescription)
        }
      }
    }

    AsyncFunction("update") {
      (
        elapsedSeconds: Int,
        distanceMiles: Double,
        averagePace: String,
        heartRate: Int,
        zoneLabel: String,
        zoneStatus: String,
        status: String,
        isPaused: Bool,
        promise: Promise
      ) in
      guard #available(iOS 16.1, *) else {
        promise.resolve(nil)
        return
      }

      Task {
        guard let activity = Self.currentActivity() else {
          promise.resolve(nil)
          return
        }

        let state = Self.makeState(
          elapsedSeconds: elapsedSeconds,
          distanceMiles: distanceMiles,
          averagePace: averagePace,
          heartRate: heartRate,
          zoneLabel: zoneLabel,
          zoneStatus: zoneStatus,
          status: status,
          isPaused: isPaused
        )

        if #available(iOS 16.2, *) {
          let content = ActivityContent(
            state: state,
            staleDate: state.telemetryStaleDate(),
            relevanceScore: 0.95
          )
          await activity.update(content)
        } else {
          await activity.update(using: state)
        }
        promise.resolve(nil)
      }
    }

    AsyncFunction("end") {
      (
        elapsedSeconds: Int,
        distanceMiles: Double,
        averagePace: String,
        heartRate: Int,
        zoneLabel: String,
        zoneStatus: String,
        status: String,
        promise: Promise
      ) in
      guard #available(iOS 16.1, *) else {
        promise.resolve(nil)
        return
      }

      Task {
        guard let activity = Self.currentActivity() else {
          promise.resolve(nil)
          return
        }

        let state = Self.makeState(
          elapsedSeconds: elapsedSeconds,
          distanceMiles: distanceMiles,
          averagePace: averagePace,
          heartRate: heartRate,
          zoneLabel: zoneLabel,
          zoneStatus: zoneStatus,
          status: status.isEmpty ? StrideLiveActivityStatus.finished : status,
          isPaused: false
        )

        // .immediate: finished runs must not linger on the Lock Screen.
        if #available(iOS 16.2, *) {
          let content = ActivityContent(state: state, staleDate: nil, relevanceScore: 0.1)
          await activity.end(content, dismissalPolicy: .immediate)
        } else {
          await activity.end(using: state, dismissalPolicy: .immediate)
        }
        Self.currentActivityId = nil
        promise.resolve(nil)
      }
    }

    // ─── Strength Live Activity ───────────────────────────────────────────────

    AsyncFunction("startStrength") {
      (
        workoutName: String,
        elapsedSeconds: Int,
        currentExercise: String,
        nextExercise: String,
        setsCompleted: Int,
        totalSets: Int,
        promise: Promise
      ) in
      guard #available(iOS 16.1, *) else { promise.resolve(nil); return }
      Task {
        do {
          await Self.endExistingStrengthActivityIfNeeded()
          let attributes = StrideStrengthActivityAttributes(workoutName: workoutName)
          let state = StrideStrengthActivityAttributes.ContentState(
            elapsedSeconds: max(0, elapsedSeconds),
            currentExercise: currentExercise,
            nextExercise: nextExercise,
            setsCompleted: max(0, setsCompleted),
            totalSets: max(1, totalSets),
            isPaused: false
          )
          let activity: Activity<StrideStrengthActivityAttributes>
          if #available(iOS 16.2, *) {
            activity = try Activity.request(
              attributes: attributes,
              content: ActivityContent(state: state, staleDate: Date().addingTimeInterval(90), relevanceScore: 0.9),
              pushType: nil
            )
          } else {
            activity = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
          }
          Self.currentStrengthActivityId = activity.id
          promise.resolve(activity.id)
        } catch {
          promise.reject("ERR_STRIDE_STRENGTH_START", error.localizedDescription)
        }
      }
    }

    AsyncFunction("updateStrength") {
      (
        elapsedSeconds: Int,
        currentExercise: String,
        nextExercise: String,
        setsCompleted: Int,
        totalSets: Int,
        isPaused: Bool,
        promise: Promise
      ) in
      guard #available(iOS 16.1, *) else { promise.resolve(nil); return }
      Task {
        guard let activity = Self.currentStrengthActivity() else { promise.resolve(nil); return }
        let state = StrideStrengthActivityAttributes.ContentState(
          elapsedSeconds: max(0, elapsedSeconds),
          currentExercise: currentExercise,
          nextExercise: nextExercise,
          setsCompleted: max(0, setsCompleted),
          totalSets: max(1, totalSets),
          isPaused: isPaused
        )
        if #available(iOS 16.2, *) {
          await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(90), relevanceScore: 0.9))
        } else {
          await activity.update(using: state)
        }
        promise.resolve(nil)
      }
    }

    AsyncFunction("endStrength") { (promise: Promise) in
      guard #available(iOS 16.1, *) else { promise.resolve(nil); return }
      Task {
        guard let activity = Self.currentStrengthActivity() else { promise.resolve(nil); return }
        let state = activity.contentState
        if #available(iOS 16.2, *) {
          await activity.end(
            ActivityContent(state: state, staleDate: nil, relevanceScore: 0.1),
            dismissalPolicy: .immediate
          )
        } else {
          await activity.end(using: state, dismissalPolicy: .immediate)
        }
        Self.currentStrengthActivityId = nil
        promise.resolve(nil)
      }
    }
  }

  @available(iOS 16.1, *)
  private static func currentStrengthActivity() -> Activity<StrideStrengthActivityAttributes>? {
    if let id = currentStrengthActivityId {
      return Activity<StrideStrengthActivityAttributes>.activities.first(where: { $0.id == id })
    }
    return Activity<StrideStrengthActivityAttributes>.activities.first
  }

  @available(iOS 16.1, *)
  private static func endExistingStrengthActivityIfNeeded() async {
    for activity in Activity<StrideStrengthActivityAttributes>.activities {
      if #available(iOS 16.2, *) {
        await activity.end(ActivityContent(state: activity.contentState, staleDate: nil), dismissalPolicy: .immediate)
      } else {
        await activity.end(using: activity.contentState, dismissalPolicy: .immediate)
      }
    }
    currentStrengthActivityId = nil
  }

  @available(iOS 16.1, *)
  private static func matchesSession(_ payload: [String: Any], state: StrideRunActivityAttributes.ContentState) -> Bool {
    guard let current = state.workoutInstanceId ?? state.sessionId, !current.isEmpty,
      let requested = payload["workoutInstanceId"] as? String ?? payload["sessionId"] as? String, !requested.isEmpty else { return false }
    return requested == current
      && payload["sessionSource"] as? String == state.sessionSource
  }

  @available(iOS 16.1, *)
  private static func makeOutdoorState(_ payload: [String: Any]) -> StrideRunActivityAttributes.ContentState {
    func number(_ key: String) -> Double? {
      guard let value = payload[key] as? NSNumber, value.doubleValue.isFinite else { return nil }
      return value.doubleValue
    }
    func text(_ key: String) -> String? { payload[key] as? String }
    var state = makeState(
      elapsedSeconds: Int(min(Double(Int32.max), max(0, number("elapsedSeconds") ?? 0))),
      distanceMiles: max(0, number("distanceMiles") ?? 0), averagePace: text("averagePace") ?? "--:--",
      heartRate: Int(min(1000, max(0, number("heartRate") ?? 0))),
      zoneLabel: text("zoneLabel") ?? "Zone --", zoneStatus: text("zoneStatus") ?? "unknown",
      status: text("status") ?? "Active", isPaused: payload["isPaused"] as? Bool ?? false)
    state.workoutInstanceId = text("workoutInstanceId")
    state.sessionId = text("sessionId")
    state.sessionSource = text("sessionSource")
    state.activityType = text("activityType")
    state.metricLabel = text("metricLabel")
    state.metricValue = text("metricValue")
    state.metricUnit = text("metricUnit")
    state.distanceValue = text("distanceValue")
    state.distanceUnit = text("distanceUnit")
    state.elevationDisplay = text("elevationDisplay")
    state.descentDisplay = text("descentDisplay")
    state.cadenceValue = number("cadenceValue").flatMap { $0 >= 0 && $0 <= 10_000 ? $0 : nil }
    state.cadenceUnit = text("cadenceUnit")
    state.cadenceObservedAt = number("cadenceObservedAt")
    state.powerWatts = number("powerWatts").flatMap { $0 >= 0 && $0 <= 100_000 ? $0 : nil }
    state.powerKind = text("powerKind")
    state.powerObservedAt = number("powerObservedAt")
    state.heartRateObservedAt = number("heartRateObservedAt")
    state.currentInterval = text("currentInterval")
    state.nextTransition = text("nextTransition")
    state.navigationInstruction = text("navigationInstruction")
    state.cueText = text("cueText")
    state.controlState = text("controlState")
    return state
  }

  @available(iOS 16.1, *)
  private static func makeState(
    elapsedSeconds: Int,
    distanceMiles: Double,
    averagePace: String,
    heartRate: Int,
    zoneLabel: String,
    zoneStatus: String,
    status: String,
    isPaused: Bool = false
  ) -> StrideRunActivityAttributes.ContentState {
    StrideRunActivityAttributes.ContentState(
      elapsedSeconds: max(0, elapsedSeconds),
      distanceMiles: max(0, distanceMiles),
      averagePace: averagePace,
      heartRate: max(0, heartRate),
      zoneLabel: zoneLabel,
      zoneStatus: zoneStatus,
      status: status.isEmpty ? StrideLiveActivityStatus.running : status,
      isPaused: isPaused,
      updatedAt: Date().timeIntervalSince1970
    )
  }

  @available(iOS 16.1, *)
  private static func currentActivity() -> Activity<StrideRunActivityAttributes>? {
    if let currentActivityId {
      return Activity<StrideRunActivityAttributes>.activities.first(where: { $0.id == currentActivityId })
    }
    return Activity<StrideRunActivityAttributes>.activities.first
  }

  @available(iOS 16.1, *)
  private static func endExistingActivityIfNeeded() async {
    for activity in Activity<StrideRunActivityAttributes>.activities {
      let state = StrideRunActivityAttributes.ContentState(
        elapsedSeconds: activity.contentState.elapsedSeconds,
        distanceMiles: activity.contentState.distanceMiles,
        averagePace: activity.contentState.averagePace,
        heartRate: activity.contentState.heartRate,
        zoneLabel: activity.contentState.zoneLabel,
        zoneStatus: activity.contentState.zoneStatus,
        status: StrideLiveActivityStatus.finished,
        isPaused: false
      )
      if #available(iOS 16.2, *) {
        await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
      } else {
        await activity.end(using: state, dismissalPolicy: .immediate)
      }
    }
    currentActivityId = nil
  }
}
