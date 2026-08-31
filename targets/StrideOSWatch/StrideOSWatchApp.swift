import SwiftUI

@main
struct StrideOSWatchApp: App {
  @StateObject private var workoutManager = StrideWatchWorkoutManager.shared

  var body: some Scene {
    WindowGroup {
      StrideWatchContentView()
        .environmentObject(workoutManager)
    }
  }
}

struct StrideWatchContentView: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      VStack(alignment: .leading, spacing: 2) {
        HStack(spacing: 0) {
          Text("Stride")
            .foregroundStyle(.white)
          Text("OS")
            .foregroundStyle(StrideWatchPalette.steel)
        }
        .font(.system(size: 23, weight: .bold, design: .serif))

        Text(workout.statusLabel)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(StrideWatchPalette.sage)
      }

      Spacer(minLength: 0)

      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Text(workout.heartRateBpm.map(String.init) ?? "--")
          .font(.system(size: 42, weight: .heavy, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(.white)
        Text("bpm")
          .font(.system(size: 13, weight: .bold))
          .foregroundStyle(StrideWatchPalette.clay)
      }

      Text(workout.elapsedLabel)
        .font(.system(size: 18, weight: .bold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(StrideWatchPalette.cream)

      Spacer(minLength: 0)

      if workout.isRunning {
        Button {
          workout.pauseWorkout()
        } label: {
          Label("Pause", systemImage: "pause.fill")
        }
        .buttonStyle(.borderedProminent)
        .tint(StrideWatchPalette.clay)
      } else if workout.isPaused {
        Button {
          workout.resumeWorkout()
        } label: {
          Label("Resume", systemImage: "play.fill")
        }
        .buttonStyle(.borderedProminent)
        .tint(StrideWatchPalette.sage)
      } else {
        Button {
          workout.startWorkout(title: "StrideOS Run", workoutInstanceId: nil, environment: "outdoor", targetZone: nil)
        } label: {
          Label("Start", systemImage: "figure.run")
        }
        .buttonStyle(.borderedProminent)
        .tint(StrideWatchPalette.sage)
      }

      if workout.isActive {
        Button(role: .destructive) {
          workout.endWorkout()
        } label: {
          Label("End", systemImage: "stop.fill")
        }
      }
    }
    .padding(.vertical, 4)
  }
}

private enum StrideWatchPalette {
  static let sage = Color(red: 0.545, green: 0.573, blue: 0.486)
  static let clay = Color(red: 0.863, green: 0.753, blue: 0.655)
  static let steel = Color(red: 0.439, green: 0.518, blue: 0.537)
  static let cream = Color(red: 0.957, green: 0.933, blue: 0.906)
}
