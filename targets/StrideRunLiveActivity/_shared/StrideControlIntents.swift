import ActivityKit
import AppIntents
import Foundation
import StrideLiveActivityCore

private enum StrideRunControlCommand {
  static let appGroupIdentifier = "group.com.mooremovement.strideos"
  static let idKey = "StrideOS.pendingRunControlCommand.id"
  static let actionKey = "StrideOS.pendingRunControlCommand.action"
  static let createdAtKey = "StrideOS.pendingRunControlCommand.createdAt"
  static let workoutIdKey = "StrideOS.pendingRunControlCommand.workoutInstanceId"
  static let sessionIdKey = "StrideOS.pendingRunControlCommand.sessionId"
  static let sourceKey = "StrideOS.pendingRunControlCommand.sessionSource"

  static func write(_ action: String) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else { return }
    defaults.set(UUID().uuidString, forKey: idKey)
    defaults.set(action, forKey: actionKey)
    defaults.set(Date().timeIntervalSince1970, forKey: createdAtKey)
    // Strength keeps its existing command contract; outdoor commands carry
    // the exact ActivityKit session rather than matching a later workout.
    let state = action.hasPrefix("strength_") ? nil : Activity<StrideRunActivityAttributes>.activities.first?.contentState
    defaults.set(state?.workoutInstanceId, forKey: workoutIdKey)
    defaults.set(state?.sessionId, forKey: sessionIdKey)
    defaults.set(state?.sessionSource, forKey: sourceKey)
    defaults.synchronize()
  }
}

@available(iOS 18.0, *)
struct PauseRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pause Run"
  static var description = IntentDescription("Pause the current run")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    StrideRunControlCommand.write("pause")
    await updateRun(isPaused: true, status: "Paused")
    return .result()
  }
}

@available(iOS 18.0, *)
struct ResumeRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Resume Run"
  static var description = IntentDescription("Resume a paused run")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    StrideRunControlCommand.write("resume")
    await updateRun(isPaused: false, status: "Running")
    return .result()
  }
}

@available(iOS 18.0, *)
struct StopRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Run"
  static var description = IntentDescription("Stop and save the current run")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    StrideRunControlCommand.write("stop")
    await endRun()
    return .result()
  }
}

@available(iOS 18.0, *)
struct PauseStrengthIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pause Workout"
  static var description = IntentDescription("Pause the current strength session")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    StrideRunControlCommand.write("strength_pause")
    await updateStrength(isPaused: true)
    return .result()
  }
}

@available(iOS 18.0, *)
struct ResumeStrengthIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Resume Workout"
  static var description = IntentDescription("Resume the strength session")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    StrideRunControlCommand.write("strength_resume")
    await updateStrength(isPaused: false)
    return .result()
  }
}

@available(iOS 18.0, *)
struct MarkSetCompleteIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Mark Complete"
  static var description = IntentDescription("Complete the current exercise")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    StrideRunControlCommand.write("strength_complete")
    await advanceStrengthSet()
    return .result()
  }
}

@available(iOS 18.0, *)
private func updateRun(isPaused: Bool, status: String) async {
  guard let activity = Activity<StrideRunActivityAttributes>.activities.first else { return }
  var state = activity.contentState
  if !state.isPaused, let updated = state.updatedAt {
    state.elapsedSeconds += max(0, Int(Date().timeIntervalSince1970 - updated))
  }
  state.status = status
  state.isPaused = isPaused
  if state.heartRateObservedAt == nil, state.activityType == nil {
    state.heartRateObservedAt = state.updatedAt.map { $0 * 1000 }
  }
  state.updatedAt = Date().timeIntervalSince1970
  await activity.update(ActivityContent(state: state, staleDate: state.telemetryStaleDate(), relevanceScore: 0.95))
}

@available(iOS 18.0, *)
private func endRun() async {
  guard let activity = Activity<StrideRunActivityAttributes>.activities.first else { return }
  var state = activity.contentState
  state.status = "Finished"
  state.isPaused = false
  // .immediate: a stopped run must leave the Lock Screen right away — a
  // deferred dismissal leaves finished workouts pinned there for minutes.
  await activity.end(ActivityContent(state: state, staleDate: nil, relevanceScore: 0.1), dismissalPolicy: .immediate)
}

@available(iOS 18.0, *)
private func updateStrength(isPaused: Bool) async {
  guard let activity = Activity<StrideStrengthActivityAttributes>.activities.first else { return }
  let current = activity.contentState
  let state = StrideStrengthActivityAttributes.ContentState(
    elapsedSeconds: current.elapsedSeconds,
    currentExercise: current.currentExercise,
    nextExercise: current.nextExercise,
    setsCompleted: current.setsCompleted,
    totalSets: current.totalSets,
    isPaused: isPaused
  )
  await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(90), relevanceScore: 0.9))
}

@available(iOS 18.0, *)
private func advanceStrengthSet() async {
  guard let activity = Activity<StrideStrengthActivityAttributes>.activities.first else { return }
  let current = activity.contentState
  let nextCompleted = min(current.totalSets, current.setsCompleted + 1)
  let state = StrideStrengthActivityAttributes.ContentState(
    elapsedSeconds: current.elapsedSeconds,
    currentExercise: current.currentExercise,
    nextExercise: current.nextExercise,
    setsCompleted: nextCompleted,
    totalSets: current.totalSets,
    isPaused: current.isPaused
  )
  await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(90), relevanceScore: 0.9))
  if nextCompleted >= current.totalSets {
    await activity.end(ActivityContent(state: state, staleDate: nil, relevanceScore: 0.1), dismissalPolicy: .immediate)
  }
}
