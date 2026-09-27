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

// Layout follows the watchOS system geometry instead of fixed paddings:
// - The brand mark lives in the top bar beside the clock (watchOS 10+), so no
//   content has to share or scroll under the time.
// - Horizontal margins come from scenePadding(), which the system sizes per
//   watch model, so both sides are equal on every case size.
// - Top/bottom insets come from the safe area (rounded corners, clock), not
//   hand-tuned vertical padding.
struct StrideWatchContentView: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager

  var body: some View {
    NavigationStack {
      Group {
        if workout.isActive {
          ActiveWorkoutFace()
        } else {
          WorkoutPickerFace()
        }
      }
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          StrideWatchHeader()
        }
      }
      .containerBackground(Color.black, for: .navigation)
    }
    .environmentObject(workout)
    .task {
      workout.prepareForPhoneControl()
    }
  }
}

private struct WorkoutPickerFace: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        if let trail = workout.startTrailLabel {
          StrideWatchStartTrailCard(text: trail, crashed: workout.startTrailCrashed)
        }

        HStack(spacing: 8) {
          Image(systemName: "iphone")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(StrideWatchPalette.sage)
          Text("Start from iPhone")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(StrideWatchPalette.cream)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
          Spacer(minLength: 4)
        }
        .padding(.horizontal, 10)
        .frame(minHeight: 36)
        .background(StrideWatchPalette.graphite.opacity(0.72), in: Capsule())
        .accessibilityLabel("Start workouts from iPhone")

        Text(workout.syncLabel)
          .font(.system(size: 10.5, weight: .semibold))
          .foregroundStyle(StrideWatchPalette.steel)
          .lineLimit(1)
          .minimumScaleFactor(0.82)

        Text("Workout type")
          .font(.system(size: 10, weight: .bold))
          .foregroundStyle(StrideWatchPalette.cream.opacity(0.78))
          .textCase(.uppercase)
          .padding(.top, 2)

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
                  .font(.system(size: 13.5, weight: .bold))
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

        StrideWatchDiagnostics()
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .scenePadding(.horizontal)
    .scrollIndicators(.hidden)
  }
}

/// Fixed, non-scrolling workout screen: status row, flexible metric card, and
/// controls pinned inside the bottom safe area. Nothing is ever pushed below
/// the fold, on any case size.
private struct ActiveWorkoutFace: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 5) {
        Image(systemName: workout.selectedWorkoutKind.symbolName)
          .font(.system(size: 11, weight: .bold))
        Text(workout.statusLabel)
          .font(.system(size: 11, weight: .semibold))
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        Spacer(minLength: 4)
        Text(workout.elapsedLabel)
          .font(.system(size: 14, weight: .bold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(StrideWatchPalette.cream)
          .lineLimit(1)
          .layoutPriority(1)
      }
      .foregroundStyle(StrideWatchPalette.sage)

      Button {
        workout.cycleMetricPage()
      } label: {
        VStack(alignment: .leading, spacing: 2) {
          Text(workout.metricPage.title)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(StrideWatchPalette.steel)
            .textCase(.uppercase)
          Spacer(minLength: 0)
          HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(workout.metricValueLabel)
              .font(.system(size: 40, weight: .heavy, design: .rounded))
              .monospacedDigit()
              .foregroundStyle(.white)
              .lineLimit(1)
              .minimumScaleFactor(0.5)
            if !workout.metricUnitLabel.isEmpty {
              Text(workout.metricUnitLabel)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(StrideWatchPalette.clay)
            }
          }
          Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
      }
      .buttonStyle(StrideWatchMetricButtonStyle())
      .frame(maxHeight: .infinity)
      .accessibilityLabel("\(workout.metricPage.title), \(workout.metricValueLabel) \(workout.metricUnitLabel). Tap to change metric.")

      StrideWatchControls()
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .scenePadding(.horizontal)
    // Use the system bottom margin instead of the (larger) container inset so
    // the controls sit the same standard distance from the edge on every size.
    .scenePadding(.bottom)
    .ignoresSafeArea(.container, edges: .bottom)
  }
}

/// Shown on the idle screen after a start: where the last start ended up.
/// When it did not reach a clean outcome, it names the step the app died in.
private struct StrideWatchStartTrailCard: View {
  let text: String
  let crashed: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 6) {
      Image(systemName: crashed ? "exclamationmark.triangle.fill" : "checkmark.circle")
        .font(.system(size: 11, weight: .bold))
      Text(text)
        .font(.system(size: 10, weight: .semibold, design: .monospaced))
        .fixedSize(horizontal: false, vertical: true)
    }
    .foregroundStyle(crashed ? StrideWatchPalette.clay : StrideWatchPalette.cream.opacity(0.7))
    .padding(8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(StrideWatchPalette.graphite.opacity(crashed ? 0.95 : 0.6), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    .accessibilityElement(children: .combine)
  }
}

private struct StrideWatchHeader: View {
  var body: some View {
    HStack(spacing: 0) {
      Text("Stride")
        .foregroundStyle(.white)
      Text("OS")
        .foregroundStyle(StrideWatchPalette.steel)
    }
    .font(.system(size: 15, weight: .bold, design: .serif))
    .lineLimit(1)
    .fixedSize()
    .accessibilityLabel("StrideOS")
  }
}

/// Runtime diagnostics for phone-to-watch sync. Small on purpose; it sits at
/// the bottom of the scrollable faces so it never crowds the workout metrics.
private struct StrideWatchDiagnostics: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(workout.connectivityLabel)
      Text(commandLine)
      Text(workout.healthKitLabel)
      Text(workout.workoutIdLabel)
      if let error = workout.lastError {
        Text("Err: \(error)")
          .foregroundStyle(StrideWatchPalette.clay)
      }
    }
    .font(.system(size: 9, weight: .medium, design: .monospaced))
    .foregroundStyle(StrideWatchPalette.cream.opacity(0.62))
    .lineLimit(2)
    .minimumScaleFactor(0.8)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.top, 4)
    .padding(.bottom, 6)
    .accessibilityElement(children: .combine)
    .accessibilityLabel("Sync diagnostics")
  }

  private var commandLine: String {
    if let age = workout.lastCommandAgeLabel {
      return "\(workout.lastCommandLabel) · \(age)"
    }
    return workout.lastCommandLabel
  }
}

private struct StrideWatchControls: View {
  @EnvironmentObject private var workout: StrideWatchWorkoutManager

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
          .frame(width: 34, height: 34)
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

private enum StrideWatchPalette {
  static let sage = Color(red: 0.545, green: 0.573, blue: 0.486)
  static let clay = Color(red: 0.863, green: 0.753, blue: 0.655)
  static let steel = Color(red: 0.439, green: 0.518, blue: 0.537)
  static let cream = Color(red: 0.957, green: 0.933, blue: 0.906)
  static let graphite = Color(red: 0.108, green: 0.101, blue: 0.088)
  static let end = Color(red: 0.702, green: 0.207, blue: 0.431)
}
