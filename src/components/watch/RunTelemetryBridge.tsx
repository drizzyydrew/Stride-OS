import { useOutdoorTelemetry } from '../../hooks/useOutdoorTelemetry';
import { useActiveRunStore } from '../../store/activeRunStore';
import { useIntegrationsStore } from '../../store/integrationsStore';
import { useActiveActivityStore } from '../../store/activeActivityStore';

/** Mount once at app root so navigating away does not stop collection. */
export default function RunTelemetryBridge() {
  const run = useActiveRunStore();
  const healthKitEnabled = useIntegrationsStore(state => state.healthKitEnabled);
  useOutdoorTelemetry({
    workoutInstanceId: run.workoutInstanceId, startedAt: run.startTime,
    activityType: 'running', isActive: run.isActive, isPaused: run.isPaused,
    healthKitEnabled, onSamples: run.appendTelemetry,
  });
  return <OutdoorTelemetryBridge />;
}

function OutdoorTelemetryBridge() {
  const activity = useActiveActivityStore();
  const healthKitEnabled = useIntegrationsStore(state => state.healthKitEnabled);
  useOutdoorTelemetry({
    workoutInstanceId: activity.workoutInstanceId, startedAt: activity.startedAt,
    activityType: activity.activityType, isActive: activity.isActive, isPaused: activity.isPaused,
    healthKitEnabled, onSamples: activity.appendTelemetry,
  });
  return null;
}
