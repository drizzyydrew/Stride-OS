import { useAthleteStore } from '../../../src/store/athleteStore';

import ScreenLayout from '../../../src/layout/ScreenLayout';
import MetricCard from '../../../src/components/ui/MetricCard';

export default function StrengthScreen() {
  const { fatigueScore, recoveryScore } = useAthleteStore();

  return (
    <ScreenLayout title="Strength">
      <MetricCard
        label="Fatigue"
        value={fatigueScore}
        helper="Neuromuscular strain"
      />

      <MetricCard
        label="Recovery"
        value={recoveryScore}
        helper="Readiness for lifting"
      />

      <MetricCard
        label="Primary Focus"
        value="Force Production"
        helper="Max strength development"
      />
    </ScreenLayout>
  );
}
