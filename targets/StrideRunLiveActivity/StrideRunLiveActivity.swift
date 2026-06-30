import ActivityKit
import StrideLiveActivityCore
import SwiftUI
import WidgetKit

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
          HStack {
            Text(formatElapsed(context.state.elapsedSeconds))
              .font(.system(.title3, design: .rounded).weight(.bold))
            Spacer()
            ZoneBadge(label: context.state.zoneLabel, status: context.state.zoneStatus)
          }
        }
      } compactLeading: {
        Text(String(format: "%.1f", context.state.distanceMiles))
          .font(.caption.weight(.bold))
      } compactTrailing: {
        Text(context.state.zoneLabel)
          .font(.caption.weight(.bold))
          .foregroundStyle(zoneColor(context.state.zoneStatus))
      } minimal: {
        Image(systemName: "figure.run")
          .foregroundStyle(zoneColor(context.state.zoneStatus))
      }
    }
  }
}

private struct LockScreenRunView: View {
  let context: ActivityViewContext<StrideRunActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          Text("StrideOS Run")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Color(red: 0.72, green: 0.75, blue: 0.64))
          Text(context.state.status)
            .font(.title3.weight(.bold))
            .foregroundStyle(.white)
        }
        Spacer()
        ZoneBadge(label: context.state.zoneLabel, status: context.state.zoneStatus)
      }

      Text(formatElapsed(context.state.elapsedSeconds))
        .font(.system(size: 42, weight: .heavy, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color(red: 0.96, green: 0.95, blue: 0.90))

      HStack(spacing: 10) {
        RunMetric(label: "DISTANCE", value: String(format: "%.2f", context.state.distanceMiles), unit: "mi")
        RunMetric(label: "AVG PACE", value: context.state.averagePace, unit: "/mi")
        RunMetric(label: "HEART RATE", value: context.state.heartRate > 0 ? "\(context.state.heartRate)" : "--", unit: "bpm")
      }
    }
    .padding(16)
  }
}

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

private func zoneColor(_ status: String) -> Color {
  switch status {
  case "in":
    return Color(red: 0.56, green: 0.72, blue: 0.41)
  case "near":
    return Color(red: 0.91, green: 0.69, blue: 0.34)
  case "out":
    return Color(red: 0.84, green: 0.42, blue: 0.36)
  default:
    return Color(red: 0.72, green: 0.75, blue: 0.64)
  }
}

private func formatElapsed(_ seconds: Int) -> String {
  let safeSeconds = max(0, seconds)
  let hours = safeSeconds / 3600
  let minutes = (safeSeconds % 3600) / 60
  let secs = safeSeconds % 60
  if hours > 0 {
    return String(format: "%d:%02d:%02d", hours, minutes, secs)
  }
  return String(format: "%02d:%02d", minutes, secs)
}
