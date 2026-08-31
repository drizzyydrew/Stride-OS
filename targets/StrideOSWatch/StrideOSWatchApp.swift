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
    GeometryReader { proxy in
      let metrics = StrideWatchLayoutMetrics(size: proxy.size)

      VStack(alignment: .leading, spacing: metrics.verticalSpacing) {
        HStack(spacing: 0) {
          Text("Stride")
            .foregroundStyle(.white)
          Text("OS")
            .foregroundStyle(StrideWatchPalette.steel)
        }
        .font(.system(size: metrics.logoFontSize, weight: .bold, design: .serif))
        .lineLimit(1)
        .minimumScaleFactor(0.72)

        Text(workout.statusLabel)
          .font(.system(size: metrics.statusFontSize, weight: .semibold))
          .foregroundStyle(StrideWatchPalette.sage)
          .lineLimit(1)
          .minimumScaleFactor(0.82)

        Spacer(minLength: metrics.minimumSpacer)

        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(workout.heartRateBpm.map(String.init) ?? "--")
            .font(.system(size: metrics.heartRateFontSize, weight: .heavy, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white)
            .lineLimit(1)
            .minimumScaleFactor(0.82)
          Text("bpm")
            .font(.system(size: metrics.unitFontSize, weight: .bold))
            .foregroundStyle(StrideWatchPalette.clay)
        }

        Text(workout.elapsedLabel)
          .font(.system(size: metrics.elapsedFontSize, weight: .bold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(StrideWatchPalette.cream)
          .lineLimit(1)
          .minimumScaleFactor(0.84)

        Spacer(minLength: metrics.minimumSpacer)

        StrideWatchControls(metrics: metrics)
          .environmentObject(workout)
      }
      .padding(.horizontal, metrics.horizontalPadding)
      .padding(.top, metrics.topPadding)
      .padding(.bottom, metrics.bottomPadding)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .background(Color.black)
    }
  }
}

private struct StrideWatchControls: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager
  let metrics: StrideWatchLayoutMetrics

  var body: some View {
    if workout.isRunning || workout.isPaused {
      HStack(spacing: 7) {
        Button {
          if workout.isRunning {
            workout.pauseWorkout()
          } else {
            workout.resumeWorkout()
          }
        } label: {
          Label(workout.isRunning ? "Pause" : "Resume", systemImage: workout.isRunning ? "pause.fill" : "play.fill")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(StrideWatchCapsuleButtonStyle(tint: workout.isRunning ? StrideWatchPalette.clay : StrideWatchPalette.sage))
        .accessibilityLabel(workout.isRunning ? "Pause run" : "Resume run")

        Button(role: .destructive) {
          workout.endWorkout()
        } label: {
          Image(systemName: "stop.fill")
            .frame(width: metrics.endButtonSize, height: metrics.endButtonSize)
        }
        .buttonStyle(StrideWatchCapsuleButtonStyle(tint: StrideWatchPalette.end, compact: true))
        .accessibilityLabel("End run")
      }
    } else {
      Button {
        workout.startWorkout(title: "StrideOS Run", workoutInstanceId: nil, environment: "outdoor", targetZone: nil)
      } label: {
        Label("Start", systemImage: "figure.run")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(StrideWatchCapsuleButtonStyle(tint: StrideWatchPalette.sage))
      .accessibilityLabel("Start run")
    }
  }
}

private struct StrideWatchCapsuleButtonStyle: ButtonStyle {
  let tint: Color
  var compact = false

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.system(size: compact ? 14 : 15, weight: .bold))
      .foregroundStyle(.white)
      .padding(.horizontal, compact ? 0 : 12)
      .frame(minHeight: compact ? 34 : 38)
      .background(tint.opacity(configuration.isPressed ? 0.72 : 1), in: Capsule())
      .scaleEffect(configuration.isPressed ? 0.97 : 1)
  }
}

private struct StrideWatchLayoutMetrics {
  let horizontalPadding: CGFloat
  let topPadding: CGFloat
  let bottomPadding: CGFloat
  let verticalSpacing: CGFloat
  let minimumSpacer: CGFloat
  let logoFontSize: CGFloat
  let statusFontSize: CGFloat
  let heartRateFontSize: CGFloat
  let unitFontSize: CGFloat
  let elapsedFontSize: CGFloat
  let endButtonSize: CGFloat

  init(size: CGSize) {
    let shortSide = min(size.width, size.height)
    let isCompact = shortSide < 180

    horizontalPadding = isCompact ? 12 : 14
    topPadding = isCompact ? 10 : 12
    bottomPadding = isCompact ? 10 : 12
    verticalSpacing = isCompact ? 7 : 8
    minimumSpacer = isCompact ? 2 : 4
    logoFontSize = isCompact ? 17 : 18
    statusFontSize = isCompact ? 10.5 : 11
    heartRateFontSize = isCompact ? 35 : 38
    unitFontSize = isCompact ? 11.5 : 12
    elapsedFontSize = isCompact ? 15 : 16
    endButtonSize = isCompact ? 34 : 38
  }
}

private enum StrideWatchPalette {
  static let sage = Color(red: 0.545, green: 0.573, blue: 0.486)
  static let clay = Color(red: 0.863, green: 0.753, blue: 0.655)
  static let steel = Color(red: 0.439, green: 0.518, blue: 0.537)
  static let cream = Color(red: 0.957, green: 0.933, blue: 0.906)
  static let end = Color(red: 0.702, green: 0.207, blue: 0.431)
}
