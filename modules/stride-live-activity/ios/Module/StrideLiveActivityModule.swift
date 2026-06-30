import ActivityKit
import ExpoModulesCore
import StrideLiveActivityCore

private enum StrideLiveActivityStatus {
  static let running = "Running"
  static let paused = "Paused"
  static let finished = "Finished"
}

public final class StrideLiveActivityModule: Module {
  private static var currentActivityId: String?

  public func definition() -> ModuleDefinition {
    Name("StrideLiveActivity")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
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
            status: status
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
          status: status
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
          status: status.isEmpty ? StrideLiveActivityStatus.finished : status
        )

        if #available(iOS 16.2, *) {
          let content = ActivityContent(
            state: state,
            staleDate: nil,
            relevanceScore: 0.1
          )
          await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(60 * 10)))
        } else {
          await activity.end(using: state, dismissalPolicy: .after(Date().addingTimeInterval(60 * 10)))
        }
        Self.currentActivityId = nil
        promise.resolve(nil)
      }
    }
  }

  @available(iOS 16.1, *)
  private static func makeState(
    elapsedSeconds: Int,
    distanceMiles: Double,
    averagePace: String,
    heartRate: Int,
    zoneLabel: String,
    zoneStatus: String,
    status: String
  ) -> StrideRunActivityAttributes.ContentState {
    StrideRunActivityAttributes.ContentState(
      elapsedSeconds: max(0, elapsedSeconds),
      distanceMiles: max(0, distanceMiles),
      averagePace: averagePace,
      heartRate: max(0, heartRate),
      zoneLabel: zoneLabel,
      zoneStatus: zoneStatus,
      status: status.isEmpty ? StrideLiveActivityStatus.running : status
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
        status: StrideLiveActivityStatus.finished
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
