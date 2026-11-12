import Foundation

struct StrideWatchStartIdentity: Codable, Equatable {
  let workoutInstanceId: String
  let startNonce: String
  let ownerEpoch: String
  var isValid: Bool {
    !workoutInstanceId.isEmpty && workoutInstanceId.count <= 256 && !startNonce.isEmpty
      && startNonce.count <= 128 && !ownerEpoch.isEmpty && ownerEpoch.count <= 128
  }

  init?(_ message: [String: Any]) {
    guard let id = message["workoutInstanceId"] as? String, !id.isEmpty, id.count <= 256,
      let nonce = message["startNonce"] as? String, !nonce.isEmpty, nonce.count <= 128,
      let epoch = message["ownerEpoch"] as? String, !epoch.isEmpty, epoch.count <= 128 else { return nil }
    workoutInstanceId = id
    startNonce = nonce
    ownerEpoch = epoch
  }
}

/// No health values or account identifiers are stored here. Revocations must
/// survive a Watch relaunch and cannot be evicted while a command may be live.
final class StrideWatchStartFence {
  private struct Revocation: Codable { let identity: StrideWatchStartIdentity; let expiresAt: Double }
  private struct RecordingEnd: Codable { let id: String; let expiresAt: Double }
  private struct Snapshot: Codable { let revocations: [Revocation]; let recordingEnds: [RecordingEnd]?; let lastClock: Double; let blockedUntil: Double? }
  private var revocations: [Revocation] = []
  private var recordingEnds: [RecordingEnd] = []
  private var lastClock: Double = 0
  private var blockedUntil: Double?
  private let write: (Data) throws -> Void
  private(set) var failure: String?
  private let retentionMs: Double = 4 * 60 * 60 * 1000 + 5_000
  private let capacity = 128

  convenience init() {
    let file = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support/StrideWatchStartFence.json")
    self.init(read: {
      FileManager.default.fileExists(atPath: file.path) ? try Data(contentsOf: file) : nil
    }, write: { data in
      try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
      try data.write(to: file, options: .atomic)
    })
  }

  init(read: () throws -> Data?, write: @escaping (Data) throws -> Void) {
    self.write = write
    do {
      if let data = try read() {
        let saved = try JSONDecoder().decode(Snapshot.self, from: data)
        let ends = saved.recordingEnds ?? []
        guard saved.lastClock.isFinite, saved.lastClock >= 0, saved.revocations.count + ends.count <= capacity,
          (saved.blockedUntil == nil || saved.blockedUntil!.isFinite),
          saved.revocations.allSatisfy({ $0.identity.isValid && $0.expiresAt.isFinite && $0.expiresAt >= 0 }),
          ends.allSatisfy({ !$0.id.isEmpty && $0.id.count <= 256 && $0.expiresAt.isFinite && $0.expiresAt >= 0 }) else {
          throw NSError(domain: "StrideWatchStartFence", code: 1)
        }
        revocations = saved.revocations
        recordingEnds = ends
        lastClock = saved.lastClock
        blockedUntil = saved.blockedUntil
      }
    } catch { failure = "Watch start safety data could not be read. Phone recording can continue." }
  }

  private func advance(_ now: Double) -> Bool {
    guard failure == nil else { return false }
    guard now.isFinite, now >= 0, now + 5_000 >= lastClock else {
      failure = "Watch clock changed. Correct the clock and reopen StrideOS before retrying."
      return false
    }
    lastClock = max(lastClock, now)
    revocations.removeAll { $0.expiresAt < now }
    recordingEnds.removeAll { $0.expiresAt < now }
    if let blockedUntil, now <= blockedUntil { return false }
    blockedUntil = nil
    return true
  }

  private func persist() -> Bool {
    do {
      try write(JSONEncoder().encode(Snapshot(revocations: revocations, recordingEnds: recordingEnds, lastClock: lastClock, blockedUntil: blockedUntil)))
      return true
    } catch {
      failure = "Watch start safety data could not be saved. Phone recording can continue."
      return false
    }
  }

  func allows(_ identity: StrideWatchStartIdentity, sentAt: Double, now: Double) -> Bool {
    guard identity.isValid, advance(now), sentAt.isFinite, sentAt > 0, sentAt <= now + 5_000,
      now - sentAt <= 2 * 60 * 1000, persist() else { return false }
    if revocations.count + recordingEnds.count >= capacity {
      failure = "Watch start safety queue is full. Phone recording can continue."
      return false
    }
    return !revocations.contains { $0.identity == identity } && !recordingEnds.contains { $0.id == identity.workoutInstanceId }
  }

  @discardableResult
  func revoke(_ identity: StrideWatchStartIdentity, now: Double) -> Bool {
    guard identity.isValid, advance(now) else { return false }
    if !revocations.contains(where: { $0.identity == identity }) {
      guard revocations.count + recordingEnds.count < capacity else {
        blockedUntil = now + retentionMs
        _ = persist()
        failure = "Watch start safety queue is full. Reopen StrideOS after old commands expire."
        return false
      }
      revocations.append(Revocation(identity: identity, expiresAt: now + retentionMs))
    }
    return persist()
  }

  /// A local user ended this immutable recording, rather than one failed
  /// attempt. Unknown in-flight nonces for this ID must not resurrect it.
  func endRecording(_ id: String, now: Double) -> Bool {
    guard !id.isEmpty, id.count <= 256, advance(now) else { return false }
    if !recordingEnds.contains(where: { $0.id == id }) {
      guard revocations.count + recordingEnds.count < capacity else {
        blockedUntil = now + retentionMs
        _ = persist()
        failure = "Watch start safety queue is full. Reopen StrideOS after old commands expire."
        return false
      }
      recordingEnds.append(RecordingEnd(id: id, expiresAt: now + retentionMs))
    }
    return persist()
  }
}
