import ExpoModulesCore
import Vision
import UIKit

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

    Function("isAvailable") { () -> Bool in
      true
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

        let jointNames: [(VNHumanBodyPoseObservation.JointName, String)] = [
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

        var joints: [[String: Any]] = []
        for (visionName, name) in jointNames {
          guard let point = recognized[visionName], point.confidence > 0 else { continue }
          joints.append([
            "name": name,
            // Vision: origin bottom-left → flip y for UI top-left convention.
            "x": Double(point.location.x),
            "y": Double(1.0 - point.location.y),
            "confidence": Double(point.confidence),
          ])
        }

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
}
