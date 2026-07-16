import ActivityKit
import AppIntents
import Foundation
import StrideLiveActivityCore

private enum StrideRunControlCommand {
  static let appGroupIdentifier = "group.com.mooremovement.strideos"
  static let idKey = "StrideOS.pendingRunControlCommand.id"
  static let actionKey = "StrideOS.pendingRunControlCommand.action"
  static let createdAtKey = "StrideOS.pendingRunControlCommand.createdAt"
  static let sessionIdKey = "StrideOS.pendingRunControlCommand.sessionId"
  static let sessionSourceKey = "StrideOS.pendingRunControlCommand.sessionSource"
  static let activityKitIdKey = "StrideOS.pendingRunControlCommand.activityKitId"
  static let runActivityIdKey = "StrideOS.currentRunLiveActivityId"
  static let strengthActivityIdKey = "StrideOS.currentStrengthLiveActivityId"
  static let pendingTimeout: TimeInterval = 15

  @discardableResult
  static func write(
    _ action: String,
    sessionId: String,
    sessionSource: String,
    activityKitId: String
  ) -> Bool {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else { return false }
    let existingId = defaults.string(forKey: idKey)
    let existingCreatedAt = defaults.double(forKey: createdAtKey)
    if existingId != nil && Date().timeIntervalSince1970 - existingCreatedAt <= pendingTimeout {
      return false
    }
    defaults.set(UUID().uuidString, forKey: idKey)
    defaults.set(action, forKey: actionKey)
    defaults.set(Date().timeIntervalSince1970, forKey: createdAtKey)
    defaults.set(sessionId, forKey: sessionIdKey)
    defaults.set(sessionSource, forKey: sessionSourceKey)
    defaults.set(activityKitId, forKey: activityKitIdKey)
    defaults.synchronize()
    return true
  }
}

@available(iOS 18.0, *)
struct PauseRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pause Activity"
  static var description = IntentDescription("Pause the current outdoor activity")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    guard let activity = currentRunActivity() else { return .result() }
    guard StrideRunControlCommand.write(
      "pause",
      sessionId: activity.attributes.sessionId,
      sessionSource: activity.attributes.sessionSource,
      activityKitId: activity.id
    ) else { return .result() }
    await updateRun(isPaused: true, status: "Paused", controlState: "pause_pending")
    return .result()
  }
}

@available(iOS 18.0, *)
struct ResumeRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Resume Activity"
  static var description = IntentDescription("Resume the paused outdoor activity")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    guard let activity = currentRunActivity() else { return .result() }
    guard StrideRunControlCommand.write(
      "resume",
      sessionId: activity.attributes.sessionId,
      sessionSource: activity.attributes.sessionSource,
      activityKitId: activity.id
    ) else { return .result() }
    await updateRun(isPaused: false, status: "Running", controlState: "resume_pending")
    return .result()
  }
}

@available(iOS 18.0, *)
struct StopRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Complete Activity"
  static var description = IntentDescription("Complete and save the current outdoor activity")
  static var isDiscoverable: Bool = false
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    guard let activity = currentRunActivity() else { return .result() }
    guard StrideRunControlCommand.write(
      "stop",
      sessionId: activity.attributes.sessionId,
      sessionSource: activity.attributes.sessionSource,
      activityKitId: activity.id
    ) else { return .result() }
    await updateRun(isPaused: true, status: "Finishing", controlState: "complete_pending")
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
    guard let activity = currentStrengthActivity() else { return .result() }
    guard StrideRunControlCommand.write(
      "strength_pause",
      sessionId: activity.attributes.sessionId,
      sessionSource: activity.attributes.sessionSource,
      activityKitId: activity.id
    ) else { return .result() }
    await updateStrength(isPaused: true, controlState: "pause_pending")
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
    guard let activity = currentStrengthActivity() else { return .result() }
    guard StrideRunControlCommand.write(
      "strength_resume",
      sessionId: activity.attributes.sessionId,
      sessionSource: activity.attributes.sessionSource,
      activityKitId: activity.id
    ) else { return .result() }
    await updateStrength(isPaused: false, controlState: "resume_pending")
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
    guard let activity = currentStrengthActivity() else { return .result() }
    guard StrideRunControlCommand.write(
      "strength_complete",
      sessionId: activity.attributes.sessionId,
      sessionSource: activity.attributes.sessionSource,
      activityKitId: activity.id
    ) else { return .result() }
    await markStrengthPending()
    return .result()
  }
}

@available(iOS 18.0, *)
private func updateRun(isPaused: Bool, status: String, controlState: String) async {
  guard let activity = currentRunActivity() else { return }
  let current = activity.contentState
  let state = StrideRunActivityAttributes.ContentState(
    elapsedSeconds: current.elapsedSeconds,
    distanceMiles: current.distanceMiles,
    averagePace: current.averagePace,
    heartRate: current.heartRate,
    zoneLabel: current.zoneLabel,
    zoneStatus: current.zoneStatus,
    status: status,
    isPaused: isPaused,
    activityType: current.activityType,
    metricLabel: current.metricLabel,
    metricValue: current.metricValue,
    metricUnit: current.metricUnit,
    currentInterval: current.currentInterval,
    nextTransition: current.nextTransition,
    navigationInstruction: current.navigationInstruction,
    cueText: current.cueText,
    controlState: controlState,
    elevationDisplay: current.elevationDisplay,
    descentDisplay: current.descentDisplay
  )
  await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(90), relevanceScore: 0.95))
}

@available(iOS 18.0, *)
private func updateStrength(isPaused: Bool, controlState: String) async {
  guard let activity = currentStrengthActivity() else { return }
  let current = activity.contentState
  let state = StrideStrengthActivityAttributes.ContentState(
    elapsedSeconds: current.elapsedSeconds,
    currentExercise: current.currentExercise,
    nextExercise: current.nextExercise,
    setsCompleted: current.setsCompleted,
    totalSets: current.totalSets,
    isPaused: isPaused,
    prescription: current.prescription,
    loadDisplay: current.loadDisplay,
    progressLabel: current.progressLabel,
    controlState: controlState
  )
  await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(90), relevanceScore: 0.9))
}

@available(iOS 18.0, *)
private func markStrengthPending() async {
  guard let activity = currentStrengthActivity() else { return }
  let current = activity.contentState
  let state = StrideStrengthActivityAttributes.ContentState(
    elapsedSeconds: current.elapsedSeconds,
    currentExercise: current.currentExercise,
    nextExercise: current.nextExercise,
    setsCompleted: current.setsCompleted,
    totalSets: current.totalSets,
    isPaused: current.isPaused,
    prescription: current.prescription,
    loadDisplay: current.loadDisplay,
    progressLabel: current.progressLabel,
    controlState: "complete_pending"
  )
  await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(90), relevanceScore: 0.9))
}

@available(iOS 18.0, *)
private func currentRunActivity() -> Activity<StrideRunActivityAttributes>? {
  let defaults = UserDefaults(suiteName: StrideRunControlCommand.appGroupIdentifier)
  if let id = defaults?.string(forKey: StrideRunControlCommand.runActivityIdKey) {
    if let activity = Activity<StrideRunActivityAttributes>.activities.first(where: { $0.id == id }) {
      return activity
    }
    defaults?.removeObject(forKey: StrideRunControlCommand.runActivityIdKey)
  }
  guard Activity<StrideRunActivityAttributes>.activities.count == 1,
        let activity = Activity<StrideRunActivityAttributes>.activities.first else { return nil }
  defaults?.set(activity.id, forKey: StrideRunControlCommand.runActivityIdKey)
  defaults?.synchronize()
  return activity
}

@available(iOS 18.0, *)
private func currentStrengthActivity() -> Activity<StrideStrengthActivityAttributes>? {
  let defaults = UserDefaults(suiteName: StrideRunControlCommand.appGroupIdentifier)
  if let id = defaults?.string(forKey: StrideRunControlCommand.strengthActivityIdKey) {
    if let activity = Activity<StrideStrengthActivityAttributes>.activities.first(where: { $0.id == id }) {
      return activity
    }
    defaults?.removeObject(forKey: StrideRunControlCommand.strengthActivityIdKey)
  }
  guard Activity<StrideStrengthActivityAttributes>.activities.count == 1,
        let activity = Activity<StrideStrengthActivityAttributes>.activities.first else { return nil }
  defaults?.set(activity.id, forKey: StrideRunControlCommand.strengthActivityIdKey)
  defaults?.synchronize()
  return activity
}
