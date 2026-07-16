import ActivityKit
import Foundation

public struct StrideStrengthActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var elapsedSeconds: Int
    public var currentExercise: String
    public var nextExercise: String
    public var setsCompleted: Int
    public var totalSets: Int
    public var isPaused: Bool
    public var prescription: String
    public var loadDisplay: String
    public var progressLabel: String
    public var controlState: String

    public init(
      elapsedSeconds: Int,
      currentExercise: String,
      nextExercise: String,
      setsCompleted: Int,
      totalSets: Int,
      isPaused: Bool = false,
      prescription: String = "",
      loadDisplay: String = "",
      progressLabel: String = "",
      controlState: String = "ready"
    ) {
      self.elapsedSeconds = elapsedSeconds
      self.currentExercise = currentExercise
      self.nextExercise = nextExercise
      self.setsCompleted = setsCompleted
      self.totalSets = totalSets
      self.isPaused = isPaused
      self.prescription = prescription
      self.loadDisplay = loadDisplay
      self.progressLabel = progressLabel
      self.controlState = controlState
    }
  }

  public var workoutName: String

  public init(workoutName: String) {
    self.workoutName = workoutName
  }
}
