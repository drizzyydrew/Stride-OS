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

    public init(
      elapsedSeconds: Int,
      currentExercise: String,
      nextExercise: String,
      setsCompleted: Int,
      totalSets: Int,
      isPaused: Bool = false
    ) {
      self.elapsedSeconds = elapsedSeconds
      self.currentExercise = currentExercise
      self.nextExercise = nextExercise
      self.setsCompleted = setsCompleted
      self.totalSets = totalSets
      self.isPaused = isPaused
    }
  }

  public var workoutName: String

  public init(workoutName: String) {
    self.workoutName = workoutName
  }
}
