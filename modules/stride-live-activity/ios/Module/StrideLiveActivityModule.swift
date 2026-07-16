import ActivityKit
import ExpoModulesCore
import MapKit
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
  static let sessionIdKey = "StrideOS.pendingRunControlCommand.sessionId"
  static let sessionSourceKey = "StrideOS.pendingRunControlCommand.sessionSource"
  static let activityKitIdKey = "StrideOS.pendingRunControlCommand.activityKitId"

  static func read() -> [String: Any]? {
    guard
      let defaults = UserDefaults(suiteName: appGroupIdentifier),
      let id = defaults.string(forKey: idKey),
      let action = defaults.string(forKey: actionKey)
    else {
      return nil
    }

    var result: [String: Any] = [
      "id": id,
      "action": action,
      "createdAt": defaults.double(forKey: createdAtKey),
    ]
    result["sessionId"] = defaults.string(forKey: sessionIdKey) ?? ""
    result["sessionSource"] = defaults.string(forKey: sessionSourceKey) ?? ""
    result["activityKitId"] = defaults.string(forKey: activityKitIdKey) ?? ""
    return result
  }

  static func clear(id: String) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else { return }
    guard defaults.string(forKey: idKey) == id else { return }
    defaults.removeObject(forKey: idKey)
    defaults.removeObject(forKey: actionKey)
    defaults.removeObject(forKey: createdAtKey)
    defaults.removeObject(forKey: sessionIdKey)
    defaults.removeObject(forKey: sessionSourceKey)
    defaults.removeObject(forKey: activityKitIdKey)
    defaults.synchronize()
  }
}

private enum StrideLiveActivityIdStore {
  static let appGroupIdentifier = "group.com.mooremovement.strideos"
  static let runKey = "StrideOS.currentRunLiveActivityId"
  static let strengthKey = "StrideOS.currentStrengthLiveActivityId"

  static func read(_ key: String) -> String? {
    UserDefaults(suiteName: appGroupIdentifier)?.string(forKey: key)
  }

  static func write(_ id: String?, key: String) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else { return }
    if let id {
      defaults.set(id, forKey: key)
    } else {
      defaults.removeObject(forKey: key)
    }
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

    AsyncFunction("start") {
      (
        sessionId: String,
        sessionSource: String,
        runName: String,
        activityType: String,
        elapsedSeconds: Int,
        distanceMiles: Double,
        averagePace: String,
        heartRate: Int,
        zoneLabel: String,
        zoneStatus: String,
        status: String,
        isPaused: Bool,
        metricLabel: String,
        metricValue: String,
        metricUnit: String,
        currentInterval: String,
        nextTransition: String,
        navigationInstruction: String,
        cueText: String,
        controlState: String,
        elevationDisplay: String,
        descentDisplay: String,
        promise: Promise
      ) in
      guard #available(iOS 16.1, *) else {
        promise.resolve(nil)
        return
      }

      Task {
        do {
          await Self.endExistingActivityIfNeeded()
          await Self.endExistingStrengthActivityIfNeeded()
          let attributes = StrideRunActivityAttributes(
            runName: runName,
            sessionId: sessionId,
            sessionSource: sessionSource
          )
          let state = Self.makeState(
            elapsedSeconds: elapsedSeconds,
            distanceMiles: distanceMiles,
            averagePace: averagePace,
            heartRate: heartRate,
            zoneLabel: zoneLabel,
            zoneStatus: zoneStatus,
            status: status,
            isPaused: isPaused,
            activityType: activityType,
            metricLabel: metricLabel,
            metricValue: metricValue,
            metricUnit: metricUnit,
            currentInterval: currentInterval,
            nextTransition: nextTransition,
            navigationInstruction: navigationInstruction,
            cueText: cueText,
            controlState: controlState,
            elevationDisplay: elevationDisplay,
            descentDisplay: descentDisplay
          )

          let activity: Activity<StrideRunActivityAttributes>
          if #available(iOS 16.2, *) {
            let content = ActivityContent(
              state: state,
              staleDate: Date().addingTimeInterval(90),
              relevanceScore: 0.95
            )
            activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
          } else {
            activity = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
          }

          Self.currentActivityId = activity.id
          StrideLiveActivityIdStore.write(activity.id, key: StrideLiveActivityIdStore.runKey)
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
        metricLabel: String,
        metricValue: String,
        metricUnit: String,
        currentInterval: String,
        nextTransition: String,
        navigationInstruction: String,
        cueText: String,
        controlState: String,
        elevationDisplay: String,
        descentDisplay: String,
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

        let resolvedControlState = Self.controlStatePreservingPending(
          requested: controlState,
          current: activity.contentState.controlState,
          sessionId: activity.attributes.sessionId,
          sessionSource: activity.attributes.sessionSource
        )
        let state = Self.makeState(
          elapsedSeconds: elapsedSeconds,
          distanceMiles: distanceMiles,
          averagePace: averagePace,
          heartRate: heartRate,
          zoneLabel: zoneLabel,
          zoneStatus: zoneStatus,
          status: status,
          isPaused: isPaused,
          activityType: activity.contentState.activityType,
          metricLabel: metricLabel,
          metricValue: metricValue,
          metricUnit: metricUnit,
          currentInterval: currentInterval,
          nextTransition: nextTransition,
          navigationInstruction: navigationInstruction,
          cueText: cueText,
          controlState: resolvedControlState,
          elevationDisplay: elevationDisplay,
          descentDisplay: descentDisplay
        )

        if #available(iOS 16.2, *) {
          let content = ActivityContent(
            state: state,
            staleDate: Date().addingTimeInterval(90),
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
        metricLabel: String,
        metricValue: String,
        metricUnit: String,
        currentInterval: String,
        nextTransition: String,
        navigationInstruction: String,
        cueText: String,
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
          isPaused: false,
          activityType: activity.contentState.activityType,
          metricLabel: metricLabel,
          metricValue: metricValue,
          metricUnit: metricUnit,
          currentInterval: currentInterval,
          nextTransition: nextTransition,
          navigationInstruction: navigationInstruction,
          cueText: cueText,
          controlState: "ready"
        )

        // .immediate: finished runs must not linger on the Lock Screen.
        if #available(iOS 16.2, *) {
          let content = ActivityContent(state: state, staleDate: nil, relevanceScore: 0.1)
          await activity.end(content, dismissalPolicy: .immediate)
        } else {
          await activity.end(using: state, dismissalPolicy: .immediate)
        }
        Self.currentActivityId = nil
        StrideLiveActivityIdStore.write(nil, key: StrideLiveActivityIdStore.runKey)
        promise.resolve(nil)
      }
    }

    // ─── Strength Live Activity ───────────────────────────────────────────────

    AsyncFunction("startStrength") {
      (
        sessionId: String,
        sessionSource: String,
        workoutName: String,
        elapsedSeconds: Int,
        currentExercise: String,
        nextExercise: String,
        setsCompleted: Int,
        totalSets: Int,
        prescription: String,
        loadDisplay: String,
        progressLabel: String,
        controlState: String,
        promise: Promise
      ) in
      guard #available(iOS 16.1, *) else { promise.resolve(nil); return }
      Task {
        do {
          await Self.endExistingActivityIfNeeded()
          await Self.endExistingStrengthActivityIfNeeded()
          let attributes = StrideStrengthActivityAttributes(
            workoutName: workoutName,
            sessionId: sessionId,
            sessionSource: sessionSource
          )
          let state = StrideStrengthActivityAttributes.ContentState(
            elapsedSeconds: max(0, elapsedSeconds),
            currentExercise: currentExercise,
            nextExercise: nextExercise,
            setsCompleted: max(0, setsCompleted),
            totalSets: max(1, totalSets),
            isPaused: false,
            prescription: prescription,
            loadDisplay: loadDisplay,
            progressLabel: progressLabel,
            controlState: controlState
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
          StrideLiveActivityIdStore.write(activity.id, key: StrideLiveActivityIdStore.strengthKey)
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
        prescription: String,
        loadDisplay: String,
        progressLabel: String,
        controlState: String,
        promise: Promise
      ) in
      guard #available(iOS 16.1, *) else { promise.resolve(nil); return }
      Task {
        guard let activity = Self.currentStrengthActivity() else { promise.resolve(nil); return }
        let resolvedControlState = Self.controlStatePreservingPending(
          requested: controlState,
          current: activity.contentState.controlState,
          sessionId: activity.attributes.sessionId,
          sessionSource: activity.attributes.sessionSource
        )
        let state = StrideStrengthActivityAttributes.ContentState(
          elapsedSeconds: max(0, elapsedSeconds),
          currentExercise: currentExercise,
          nextExercise: nextExercise,
          setsCompleted: max(0, setsCompleted),
          totalSets: max(1, totalSets),
          isPaused: isPaused,
          prescription: prescription,
          loadDisplay: loadDisplay,
          progressLabel: progressLabel,
          controlState: resolvedControlState
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
        StrideLiveActivityIdStore.write(nil, key: StrideLiveActivityIdStore.strengthKey)
        promise.resolve(nil)
      }
    }

    AsyncFunction("getRouteDirections") {
      (
        coordinates: [[String: Double]],
        transport: String,
        promise: Promise
      ) in
      guard coordinates.count >= 2 else {
        promise.resolve(nil)
        return
      }

      Task {
        do {
          let result = try await Self.calculateDirections(
            coordinates: coordinates,
            transport: transport
          )
          promise.resolve(result)
        } catch {
          promise.reject("ERR_STRIDE_MAPKIT_DIRECTIONS", error.localizedDescription)
        }
      }
    }
  }

  @available(iOS 16.1, *)
  private static func currentStrengthActivity() -> Activity<StrideStrengthActivityAttributes>? {
    if let id = currentStrengthActivityId ?? StrideLiveActivityIdStore.read(StrideLiveActivityIdStore.strengthKey) {
      if let activity = Activity<StrideStrengthActivityAttributes>.activities.first(where: { $0.id == id }) {
        return activity
      }
      currentStrengthActivityId = nil
      StrideLiveActivityIdStore.write(nil, key: StrideLiveActivityIdStore.strengthKey)
    }
    guard Activity<StrideStrengthActivityAttributes>.activities.count == 1,
          let activity = Activity<StrideStrengthActivityAttributes>.activities.first else { return nil }
    currentStrengthActivityId = activity.id
    StrideLiveActivityIdStore.write(activity.id, key: StrideLiveActivityIdStore.strengthKey)
    return activity
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
    StrideLiveActivityIdStore.write(nil, key: StrideLiveActivityIdStore.strengthKey)
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
    isPaused: Bool = false,
    activityType: String = "running",
    metricLabel: String = "PACE",
    metricValue: String = "--:--",
    metricUnit: String = "/mi",
    currentInterval: String = "",
    nextTransition: String = "",
    navigationInstruction: String = "",
    cueText: String = "",
    controlState: String = "ready",
    elevationDisplay: String = "",
    descentDisplay: String = ""
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
      activityType: activityType,
      metricLabel: metricLabel,
      metricValue: metricValue,
      metricUnit: metricUnit,
      currentInterval: currentInterval,
      nextTransition: nextTransition,
      navigationInstruction: navigationInstruction,
      cueText: cueText,
      controlState: controlState,
      elevationDisplay: elevationDisplay,
      descentDisplay: descentDisplay
    )
  }

  @available(iOS 16.1, *)
  private static func currentActivity() -> Activity<StrideRunActivityAttributes>? {
    if let currentActivityId = currentActivityId ?? StrideLiveActivityIdStore.read(StrideLiveActivityIdStore.runKey) {
      if let activity = Activity<StrideRunActivityAttributes>.activities.first(where: { $0.id == currentActivityId }) {
        return activity
      }
      Self.currentActivityId = nil
      StrideLiveActivityIdStore.write(nil, key: StrideLiveActivityIdStore.runKey)
    }
    guard Activity<StrideRunActivityAttributes>.activities.count == 1,
          let activity = Activity<StrideRunActivityAttributes>.activities.first else { return nil }
    currentActivityId = activity.id
    StrideLiveActivityIdStore.write(activity.id, key: StrideLiveActivityIdStore.runKey)
    return activity
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
        isPaused: false,
        activityType: activity.contentState.activityType,
        metricLabel: activity.contentState.metricLabel,
        metricValue: activity.contentState.metricValue,
        metricUnit: activity.contentState.metricUnit,
        currentInterval: activity.contentState.currentInterval,
        nextTransition: activity.contentState.nextTransition,
        navigationInstruction: activity.contentState.navigationInstruction,
        cueText: activity.contentState.cueText,
        controlState: "ready"
      )
      if #available(iOS 16.2, *) {
        await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
      } else {
        await activity.end(using: state, dismissalPolicy: .immediate)
      }
    }
    currentActivityId = nil
    StrideLiveActivityIdStore.write(nil, key: StrideLiveActivityIdStore.runKey)
  }

  private static func calculateDirections(
    coordinates: [[String: Double]],
    transport: String
  ) async throws -> [String: Any] {
    let points = coordinates.compactMap { value -> CLLocationCoordinate2D? in
      guard let latitude = value["latitude"], let longitude = value["longitude"] else { return nil }
      return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
    guard points.count == coordinates.count else {
      throw NSError(domain: "StrideLiveActivity", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid route coordinates"])
    }

    var geometry: [[String: Double]] = []
    var steps: [[String: Any]] = []
    for index in 1..<points.count {
      let request = MKDirections.Request()
      request.source = MKMapItem(placemark: MKPlacemark(coordinate: points[index - 1]))
      request.destination = MKMapItem(placemark: MKPlacemark(coordinate: points[index]))
      request.requestsAlternateRoutes = false
      request.transportType = transport == "cycling" ? .cycling : .walking

      let response = try await MKDirections(request: request).calculate()
      guard let route = response.routes.first else { continue }
      let routeCoordinates = coordinatesFromPolyline(route.polyline)
      if geometry.isEmpty {
        geometry.append(contentsOf: routeCoordinates)
      } else {
        geometry.append(contentsOf: routeCoordinates.dropFirst())
      }

      for (stepIndex, step) in route.steps.enumerated() where !step.instructions.isEmpty {
        let stepCoordinates = coordinatesFromPolyline(step.polyline)
        let start = stepCoordinates.first ?? [
          "latitude": route.polyline.coordinate.latitude,
          "longitude": route.polyline.coordinate.longitude,
        ]
        let end = stepCoordinates.last ?? start
        steps.append([
          "id": "mapkit-\(index)-\(stepIndex)",
          "instruction": step.instructions,
          "distanceMeters": max(0, step.distance),
          "expectedTravelTimeSeconds": 0,
          "start": start,
          "end": end,
        ])
      }
    }

    return ["geometry": geometry, "steps": steps]
  }

  private static func coordinatesFromPolyline(_ polyline: MKPolyline) -> [[String: Double]] {
    let points = polyline.points()
    return (0..<polyline.pointCount).map { index in
      let coordinate = points[index].coordinate
      return ["latitude": coordinate.latitude, "longitude": coordinate.longitude]
    }
  }

  private static func controlStatePreservingPending(
    requested: String,
    current: String,
    sessionId: String,
    sessionSource: String
  ) -> String {
    guard requested == "ready", current != "ready",
          let command = StrideRunControlCommandStore.read(),
          let createdAt = command["createdAt"] as? Double,
          Date().timeIntervalSince1970 - createdAt <= 15 else {
      return requested
    }
    let commandSessionId = command["sessionId"] as? String ?? ""
    let commandSessionSource = command["sessionSource"] as? String ?? ""
    guard commandSessionId.isEmpty || sessionId.isEmpty || commandSessionId == sessionId else {
      return requested
    }
    guard commandSessionSource.isEmpty || sessionSource.isEmpty || commandSessionSource == sessionSource else {
      return requested
    }
    return current
  }
}
