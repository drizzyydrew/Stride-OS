import type { Activity } from '../types/activity';
import type { Shoe } from '../store/gearStore';

export type ShoeMileageSummary = {
  shoeId: string;
  miles: number;
  activityCount: number;
  lastUsedAt: number | null;
};

function activityMiles(activity: Activity): number {
  const meters = activity.metrics.distanceMeters ?? 0;
  return Number.isFinite(meters) && meters > 0 ? meters / 1609.344 : 0;
}

export function deriveShoeMileage(
  activities: readonly Activity[],
  shoes: readonly Shoe[],
): ShoeMileageSummary[] {
  const summaries = new Map<string, ShoeMileageSummary>();
  for (const shoe of shoes) {
    summaries.set(shoe.id, { shoeId: shoe.id, miles: 0, activityCount: 0, lastUsedAt: null });
  }

  for (const activity of activities) {
    if (activity.status === 'skipped' || !activity.shoeId) continue;
    const summary = summaries.get(activity.shoeId);
    if (!summary) continue;
    const miles = activityMiles(activity);
    if (miles <= 0) continue;
    summary.miles += miles;
    summary.activityCount += 1;
    summary.lastUsedAt = Math.max(summary.lastUsedAt ?? 0, activity.startTime);
  }

  return [...summaries.values()].map(summary => ({
    ...summary,
    miles: Math.round(summary.miles * 10) / 10,
  }));
}

export function mostUsedShoe(
  activities: readonly Activity[],
  shoes: readonly Shoe[],
): { shoe: Shoe; miles: number } | null {
  const mileage = deriveShoeMileage(activities, shoes)
    .sort((a, b) => b.miles - a.miles)[0];
  const shoe = mileage ? shoes.find(item => item.id === mileage.shoeId) : undefined;
  return shoe && mileage.miles > 0 ? { shoe, miles: mileage.miles } : null;
}

export function shoeWearReminderCopy(shoe: Shoe, miles: number): string | null {
  if (!shoe.reminderThresholdMiles || miles < shoe.reminderThresholdMiles) return null;
  return `${shoe.brand} ${shoe.model} has about ${Math.round(miles)} miles logged. Consider checking wear.`;
}
