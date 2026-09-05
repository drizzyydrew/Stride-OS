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

      Group {
        if workout.isActive {
          ActiveWorkoutFace(metrics: metrics)
            .environmentObject(workout)
        } else {
          WorkoutPickerFace(metrics: metrics)
            .environmentObject(workout)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .padding(.horizontal, metrics.horizontalPadding)
      .padding(.top, metrics.topPadding)
      .padding(.bottom, metrics.bottomPadding)
      .background(Color.black)
    }
  }
}

private struct WorkoutPickerFace: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager
  let metrics: StrideWatchLayoutMetrics

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: metrics.verticalSpacing) {
        StrideWatchHeader(metrics: metrics)

        Text("Choose Workout")
          .font(.system(size: metrics.captionFontSize, weight: .bold))
          .foregroundStyle(StrideWatchPalette.cream.opacity(0.78))
          .textCase(.uppercase)

        VStack(spacing: 6) {
          ForEach(StrideWatchWorkoutKind.allCases) { kind in
            Button {
              workout.selectWorkoutKind(kind)
            } label: {
              HStack(spacing: 8) {
                Image(systemName: kind.symbolName)
                  .font(.system(size: 14, weight: .semibold))
                  .frame(width: 18)
                Text(kind.title)
                  .font(.system(size: metrics.rowFontSize, weight: .bold))
                Spacer(minLength: 4)
                if workout.selectedWorkoutKind == kind {
                  Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .heavy))
                }
              }
              .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(StrideWatchRowButtonStyle(selected: workout.selectedWorkoutKind == kind))
            .accessibilityLabel("\(kind.title) workout")
          }
        }

        Button {
          let kind = workout.selectedWorkoutKind
          workout.startWorkout(
            kind: kind,
            title: kind.workoutTitle,
            workoutInstanceId: nil,
            environment: kind == .run || kind == .cycling ? "outdoor" : "indoor",
            targetZone: nil
          )
        } label: {
          Label("Start \(workout.selectedWorkoutKind.title)", systemImage: "play.fill")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(StrideWatchCapsuleButtonStyle(tint: StrideWatchPalette.sage))
        .accessibilityLabel("Start \(workout.selectedWorkoutKind.title) workout")

        Text(workout.syncLabel)
          .font(.system(size: metrics.statusFontSize, weight: .semibold))
          .foregroundStyle(StrideWatchPalette.steel)
          .lineLimit(1)
          .minimumScaleFactor(0.82)
      }
    }
    .scrollIndicators(.hidden)
  }
}

private struct ActiveWorkoutFace: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager
  let metrics: StrideWatchLayoutMetrics

  var body: some View {
    VStack(alignment: .leading, spacing: metrics.verticalSpacing) {
      StrideWatchHeader(metrics: metrics)

      HStack(spacing: 6) {
        Image(systemName: workout.selectedWorkoutKind.symbolName)
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(StrideWatchPalette.sage)
        Text("\(workout.selectedWorkoutKind.title) · \(workout.statusLabel)")
          .font(.system(size: metrics.statusFontSize, weight: .semibold))
          .foregroundStyle(StrideWatchPalette.sage)
          .lineLimit(1)
          .minimumScaleFactor(0.72)
      }

      Button {
        workout.cycleMetricPage()
      } label: {
        VStack(alignment: .leading, spacing: 4) {
          Text(workout.metricPage.title)
            .font(.system(size: metrics.captionFontSize, weight: .bold))
            .foregroundStyle(StrideWatchPalette.steel)
            .textCase(.uppercase)
          HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(workout.metricValueLabel)
              .font(.system(size: metrics.metricFontSize, weight: .heavy, design: .rounded))
              .monospacedDigit()
              .foregroundStyle(.white)
              .lineLimit(1)
              .minimumScaleFactor(0.58)
            if !workout.metricUnitLabel.isEmpty {
              Text(workout.metricUnitLabel)
                .font(.system(size: metrics.unitFontSize, weight: .bold))
                .foregroundStyle(StrideWatchPalette.clay)
            }
          }
          Text("Tap to change")
            .font(.system(size: metrics.hintFontSize, weight: .semibold))
            .foregroundStyle(StrideWatchPalette.cream.opacity(0.58))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, metrics.metricPadding)
      }
      .buttonStyle(StrideWatchMetricButtonStyle())
      .accessibilityLabel("\(workout.metricPage.title), \(workout.metricValueLabel) \(workout.metricUnitLabel). Tap to change metric.")

      HStack(spacing: 8) {
        Text(workout.elapsedLabel)
          .font(.system(size: metrics.elapsedFontSize, weight: .bold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(StrideWatchPalette.cream)
          .lineLimit(1)
          .minimumScaleFactor(0.82)
        Spacer(minLength: 4)
        Text(workout.syncLabel)
          .font(.system(size: metrics.hintFontSize, weight: .semibold))
          .foregroundStyle(StrideWatchPalette.steel)
          .lineLimit(1)
          .minimumScaleFactor(0.72)
      }

      Spacer(minLength: 0)

      StrideWatchControls(metrics: metrics)
        .environmentObject(workout)
    }
  }
}

private struct StrideWatchHeader: View {
  let metrics: StrideWatchLayoutMetrics

  var body: some View {
    HStack(spacing: 0) {
      Text("Stride")
        .foregroundStyle(.white)
      Text("OS")
        .foregroundStyle(StrideWatchPalette.steel)
    }
    .font(.system(size: metrics.logoFontSize, weight: .bold, design: .serif))
    .lineLimit(1)
    .minimumScaleFactor(0.7)
    .frame(maxWidth: .infinity, alignment: .center)
    .accessibilityHidden(true)
  }
}

private struct StrideWatchControls: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager
  let metrics: StrideWatchLayoutMetrics

  var body: some View {
    HStack(spacing: 7) {
      Button {
        if workout.isRunning {
          workout.pauseWorkout()
        } else {
          workout.resumeWorkout()
        }
      } label: {
        Label(workout.isRunning ? "Pause" : "Resume", systemImage: workout.isRunning ? "pause.fill" : "play.fill")
          .labelStyle(.titleAndIcon)
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(StrideWatchCapsuleButtonStyle(tint: workout.isRunning ? StrideWatchPalette.clay : StrideWatchPalette.sage))
      .accessibilityLabel(workout.isRunning ? "Pause workout" : "Resume workout")

      Button(role: .destructive) {
        workout.endWorkout()
      } label: {
        Image(systemName: "stop.fill")
          .frame(width: metrics.endButtonSize, height: metrics.endButtonSize)
      }
      .buttonStyle(StrideWatchCapsuleButtonStyle(tint: StrideWatchPalette.end, compact: true))
      .accessibilityLabel("End workout")
    }
  }
}

private struct StrideWatchCapsuleButtonStyle: ButtonStyle {
  let tint: Color
  var compact = false

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.system(size: compact ? 13 : 14, weight: .bold))
      .foregroundStyle(.white)
      .padding(.horizontal, compact ? 0 : 10)
      .frame(minHeight: compact ? 32 : 36)
      .background(tint.opacity(configuration.isPressed ? 0.72 : 1), in: Capsule())
      .scaleEffect(configuration.isPressed ? 0.97 : 1)
  }
}

private struct StrideWatchRowButtonStyle: ButtonStyle {
  let selected: Bool

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundStyle(selected ? Color.black : StrideWatchPalette.cream)
      .padding(.horizontal, 10)
      .frame(minHeight: 32)
      .background(
        selected
          ? StrideWatchPalette.sage.opacity(configuration.isPressed ? 0.72 : 1)
          : StrideWatchPalette.graphite.opacity(configuration.isPressed ? 0.92 : 0.72),
        in: RoundedRectangle(cornerRadius: 10, style: .continuous)
      )
  }
}

private struct StrideWatchMetricButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .background(
        LinearGradient(
          colors: [
            StrideWatchPalette.steel.opacity(configuration.isPressed ? 0.28 : 0.18),
            StrideWatchPalette.graphite.opacity(0.86),
          ],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        ),
        in: RoundedRectangle(cornerRadius: 18, style: .continuous)
      )
      .overlay {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .stroke(StrideWatchPalette.steel.opacity(0.38), lineWidth: 1)
      }
      .scaleEffect(configuration.isPressed ? 0.98 : 1)
  }
}

private struct StrideWatchLayoutMetrics {
  let horizontalPadding: CGFloat
  let topPadding: CGFloat
  let bottomPadding: CGFloat
  let verticalSpacing: CGFloat
  let logoFontSize: CGFloat
  let statusFontSize: CGFloat
  let captionFontSize: CGFloat
  let rowFontSize: CGFloat
  let metricFontSize: CGFloat
  let unitFontSize: CGFloat
  let elapsedFontSize: CGFloat
  let hintFontSize: CGFloat
  let metricPadding: CGFloat
  let endButtonSize: CGFloat

  init(size: CGSize) {
    let shortSide = min(size.width, size.height)
    let isCompact = shortSide < 180

    horizontalPadding = isCompact ? 10 : 12
    topPadding = isCompact ? 4 : 6
    bottomPadding = isCompact ? 16 : 18
    verticalSpacing = isCompact ? 5 : 6
    logoFontSize = isCompact ? 15 : 16
    statusFontSize = isCompact ? 10 : 10.5
    captionFontSize = isCompact ? 9 : 9.5
    rowFontSize = isCompact ? 12.5 : 13.5
    metricFontSize = isCompact ? 28 : 31
    unitFontSize = isCompact ? 10.5 : 11.5
    elapsedFontSize = isCompact ? 13 : 14
    hintFontSize = isCompact ? 8.5 : 9
    metricPadding = isCompact ? 8 : 10
    endButtonSize = isCompact ? 30 : 32
  }
}

private enum StrideWatchPalette {
  static let sage = Color(red: 0.545, green: 0.573, blue: 0.486)
  static let clay = Color(red: 0.863, green: 0.753, blue: 0.655)
  static let steel = Color(red: 0.439, green: 0.518, blue: 0.537)
  static let cream = Color(red: 0.957, green: 0.933, blue: 0.906)
  static let graphite = Color(red: 0.108, green: 0.101, blue: 0.088)
  static let end = Color(red: 0.702, green: 0.207, blue: 0.431)
}
