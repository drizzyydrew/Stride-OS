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
    // Optional so previously encoded activities still decode after an update.
    public var workoutInstanceId: String?
    public var sessionId: String?
    public var sessionSource: String?
    public var activityType: String?
    public var metricLabel: String?
    public var metricValue: String?
    public var metricUnit: String?
    public var distanceValue: String?
    public var distanceUnit: String?
    public var elevationDisplay: String?
    public var descentDisplay: String?
    public var cadenceValue: Double?
    public var cadenceUnit: String?
    public var cadenceObservedAt: Double?
    public var powerWatts: Double?
    public var powerKind: String?
    public var powerObservedAt: Double?
    public var heartRateObservedAt: Double?
    public var currentInterval: String?
    public var nextTransition: String?
    public var navigationInstruction: String?
    public var cueText: String?
    public var controlState: String?

    /// ActivityKit must invalidate sensor UI even if the JS process is suspended.
    public func telemetryStaleDate(now: Date = Date()) -> Date {
      var deadlines: [Date] = []
      func include(_ milliseconds: Double?) {
        guard let milliseconds, milliseconds.isFinite, milliseconds <= now.timeIntervalSince1970 * 1000 else {
          deadlines.append(now)
          return
        }
        deadlines.append(Date(timeIntervalSince1970: milliseconds / 1000 + 10))
      }
      if heartRate > 0 { include(heartRateObservedAt ?? (activityType == nil ? updatedAt.map { $0 * 1000 } : nil)) }
      if cadenceValue != nil { include(cadenceObservedAt) }
      if powerWatts != nil { include(powerObservedAt) }
      return deadlines.min() ?? now.addingTimeInterval(90)
    }

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
