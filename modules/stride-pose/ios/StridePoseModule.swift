import ExpoModulesCore
import Vision
import UIKit
import AVFoundation

// ─── StridePose ───────────────────────────────────────────────────────────────
//
// On-device markerless body pose estimation for the Movement Lab, wrapping
// Apple Vision's VNDetectHumanBodyPoseRequest on STILL images (a photo or an
// extracted video frame). Runs entirely on device — no network, no model
// download, no image ever leaves the phone.
//
// Returns landmarks in TOP-LEFT-origin normalized coordinates (x,y in 0…1,
// y flipped from Vision's bottom-left convention) so the JS overlay can map
// them straight onto an <Image> of the same aspect ratio.

public final class StridePoseModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StridePose")

    Events("onPoseSequenceProgress")

    Function("isAvailable") { () -> Bool in
      true
    }

    // ── Video sequence analysis ───────────────────────────────────────────────
    //
    // Samples a recorded video at ~targetFps, runs body-pose detection on each
    // sampled frame, and returns timestamped landmark sets. Frames where no
    // person is confidently detected are kept with an empty joints array so JS
    // can compute honest coverage/confidence stats. Fully on-device.
    AsyncFunction("detectPoseSequence") { (uri: String, options: [String: Any], promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async { [weak self] in
        guard let url = URL(string: uri) else {
          promise.reject("ERR_STRIDE_POSE_VIDEO", "Invalid video URI.")
          return
        }

        let asset = AVURLAsset(url: url)
        guard let track = asset.tracks(withMediaType: .video).first else {
          promise.reject("ERR_STRIDE_POSE_VIDEO", "No video track found.")
          return
        }

        let requestedFps  = (options["fps"] as? Double) ?? 12.0
        let targetFps     = min(15.0, max(4.0, requestedFps))
        let maxDurationMs = min(90_000.0, max(1_000.0, (options["maxDurationMs"] as? Double) ?? 60_000.0))
        let frameInterval = 1.0 / targetFps

        // Upright orientation + display dimensions from the track transform,
        // so Vision analyzes (and reports) coordinates in the upright frame.
        let transform   = track.preferredTransform
        let orientation = Self.videoOrientation(from: transform)
        let natural     = track.naturalSize
        let rotated     = orientation == .right || orientation == .left
        let displayW    = rotated ? natural.height : natural.width
        let displayH    = rotated ? natural.width  : natural.height

        guard let reader = try? AVAssetReader(asset: asset) else {
          promise.reject("ERR_STRIDE_POSE_VIDEO", "Could not open video for reading.")
          return
        }
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
          kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        ])
        output.alwaysCopiesSampleData = false
        reader.add(output)
        guard reader.startReading() else {
          promise.reject("ERR_STRIDE_POSE_VIDEO", "Could not start reading video.")
          return
        }

        let durationMs   = asset.duration.seconds * 1000.0
        let processEndMs = min(durationMs, maxDurationMs)
        let expectedFrames = max(1, Int(processEndMs / 1000.0 * targetFps))

        var frames: [[String: Any]] = []
        var nextSampleSec = 0.0
        var lastProgressSent = 0

        while reader.status == .reading {
          guard let sample = output.copyNextSampleBuffer() else { break }
          let ptsSec = CMSampleBufferGetPresentationTimeStamp(sample).seconds
          if ptsSec * 1000.0 > processEndMs { break }
          autoreleasepool {
            guard ptsSec >= nextSampleSec else { return }
            nextSampleSec = ptsSec + frameInterval

            guard let pixelBuffer = CMSampleBufferGetImageBuffer(sample) else { return }
            let request = VNDetectHumanBodyPoseRequest()
            let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation, options: [:])

            var joints: [[String: Any]] = []
            if (try? handler.perform([request])) != nil,
               let observation = request.results?.first,
               let recognized = try? observation.recognizedPoints(.all) {
              joints = Self.jointDicts(from: recognized)
            }
            // Fewer than 4 confident joints = treat as "no person this frame".
            if joints.count < 4 { joints = [] }

            frames.append([
              "timeMs": Int(ptsSec * 1000.0),
              "joints": joints,
            ])

            if frames.count - lastProgressSent >= 10 {
              lastProgressSent = frames.count
              self?.sendEvent("onPoseSequenceProgress", [
                "processed": frames.count,
                "total":     expectedFrames,
              ])
            }
          }
          if ptsExceedsEnd(sample: sample, endMs: processEndMs) { break }
        }

        if reader.status == .failed {
          promise.reject("ERR_STRIDE_POSE_VIDEO", reader.error?.localizedDescription ?? "Video decoding failed.")
          return
        }

        promise.resolve([
          "durationMs":  Int(durationMs),
          "analyzedMs":  Int(processEndMs),
          "imageWidth":  Int(displayW),
          "imageHeight": Int(displayH),
          "frames":      frames,
        ])
      }
    }

    AsyncFunction("detectPose") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard
          let url = URL(string: uri),
          let data = try? Data(contentsOf: url),
          let image = UIImage(data: data),
          let cgImage = image.cgImage
        else {
          promise.reject("ERR_STRIDE_POSE_LOAD", "Could not load image at the given URI.")
          return
        }

        let request = VNDetectHumanBodyPoseRequest()
        // CGImagePropertyOrientation from UIImage orientation so portrait
        // photos aren't analyzed sideways.
        let orientation = Self.cgOrientation(from: image.imageOrientation)
        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])

        do {
          try handler.perform([request])
        } catch {
          promise.reject("ERR_STRIDE_POSE_DETECT", error.localizedDescription)
          return
        }

        guard
          let observation = request.results?.first,
          let recognized = try? observation.recognizedPoints(.all)
        else {
          // No person detected — a valid, honest result, not an error.
          promise.resolve(nil)
          return
        }

        let joints = Self.jointDicts(from: recognized)

        guard joints.count >= 4 else {
          promise.resolve(nil)
          return
        }

        promise.resolve([
          "imageWidth": Int(image.size.width * image.scale),
          "imageHeight": Int(image.size.height * image.scale),
          "joints": joints,
        ])
      }
    }
  }

  private static func cgOrientation(from orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch orientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }

  // Vision joint names → the flat, stable joint-name strings the JS layer
  // consumes. Single source of truth for both the still-image (detectPose)
  // and video-sequence (detectPoseSequence) paths.
  private static let jointNameMap: [(VNHumanBodyPoseObservation.JointName, String)] = [
    (.nose, "nose"),
    (.neck, "neck"),
    (.leftShoulder, "left_shoulder"),
    (.rightShoulder, "right_shoulder"),
    (.leftElbow, "left_elbow"),
    (.rightElbow, "right_elbow"),
    (.leftWrist, "left_wrist"),
    (.rightWrist, "right_wrist"),
    (.leftHip, "left_hip"),
    (.rightHip, "right_hip"),
    (.root, "mid_hip"),
    (.leftKnee, "left_knee"),
    (.rightKnee, "right_knee"),
    (.leftAnkle, "left_ankle"),
    (.rightAnkle, "right_ankle"),
  ]

  /// Extracts the 15 tracked joints from a Vision recognized-points map into
  /// the plain dictionaries the JS bridge expects. Only points with
  /// confidence > 0 are included; Vision's bottom-left-origin y is flipped
  /// to top-left so JS overlays map directly onto an upright image/video.
  fileprivate static func jointDicts(
    from recognized: [VNHumanBodyPoseObservation.JointName: VNRecognizedPoint]
  ) -> [[String: Any]] {
    var joints: [[String: Any]] = []
    for (visionName, name) in jointNameMap {
      guard let point = recognized[visionName], point.confidence > 0 else { continue }
      joints.append([
        "name": name,
        // Vision: origin bottom-left → flip y for UI top-left convention.
        "x": Double(point.location.x),
        "y": Double(1.0 - point.location.y),
        "confidence": Double(point.confidence),
      ])
    }
    return joints
  }

  /// Maps a video track's `preferredTransform` to the `CGImagePropertyOrientation`
  /// Vision needs to analyze (and report landmarks in) the upright frame.
  /// identity → .up, +90° rotation → .right, -90° → .left, 180° → .down.
  fileprivate static func videoOrientation(from transform: CGAffineTransform) -> CGImagePropertyOrientation {
    let degrees = atan2(transform.b, transform.a) * 180.0 / .pi
    switch degrees {
    case -1...1:
      return .up
    case 89...91:
      return .right
    case -91...(-89):
      return .left
    case 179...180, -180...(-179):
      return .down
    default:
      return .up
    }
  }
}

/// True once a sample's presentation timestamp has passed the requested
/// analysis end point, so the reader loop knows to stop.
fileprivate func ptsExceedsEnd(sample: CMSampleBuffer, endMs: Double) -> Bool {
  let ptsSec = CMSampleBufferGetPresentationTimeStamp(sample).seconds
  return ptsSec * 1000.0 > endMs
}
