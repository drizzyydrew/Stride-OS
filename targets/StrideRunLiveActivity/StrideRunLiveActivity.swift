import ActivityKit
import AppIntents
import StrideLiveActivityCore
import SwiftUI
import WidgetKit

// ─── App Intents (Phase 2 interactive buttons) ────────────────────────────────

struct PauseRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pause Run"
  static var description = IntentDescription("Pause the current run")
  static var isDiscoverable: Bool = false

  func perform() async throws -> some IntentResult {
    NotificationCenter.default.post(name: Notification.Name("StrideOS.pauseRun"), object: nil)
    return .result()
  }
}

struct ResumeRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Resume Run"
  static var description = IntentDescription("Resume a paused run")
  static var isDiscoverable: Bool = false

  func perform() async throws -> some IntentResult {
    NotificationCenter.default.post(name: Notification.Name("StrideOS.resumeRun"), object: nil)
    return .result()
  }
}

struct StopRunIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Run"
  static var description = IntentDescription("Stop and save the current run")
  static var isDiscoverable: Bool = false

  func perform() async throws -> some IntentResult {
    NotificationCenter.default.post(name: Notification.Name("StrideOS.stopRun"), object: nil)
    return .result()
  }
}

// ─── Widget bundle ────────────────────────────────────────────────────────────

@main
struct StrideRunLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    StrideRunLiveActivity()
  }
}

struct StrideRunLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: StrideRunActivityAttributes.self) { context in
      LockScreenRunView(context: context)
        .activityBackgroundTint(Color(red: 0.08, green: 0.09, blue: 0.06))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          RunMetric(label: "DIST", value: String(format: "%.2f", context.state.distanceMiles), unit: "mi")
        }
        DynamicIslandExpandedRegion(.trailing) {
          RunMetric(label: "PACE", value: context.state.averagePace, unit: "/mi")
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 8) {
            Text(formatElapsed(context.state.elapsedSeconds))
              .font(.system(.title3, design: .rounded).weight(.bold))
              .monospacedDigit()
              .foregroundStyle(.white)
            Spacer()
            ZoneBadge(label: context.state.zoneLabel, status: context.state.zoneStatus)
            if context.state.isPaused {
              Button(intent: ResumeRunIntent()) {
                Image(systemName: "play.fill")
                  .font(.caption.weight(.bold))
                  .foregroundStyle(.white)
              }
              .buttonStyle(.plain)
              .padding(.horizontal, 8)
              .padding(.vertical, 4)
              .background(Color(red: 0.56, green: 0.72, blue: 0.41).opacity(0.3), in: Capsule())
            } else {
              Button(intent: PauseRunIntent()) {
                Image(systemName: "pause.fill")
                  .font(.caption.weight(.bold))
                  .foregroundStyle(.white)
              }
              .buttonStyle(.plain)
              .padding(.horizontal, 8)
              .padding(.vertical, 4)
              .background(Color(red: 0.91, green: 0.69, blue: 0.34).opacity(0.3), in: Capsule())
            }
          }
        }
      } compactLeading: {
        HStack(spacing: 4) {
          Image(systemName: context.state.isPaused ? "pause.circle.fill" : "figure.run")
            .font(.caption.weight(.bold))
            .foregroundStyle(context.state.isPaused ? Color(red: 0.91, green: 0.69, blue: 0.34) : zoneColor(context.state.zoneStatus))
          Text(String(format: "%.1f", context.state.distanceMiles))
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
        }
      } compactTrailing: {
        Text(context.state.zoneLabel)
          .font(.caption.weight(.bold))
          .foregroundStyle(zoneColor(context.state.zoneStatus))
      } minimal: {
        Image(systemName: context.state.isPaused ? "pause.circle.fill" : "figure.run")
          .foregroundStyle(zoneColor(context.state.zoneStatus))
      }
    }
  }
}

// ─── Lock screen view ─────────────────────────────────────────────────────────

private struct LockScreenRunView: View {
  let context: ActivityViewContext<StrideRunActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      // Header row
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text("StrideOS Run")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Color(red: 0.72, green: 0.75, blue: 0.64))
          Text(context.state.isPaused ? "Paused" : context.state.status)
            .font(.title3.weight(.bold))
            .foregroundStyle(context.state.isPaused ? Color(red: 0.91, green: 0.69, blue: 0.34) : .white)
        }
        Spacer()
        ZoneBadge(label: context.state.zoneLabel, status: context.state.zoneStatus)
      }

      // Elapsed time
      Text(formatElapsed(context.state.elapsedSeconds))
        .font(.system(size: 42, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color(red: 0.96, green: 0.95, blue: 0.90))

      // Stats row
      HStack(spacing: 10) {
        RunMetric(label: "DISTANCE", value: String(format: "%.2f", context.state.distanceMiles), unit: "mi")
        RunMetric(label: "AVG PACE", value: context.state.averagePace, unit: "/mi")
        RunMetric(label: "HEART RATE", value: context.state.heartRate > 0 ? "\(context.state.heartRate)" : "--", unit: "bpm")
      }

      // Phase 2: Control buttons
      HStack(spacing: 10) {
        if context.state.isPaused {
          // Paused state: Resume + Stop
          Button(intent: ResumeRunIntent()) {
            Label("Resume", systemImage: "play.fill")
              .font(.subheadline.weight(.bold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 10)
              .background(Color(red: 0.56, green: 0.72, blue: 0.41).opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
              .foregroundStyle(Color(red: 0.56, green: 0.72, blue: 0.41))
          }
          .buttonStyle(.plain)

          Button(intent: StopRunIntent()) {
            Label("Stop", systemImage: "stop.fill")
              .font(.subheadline.weight(.bold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 10)
              .background(Color(red: 0.84, green: 0.42, blue: 0.36).opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
              .foregroundStyle(Color(red: 0.84, green: 0.42, blue: 0.36))
          }
          .buttonStyle(.plain)
        } else {
          // Active state: Pause + Stop
          Button(intent: PauseRunIntent()) {
            Label("Pause", systemImage: "pause.fill")
              .font(.subheadline.weight(.bold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 10)
              .background(Color(red: 0.91, green: 0.69, blue: 0.34).opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
              .foregroundStyle(Color(red: 0.91, green: 0.69, blue: 0.34))
          }
          .buttonStyle(.plain)

          Button(intent: StopRunIntent()) {
            Label("Stop", systemImage: "stop.fill")
              .font(.subheadline.weight(.bold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 10)
              .background(Color(red: 0.84, green: 0.42, blue: 0.36).opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
              .foregroundStyle(Color(red: 0.84, green: 0.42, blue: 0.36))
          }
          .buttonStyle(.plain)
        }
      }
    }
    .padding(16)
  }
}

// ─── Shared sub-views ─────────────────────────────────────────────────────────

private struct RunMetric: View {
  let label: String
  let value: String
  let unit: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(label)
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(Color(red: 0.66, green: 0.69, blue: 0.58))
      HStack(alignment: .firstTextBaseline, spacing: 2) {
        Text(value)
          .font(.system(.headline, design: .rounded).weight(.heavy))
          .monospacedDigit()
          .foregroundStyle(.white)
        Text(unit)
          .font(.caption2.weight(.semibold))
          .foregroundStyle(Color(red: 0.82, green: 0.82, blue: 0.76))
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct ZoneBadge: View {
  let label: String
  let status: String

  var body: some View {
    Text(label.isEmpty ? "Zone --" : label)
      .font(.caption.weight(.heavy))
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(zoneColor(status).opacity(0.22), in: Capsule())
      .foregroundStyle(zoneColor(status))
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

private func zoneColor(_ status: String) -> Color {
  switch status {
  case "in":    return Color(red: 0.56, green: 0.72, blue: 0.41)
  case "near":  return Color(red: 0.91, green: 0.69, blue: 0.34)
  case "out":   return Color(red: 0.84, green: 0.42, blue: 0.36)
  default:      return Color(red: 0.72, green: 0.75, blue: 0.64)
  }
}

private func formatElapsed(_ seconds: Int) -> String {
  let s = max(0, seconds)
  let h = s / 3600
  let m = (s % 3600) / 60
  let sec = s % 60
  return h > 0
    ? String(format: "%d:%02d:%02d", h, m, sec)
    : String(format: "%02d:%02d", m, sec)
}
