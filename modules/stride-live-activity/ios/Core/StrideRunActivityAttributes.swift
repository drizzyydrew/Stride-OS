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

    public init(
      elapsedSeconds: Int,
      distanceMiles: Double,
      averagePace: String,
      heartRate: Int,
      zoneLabel: String,
      zoneStatus: String,
      status: String
    ) {
      self.elapsedSeconds = elapsedSeconds
      self.distanceMiles = distanceMiles
      self.averagePace = averagePace
      self.heartRate = heartRate
      self.zoneLabel = zoneLabel
      self.zoneStatus = zoneStatus
      self.status = status
    }
  }

  public var runName: String

  public init(runName: String) {
    self.runName = runName
  }
}
