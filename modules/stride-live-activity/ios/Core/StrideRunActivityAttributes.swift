import ActivityKit
import Foundation

public struct StrideRunActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var elapsedSeconds: Int
    public var distanceMiles: Double
    public var averagePace: String
    public var heartRate: Int
    public var zoneLabel: String
    public var zoneStatus: String
    public var status: String
    public var isPaused: Bool
    public var activityType: String
    public var metricLabel: String
    public var metricValue: String
    public var metricUnit: String
    public var currentInterval: String
    public var nextTransition: String
    public var navigationInstruction: String
    public var cueText: String
    public var controlState: String

    public init(
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
      controlState: String = "ready"
    ) {
      self.elapsedSeconds = elapsedSeconds
      self.distanceMiles = distanceMiles
      self.averagePace = averagePace
      self.heartRate = heartRate
      self.zoneLabel = zoneLabel
      self.zoneStatus = zoneStatus
      self.status = status
      self.isPaused = isPaused
      self.activityType = activityType
      self.metricLabel = metricLabel
      self.metricValue = metricValue
      self.metricUnit = metricUnit
      self.currentInterval = currentInterval
      self.nextTransition = nextTransition
      self.navigationInstruction = navigationInstruction
      self.cueText = cueText
      self.controlState = controlState
    }
  }

  public var runName: String

  public init(runName: String) {
    self.runName = runName
  }
}
