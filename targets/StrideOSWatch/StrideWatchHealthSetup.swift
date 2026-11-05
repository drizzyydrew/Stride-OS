import Foundation

/// An explicit iPhone Health-setup request, never an inferred permission grant.
/// Only the request token and its age are retained; no health values are stored.
final class StrideWatchHealthSetup {
  private static let pendingKey = "StrideOS.pendingHealthSetup.v1"
  private static let completedKey = "StrideOS.completedHealthSetup.v1"
  private static let latestRequestKey = "StrideOS.latestHealthSetupRequestTime.v1"
  private static let lifetimeSeconds: TimeInterval = 7 * 24 * 60 * 60
  private let defaults: UserDefaults
  private(set) var inFlightId: String?

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
  }

  var hasPendingRequest: Bool { defaults.dictionary(forKey: Self.pendingKey) != nil }

  @discardableResult
  func enqueue(id: String, requestedAt: TimeInterval, now: TimeInterval) -> Bool {
    guard valid(id: id, requestedAt: requestedAt, now: now),
      !(defaults.stringArray(forKey: Self.completedKey) ?? []).contains(id),
      id != inFlightId else { return false }
    let latest = defaults.double(forKey: Self.latestRequestKey)
    // Background deliveries can arrive out of order. A delayed earlier setup
    // must not replace a more recent explicit choice, including after restart.
    if latest > 0 && latest <= now + 300 && now - latest <= Self.lifetimeSeconds
      && requestedAt < latest { return false }
    defaults.set(requestedAt, forKey: Self.latestRequestKey)
    defaults.set(["id": id, "requestedAt": requestedAt], forKey: Self.pendingKey)
    return true
  }

  /// `canPresent` must include foreground, idle, and no outstanding start/session.
  func beginIfIdle(canPresent: Bool, now: TimeInterval) -> String? {
    guard inFlightId == nil,
      let pending = defaults.dictionary(forKey: Self.pendingKey),
      let id = pending["id"] as? String,
      let requestedAt = pending["requestedAt"] as? Double else { return nil }
    guard valid(id: id, requestedAt: requestedAt, now: now) else {
      defaults.removeObject(forKey: Self.pendingKey)
      return nil
    }
    guard canPresent else { return nil }
    inFlightId = id
    return id
  }

  /// Completion means the sheet was processed (including denial), not granted.
  func complete(id: String) {
    guard inFlightId == id else { return }
    inFlightId = nil
    if defaults.dictionary(forKey: Self.pendingKey)?["id"] as? String == id {
      defaults.removeObject(forKey: Self.pendingKey)
    }
    var completed = defaults.stringArray(forKey: Self.completedKey) ?? []
    if !completed.contains(id) { completed.append(id) }
    defaults.set(Array(completed.suffix(40)), forKey: Self.completedKey)
  }

  private func valid(id: String, requestedAt: TimeInterval, now: TimeInterval) -> Bool {
    !id.isEmpty && id.utf8.count <= 128 && requestedAt.isFinite && now.isFinite
      && requestedAt > 0 && requestedAt <= now + 300
      && now - requestedAt <= Self.lifetimeSeconds
  }
}
