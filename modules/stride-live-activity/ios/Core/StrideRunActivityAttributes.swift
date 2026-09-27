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
    /// Unix seconds when this state was produced. Lets the widget run a native
    /// self-updating timer (start = updatedAt - elapsedSeconds) instead of
    /// freezing between app updates while the phone is locked. Optional so
    /// states encoded before this field existed still decode.
    public var updatedAt: Double?

    public init(
      elapsedSeconds: Int,
      distanceMiles: Double,
      averagePace: String,
      heartRate: Int,
      zoneLabel: String,
      zoneStatus: String,
      status: String,
      isPaused: Bool = false,
      updatedAt: Double? = nil
    ) {
      self.elapsedSeconds = elapsedSeconds
      self.distanceMiles = distanceMiles
      self.averagePace = averagePace
      self.heartRate = heartRate
      self.zoneLabel = zoneLabel
      self.zoneStatus = zoneStatus
      self.status = status
      self.isPaused = isPaused
      self.updatedAt = updatedAt
    }
  }

  public var runName: String

  public init(runName: String) {
    self.runName = runName
  }
}
