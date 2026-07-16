import ActivityKit
import AppIntents
import StrideLiveActivityCore
import SwiftUI
import WidgetKit

// ─── Widget bundle ────────────────────────────────────────────────────────────
//
// Apple Watch: audited for Build 28 — no watch target or watch-compatible
// infrastructure exists in this project. These Live Activities already mirror
// to a paired Apple Watch automatically via the system's built-in Live
// Activity support (no extra code required for that baseline). A dedicated
// WatchKit app (independent UI/controls on-wrist) is a separate, larger
// effort — new target, own signing/provisioning, own build — deferred rather
// than started here to avoid signing/build risk on an unreviewed addition.

@main
struct StrideRunLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    StrideRunLiveActivity()
    StrideStrengthLiveActivity()
  }
}

struct StrideRunLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: StrideRunActivityAttributes.self) { context in
      LockScreenRunView(context: context)
        .activityBackgroundTint(StrideDesign.ink)
        .activitySystemActionForegroundColor(StrideDesign.textPrimaryDark)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          IslandMetric(label: "TIME", value: formatElapsed(context.state.elapsedSeconds), unit: "")
        }
        DynamicIslandExpandedRegion(.trailing) {
          IslandMetric(label: "DISTANCE", value: String(format: "%.2f", context.state.distanceMiles), unit: "mi")
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 5) {
            if let guidance = priorityGuidance(context.state) {
              Label(guidance, systemImage: context.state.navigationInstruction.isEmpty ? "timer" : "arrow.turn.up.right")
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .foregroundStyle(StrideDesign.textSecondaryDark)
            }
            HStack(spacing: 10) {
              IslandMetric(label: context.state.metricLabel, value: context.state.metricValue, unit: context.state.metricUnit)
              Spacer()
              ZoneBadge(label: context.state.zoneLabel, status: context.state.zoneStatus)
              CompactRunControls(state: context.state)
            }
          }
        }
      } compactLeading: {
        HStack(spacing: 4) {
          Image(systemName: context.state.isPaused ? "pause.circle.fill" : activityIcon(context.state.activityType))
            .font(.caption.weight(.bold))
            .foregroundStyle(context.state.isPaused ? StrideDesign.clay : StrideDesign.sage)
          Text(formatElapsed(context.state.elapsedSeconds))
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
        }
      } compactTrailing: {
        Text(String(format: "%.1f mi", context.state.distanceMiles))
          .font(.caption.weight(.bold))
          .foregroundStyle(StrideDesign.clay)
      } minimal: {
        Image(systemName: context.state.isPaused ? "pause.circle.fill" : activityIcon(context.state.activityType))
          .foregroundStyle(context.state.isPaused ? StrideDesign.clay : StrideDesign.sage)
      }
    }
  }
}

// ─── Lock screen view ─────────────────────────────────────────────────────────

// The system chooses the available Lock Screen region. Keep the hierarchy
// compact and flexible: one header, one metric row, optional one-line guidance,
// and one action row. The system draws the rounded, tinted container itself, so
// there is deliberately no inner card here.
private struct LockScreenRunView: View {
  let context: ActivityViewContext<StrideRunActivityAttributes>
  @Environment(\.colorScheme) private var colorScheme

  private var isLight: Bool { colorScheme == .light }
  private var primaryText: Color { isLight ? StrideDesign.textPrimaryLight : StrideDesign.textPrimaryDark }
  private var secondaryText: Color { isLight ? StrideDesign.textSecondaryLight : StrideDesign.textSecondaryDark }
  private var actionColor: Color { isLight ? StrideDesign.clay : StrideDesign.sage }

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      // Header: brand + run status + zone
      HStack(spacing: 6) {
        Text("MM")
          .font(.system(size: 11, weight: .bold, design: .serif))
          .foregroundStyle(StrideDesign.clay)
        Text(context.state.isPaused ? "StrideOS · Paused" : "StrideOS · \(activityTitle(context.state.activityType))")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(context.state.isPaused ? StrideDesign.clay : primaryText)
        Spacer(minLength: 4)
        ZoneBadge(label: context.state.zoneLabel, status: context.state.zoneStatus)
      }

      // Single metrics row — four cells, equal width, no vertical stacking
      HStack(alignment: .top, spacing: 8) {
        LockMetricCell(value: formatElapsed(context.state.elapsedSeconds), unit: nil, label: "TIME", primary: primaryText, secondary: secondaryText)
        LockMetricCell(value: String(format: "%.2f", context.state.distanceMiles), unit: "mi", label: "DISTANCE", primary: primaryText, secondary: secondaryText)
        LockMetricCell(value: context.state.metricValue, unit: context.state.metricUnit, label: context.state.metricLabel, primary: primaryText, secondary: secondaryText)
        LockMetricCell(value: context.state.heartRate > 0 ? "\(context.state.heartRate)" : "--", unit: "bpm", label: "HEART RATE", primary: primaryText, secondary: secondaryText)
      }

      if let guidance = priorityGuidance(context.state) {
        Label(guidance, systemImage: context.state.navigationInstruction.isEmpty ? "timer" : "location.north.fill")
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(secondaryText)
          .lineLimit(1)
          .accessibilityLabel("Current guidance: \(guidance)")
      }

      // Single primary action + compact stop
      HStack(spacing: 8) {
        if context.state.controlState != "ready" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
            Text(pendingLabel(context.state.controlState))
              .font(.system(size: 13, weight: .heavy))
          }
          .frame(maxWidth: .infinity, minHeight: 38)
          .background(actionColor.opacity(0.18), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
          .foregroundStyle(primaryText)
          .accessibilityLabel(pendingLabel(context.state.controlState))
        } else if context.state.isPaused {
          Button(intent: ResumeRunIntent()) {
            Label("RESUME", systemImage: "play.fill")
              .font(.system(size: 14, weight: .heavy))
              .frame(maxWidth: .infinity, minHeight: 38)
              .background(actionColor, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
              .foregroundStyle(isLight ? .white : StrideDesign.ink)
          }
          .buttonStyle(.plain)
        } else {
          Button(intent: PauseRunIntent()) {
            Label("PAUSE", systemImage: "pause.fill")
              .font(.system(size: 14, weight: .heavy))
              .frame(maxWidth: .infinity, minHeight: 38)
              .background(actionColor, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
              .foregroundStyle(isLight ? .white : StrideDesign.ink)
          }
          .buttonStyle(.plain)
        }
        Button(intent: StopRunIntent()) {
          Image(systemName: "stop.fill")
            .font(.system(size: 14, weight: .heavy))
            .frame(width: 46, height: 38)
            .background(StrideDesign.critical.opacity(0.22), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .foregroundStyle(StrideDesign.critical)
        }
        .buttonStyle(.plain)
        .disabled(context.state.controlState != "ready")
        .opacity(context.state.controlState == "ready" ? 1 : 0.45)
      }
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
  }
}

private struct CompactRunControls: View {
  let state: StrideRunActivityAttributes.ContentState

  var body: some View {
    if state.controlState != "ready" {
      ProgressView()
        .controlSize(.mini)
        .tint(.white)
        .frame(width: 34, height: 28)
        .accessibilityLabel(pendingLabel(state.controlState))
    } else {
      if state.isPaused {
        Button(intent: ResumeRunIntent()) {
          Image(systemName: "play.fill")
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
        }
        .buttonStyle(.plain)
        .frame(width: 34, height: 28)
        .background(StrideDesign.sage.opacity(0.28), in: Capsule())
      } else {
        Button(intent: PauseRunIntent()) {
          Image(systemName: "pause.fill")
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
        }
        .buttonStyle(.plain)
        .frame(width: 34, height: 28)
        .background(StrideDesign.clay.opacity(0.28), in: Capsule())
      }
      Button(intent: StopRunIntent()) {
        Image(systemName: "stop.fill")
          .font(.caption.weight(.bold))
          .foregroundStyle(.white)
      }
      .buttonStyle(.plain)
      .frame(width: 34, height: 28)
      .background(StrideDesign.critical.opacity(0.28), in: Capsule())
    }
  }
}

// One metric in the lock-screen row: value on top (scales down before
// truncating — 1:23:45 must stay readable), tiny label beneath.
private struct LockMetricCell: View {
  let value: String
  let unit: String?
  let label: String
  let primary: Color
  let secondary: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(alignment: .firstTextBaseline, spacing: 2) {
        Text(value)
          .font(.system(size: 22, weight: .heavy, design: .rounded))
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.62)
          .foregroundStyle(primary)
        if let unit {
          Text(unit)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(secondary)
        }
      }
      Text(label)
        .font(.system(size: 8, weight: .bold))
        .foregroundStyle(secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// ─── Shared sub-views ─────────────────────────────────────────────────────────

private enum StrideDesign {
  static let sage = Color(red: 0.545, green: 0.573, blue: 0.486)
  static let clay = Color(red: 0.863, green: 0.753, blue: 0.655)
  static let steel = Color(red: 0.439, green: 0.518, blue: 0.537)
  static let brown = Color(red: 0.302, green: 0.263, blue: 0.243)
  static let critical = Color(red: 0.541, green: 0.200, blue: 0.176)
  static let ink = Color(red: 0.063, green: 0.063, blue: 0.063)
  static let inkRaised = Color(red: 0.094, green: 0.094, blue: 0.094)
  static let inkBorder = Color(red: 0.188, green: 0.188, blue: 0.173)
  static let textPrimaryDark = Color(red: 0.957, green: 0.933, blue: 0.906)
  static let textSecondaryDark = Color(red: 0.812, green: 0.780, blue: 0.733)
  static let cardLight = Color.white
  static let lightBorder = Color(red: 0.906, green: 0.871, blue: 0.831)
  static let textPrimaryLight = Color(red: 0.067, green: 0.067, blue: 0.067)
  static let textSecondaryLight = Color(red: 0.302, green: 0.290, blue: 0.271)
}

private struct IslandMetric: View {
  let label: String
  let value: String
  let unit: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(value)
        .font(.system(.headline, design: .rounded).weight(.heavy))
        .monospacedDigit()
        .foregroundStyle(StrideDesign.textPrimaryDark)
      Text(unit.isEmpty ? label : "\(label) \(unit)")
        .font(.system(size: 9, weight: .bold))
        .foregroundStyle(StrideDesign.textSecondaryDark)
    }
  }
}

private struct ZoneBadge: View {
  let label: String
  let status: String

  var body: some View {
    Text(shortZoneLabel(label))
      .font(.caption.weight(.heavy))
      .padding(.horizontal, 10)
      .padding(.vertical, 6)
      .background(zoneColor(status).opacity(0.28), in: Capsule())
      .foregroundStyle(StrideDesign.textPrimaryDark)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

private func zoneColor(_ status: String) -> Color {
  switch status {
  case "in":    return StrideDesign.sage
  case "near":  return StrideDesign.clay
  case "out":   return StrideDesign.critical
  default:      return StrideDesign.sage
  }
}

private func shortZoneLabel(_ label: String) -> String {
  let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
  if trimmed.isEmpty || trimmed == "Zone --" { return "Z2" }
  if trimmed.hasPrefix("Zone ") {
    return "Z" + trimmed.replacingOccurrences(of: "Zone ", with: "")
  }
  return trimmed
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

private func activityTitle(_ type: String) -> String {
  switch type {
  case "walking": return "Walk"
  case "run_walk": return "Run / Walk"
  case "cycling": return "Ride"
  case "hiking": return "Hike"
  case "downhill_skiing", "cross_country_skiing": return "Ski"
  default: return "Run"
  }
}

private func activityIcon(_ type: String) -> String {
  switch type {
  case "walking", "hiking": return "figure.walk"
  case "cycling": return "bicycle"
  case "downhill_skiing": return "figure.skiing.downhill"
  case "cross_country_skiing": return "figure.skiing.crosscountry"
  default: return "figure.run"
  }
}

private func priorityGuidance(_ state: StrideRunActivityAttributes.ContentState) -> String? {
  if !state.navigationInstruction.isEmpty { return state.navigationInstruction }
  if !state.currentInterval.isEmpty {
    return state.nextTransition.isEmpty
      ? state.currentInterval
      : "\(state.currentInterval) · \(state.nextTransition)"
  }
  if !state.cueText.isEmpty { return state.cueText }
  return nil
}

private func pendingLabel(_ controlState: String) -> String {
  switch controlState {
  case "pause_pending": return "Pausing…"
  case "resume_pending": return "Resuming…"
  case "complete_pending": return "Finishing…"
  default: return "Updating…"
  }
}

// ─── Phase 3: Strength Live Activity ─────────────────────────────────────────

struct StrideStrengthLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: StrideStrengthActivityAttributes.self) { context in
      LockScreenStrengthView(context: context)
        .activityBackgroundTint(Color(red: 0.08, green: 0.09, blue: 0.06))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text("NOW")
              .font(.system(size: 9, weight: .bold))
              .foregroundStyle(Color(red: 0.66, green: 0.69, blue: 0.58))
            Text(context.state.currentExercise)
              .font(.caption.weight(.bold))
              .foregroundStyle(.white)
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 1) {
            Text(context.state.progressLabel.isEmpty
              ? "\(context.state.setsCompleted)/\(context.state.totalSets)"
              : context.state.progressLabel)
              .font(.system(.title3, design: .rounded).weight(.heavy))
              .foregroundStyle(Color(red: 0.72, green: 0.75, blue: 0.64))
            if !context.state.loadDisplay.isEmpty {
              Text(context.state.loadDisplay)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white)
                .lineLimit(1)
            }
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text(formatStrengthElapsed(context.state.elapsedSeconds))
              .font(.system(.body, design: .rounded).weight(.bold))
              .monospacedDigit()
              .foregroundStyle(.white)
            Spacer()
            if context.state.controlState == "ready" {
              Button(intent: MarkSetCompleteIntent()) {
                Label("Done", systemImage: "checkmark")
                  .font(.caption.weight(.bold))
              }
              .buttonStyle(.plain)
              .padding(.horizontal, 10)
              .padding(.vertical, 5)
              .background(Color(red: 0.56, green: 0.72, blue: 0.41).opacity(0.3), in: Capsule())
              .foregroundStyle(Color(red: 0.56, green: 0.72, blue: 0.41))
            } else {
              ProgressView()
                .controlSize(.mini)
                .tint(.white)
            }
          }
        }
      } compactLeading: {
        HStack(spacing: 3) {
          Image(systemName: "dumbbell.fill")
            .font(.caption2.weight(.bold))
            .foregroundStyle(Color(red: 0.72, green: 0.75, blue: 0.64))
          Text("\(context.state.setsCompleted)/\(context.state.totalSets)")
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
        }
      } compactTrailing: {
        Text(formatStrengthElapsed(context.state.elapsedSeconds))
          .font(.caption.weight(.bold))
          .monospacedDigit()
          .foregroundStyle(Color(red: 0.72, green: 0.75, blue: 0.64))
      } minimal: {
        Image(systemName: "dumbbell.fill")
          .foregroundStyle(Color(red: 0.72, green: 0.75, blue: 0.64))
      }
    }
  }
}

// Same adaptive hierarchy as the outdoor view: one header, one exercise row,
// and one action row. Values scale before truncating on narrower presentations.
private struct LockScreenStrengthView: View {
  let context: ActivityViewContext<StrideStrengthActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      // Header: name + status, timer right-aligned
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(context.state.isPaused ? "Paused · \(context.attributes.workoutName)" : context.attributes.workoutName)
          .font(.system(size: 14, weight: .bold))
          .foregroundStyle(context.state.isPaused ? Color(red: 0.91, green: 0.69, blue: 0.34) : .white)
          .lineLimit(1)
        Spacer(minLength: 4)
        Text(formatStrengthElapsed(context.state.elapsedSeconds))
          .font(.system(size: 22, weight: .heavy, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(Color(red: 0.96, green: 0.95, blue: 0.90))
      }

      // Current & next exercise + set progress
      HStack(spacing: 10) {
        VStack(alignment: .leading, spacing: 1) {
          Text("NOW")
            .font(.system(size: 8, weight: .bold))
            .foregroundStyle(Color(red: 0.66, green: 0.69, blue: 0.58))
          Text(context.state.currentExercise)
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(.white)
            .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        if !context.state.nextExercise.isEmpty {
          VStack(alignment: .leading, spacing: 1) {
            Text("NEXT")
              .font(.system(size: 8, weight: .bold))
              .foregroundStyle(Color(red: 0.66, green: 0.69, blue: 0.58))
            Text(context.state.nextExercise)
              .font(.system(size: 13, weight: .semibold))
              .foregroundStyle(Color(red: 0.82, green: 0.82, blue: 0.76))
              .lineLimit(1)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }

        VStack(alignment: .trailing, spacing: 1) {
          Text(context.state.prescription.isEmpty
            ? "\(context.state.setsCompleted)/\(context.state.totalSets)"
            : context.state.prescription)
            .font(.system(size: 16, weight: .heavy, design: .rounded))
            .foregroundStyle(Color(red: 0.96, green: 0.95, blue: 0.90))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
          if !context.state.loadDisplay.isEmpty {
            Text(context.state.loadDisplay)
              .font(.system(size: 12, weight: .bold))
              .foregroundStyle(Color(red: 0.72, green: 0.75, blue: 0.64))
              .lineLimit(1)
          }
        }
      }

      // Control buttons
      HStack(spacing: 8) {
        if context.state.controlState != "ready" {
          HStack(spacing: 7) {
            ProgressView()
              .controlSize(.small)
            Text(pendingLabel(context.state.controlState))
              .font(.subheadline.weight(.bold))
          }
          .frame(maxWidth: .infinity)
          .padding(.vertical, 9)
          .background(Color(red: 0.56, green: 0.72, blue: 0.41).opacity(0.16), in: RoundedRectangle(cornerRadius: 12))
          .foregroundStyle(.white)
        } else if context.state.isPaused {
          Button(intent: ResumeStrengthIntent()) {
            Label("Resume", systemImage: "play.fill")
              .font(.subheadline.weight(.bold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 9)
              .background(Color(red: 0.56, green: 0.72, blue: 0.41).opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
              .foregroundStyle(Color(red: 0.56, green: 0.72, blue: 0.41))
          }
          .buttonStyle(.plain)
        } else {
          Button(intent: MarkSetCompleteIntent()) {
            Label("Mark Complete", systemImage: "checkmark.circle.fill")
              .font(.subheadline.weight(.bold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 9)
              .background(Color(red: 0.56, green: 0.72, blue: 0.41).opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
              .foregroundStyle(Color(red: 0.56, green: 0.72, blue: 0.41))
          }
          .buttonStyle(.plain)

          Button(intent: PauseStrengthIntent()) {
            Label("Pause", systemImage: "pause.fill")
              .font(.subheadline.weight(.bold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 9)
              .background(Color(red: 0.91, green: 0.69, blue: 0.34).opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
              .foregroundStyle(Color(red: 0.91, green: 0.69, blue: 0.34))
          }
          .buttonStyle(.plain)
        }
      }
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
  }
}

private func formatStrengthElapsed(_ seconds: Int) -> String {
  let s = max(0, seconds)
  let m = s / 60
  let sec = s % 60
  return String(format: "%02d:%02d", m, sec)
}
