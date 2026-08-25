import type { EdgeInsets } from 'react-native-safe-area-context';

export type FeatureTourId =
  | 'today'
  | 'calendar'
  | 'running'
  | 'strength'
  | 'ai-coach'
  | 'gear'
  | 'stride-report'
  | 'achievements'
  | 'movement-lab'
  | 'health-fitness';

export type FeatureTourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type FeatureTourStep = {
  id: string;
  targetId: string;
  eyebrow?: string;
  title: string;
  description: string;
  preferredPlacement?: FeatureTourPlacement;
  actionLabel?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

export type FeatureTourDefinition = {
  id: FeatureTourId;
  version: number;
  title: string;
  entryLabel: string;
  description: string;
  steps: FeatureTourStep[];
};

export type FeatureTourStatus = {
  completed?: boolean;
  skipped?: boolean;
  lastSeenVersion?: number;
  completedAt?: number;
  skippedAt?: number;
};

export type FeatureTourRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FeatureTourCardPlacement = {
  top: number;
  left: number;
  width: number;
  placement: FeatureTourPlacement;
};

const HELP_TARGET = 'feature-tour.help';

export const FEATURE_TOURS: FeatureTourDefinition[] = [
  {
    id: 'today',
    version: 1,
    title: 'Today Walkthrough',
    entryLabel: 'Today',
    description: 'Scheduled training, readiness, outlook, and forecast.',
    steps: [
      {
        id: 'today-workout',
        targetId: 'today.workout',
        eyebrow: 'TODAY',
        title: "Today's Workout",
        description: 'This is the scheduled training StrideOS is using for today. Starting here keeps the workout linked to the plan.',
        preferredPlacement: 'bottom',
      },
      {
        id: 'today-readiness',
        targetId: 'today.readiness',
        title: 'Daily Check-In',
        description: 'Readiness inputs help StrideOS interpret training context. They are not a medical diagnosis.',
        preferredPlacement: 'top',
      },
      {
        id: 'today-outlook',
        targetId: 'today.outlook',
        title: 'Training Outlook',
        description: 'Outlook answers what the plan should do now based on schedule, completion, and available training information.',
        preferredPlacement: 'top',
      },
      {
        id: 'today-forecast',
        targetId: 'today.forecast',
        title: 'Performance Forecast',
        description: 'Forecast describes where current training appears to be heading. It updates as real workouts accumulate.',
        preferredPlacement: 'top',
      },
    ],
  },
  {
    id: 'calendar',
    version: 1,
    title: 'Calendar Walkthrough',
    entryLabel: 'Calendar',
    description: 'Schedule views, completed activities, and planned sessions.',
    steps: [
      { id: 'calendar-view', targetId: 'calendar.view', title: 'Choose A View', description: 'Switch between month, week, and day views without changing the underlying plan.', preferredPlacement: 'bottom' },
      { id: 'calendar-week', targetId: 'calendar.week', title: 'Scheduled Workouts', description: 'Calendar uses the same scheduled-session spine as Today, Running, Strength, and AI Coach.', preferredPlacement: 'top' },
      { id: 'calendar-day', targetId: 'calendar.day', title: 'Day Actions', description: 'Tap a session to start, complete, reschedule, or review it while preserving completed history.', preferredPlacement: 'top' },
    ],
  },
  {
    id: 'running',
    version: 1,
    title: 'Running Walkthrough',
    entryLabel: 'Running',
    description: 'Run setup, Live Activities, voice cues, routes, and hydration.',
    steps: [
      { id: 'running-tabs', targetId: 'running.tabs', title: 'Running Modes', description: 'Plan, Active, Hydration, and Routes all feed the canonical run workflow.', preferredPlacement: 'bottom' },
      { id: 'running-start', targetId: 'running.start', title: 'Start Run', description: 'Start a planned, custom, interval, treadmill, or free run from the active setup.', preferredPlacement: 'top' },
      { id: 'running-options', targetId: 'running.options', title: 'Workout Setup', description: 'Pick the run type and indoor or outdoor context before tracking begins.', preferredPlacement: 'top' },
      { id: 'running-live', targetId: 'running.live', title: 'Live Activity', description: 'When iOS allows it, active workouts can show key metrics while the phone is locked.', preferredPlacement: 'top' },
      { id: 'running-voice', targetId: 'running.voice', title: 'Voice Coaching', description: 'Voice cues can cover workout starts, intervals, zones, fuel, hydration, distance, and route alerts based on your settings.', preferredPlacement: 'top' },
    ],
  },
  {
    id: 'strength',
    version: 1,
    title: 'Strength Walkthrough',
    entryLabel: 'Strength',
    description: 'Planned strength, presets, custom work, and completed history.',
    steps: [
      { id: 'strength-tabs', targetId: 'strength.tabs', title: 'Strength Areas', description: 'Move between planned strength, presets, and mobility without creating duplicate workout records.', preferredPlacement: 'bottom' },
      { id: 'strength-today', targetId: 'strength.today', title: "Today's Strength", description: 'Start or review the strength work scheduled for today.', preferredPlacement: 'top' },
      { id: 'strength-history', targetId: 'strength.history', title: 'Training History', description: 'Completed sets, reps, resistance, and RPE contribute to training history where supported.', preferredPlacement: 'top' },
    ],
  },
  {
    id: 'ai-coach',
    version: 1,
    title: 'AI Coach Walkthrough',
    entryLabel: 'AI Coach',
    description: 'Ask questions, review context, and understand plan recommendations.',
    steps: [
      { id: 'coach-tabs', targetId: 'coach.tabs', title: 'Coach Views', description: 'Ask questions, review insights, or discuss Movement Lab results from one place.', preferredPlacement: 'bottom' },
      { id: 'coach-context', targetId: 'coach.context', title: 'Training Context', description: 'AI Coach uses compact training context. A recommendation is not a schedule change until you confirm it.', preferredPlacement: 'top' },
      { id: 'coach-input', targetId: 'coach.input', title: 'Ask Coach', description: 'Ask plain-language training questions. Medical concerns should go to a qualified clinician.', preferredPlacement: 'top' },
    ],
  },
  {
    id: 'gear',
    version: 1,
    title: 'Gear Walkthrough',
    entryLabel: 'Gear',
    description: 'Shoes, equipment, mileage, and source preferences.',
    steps: [
      { id: 'gear-shoes', targetId: 'gear.shoes', title: 'Add Shoes', description: 'Assigning the correct shoe keeps mileage and shoe reports accurate.', preferredPlacement: 'bottom' },
      { id: 'gear-rotation', targetId: 'gear.rotation', title: 'Shoe Rotation', description: 'StrideOS preserves shoe history even after retirement.', preferredPlacement: 'top' },
      { id: 'gear-equipment', targetId: 'gear.equipment', title: 'Equipment', description: 'Manual equipment stays available while Bluetooth sensor support is expanded.', preferredPlacement: 'top' },
    ],
  },
  {
    id: 'stride-report',
    version: 1,
    title: 'Stride Report Walkthrough',
    entryLabel: 'Stride Report',
    description: 'Week, month, year, highlights, shoes, and sharing.',
    steps: [
      { id: 'report-range', targetId: 'stride-report.range', title: 'Report Range', description: 'Switch between week, month, and year while keeping units consistent.', preferredPlacement: 'bottom' },
      { id: 'report-highlights', targetId: 'stride-report.highlights', title: 'Highlights', description: 'Highlights are generated from recorded StrideOS activity and available synced data.', preferredPlacement: 'top' },
      { id: 'report-share', targetId: 'stride-report.share', title: 'Share Cards', description: 'Shared reports use StrideOS designs and exclude private notes and shoe photos by default.', preferredPlacement: 'top' },
    ],
  },
  {
    id: 'achievements',
    version: 1,
    title: 'Achievements Walkthrough',
    entryLabel: 'Achievements',
    description: 'Milestones, records, run levels, and mountain elevation.',
    steps: [
      { id: 'achievements-hub', targetId: 'achievements.hub', title: 'Achievements', description: 'Achievements recognize consistency, progression, milestones, and notable performances.', preferredPlacement: 'bottom' },
      { id: 'achievements-levels', targetId: 'achievements.hub', title: 'Run Levels', description: 'Run Levels track lifetime running-distance progression using the current StrideOS thresholds.', preferredPlacement: 'top' },
      { id: 'achievements-elevation', targetId: 'achievements.elevation', title: 'Cumulative Elevation', description: 'Accumulated elevation unlocks real mountain landmarks, without needing to climb the actual mountain.', preferredPlacement: 'top' },
      { id: 'achievements-share', targetId: 'achievements.share', title: 'Share Achievements', description: 'Unlocked achievements can be shared with privacy-safe StrideOS cards where supported.', preferredPlacement: 'top' },
    ],
  },
  {
    id: 'movement-lab',
    version: 1,
    title: 'Movement Lab Walkthrough',
    entryLabel: 'Movement Lab',
    description: 'Assessments, recording, estimated measurements, and review.',
    steps: [
      { id: 'movement-assessments', targetId: 'movement.assessments', title: 'Choose Assessment', description: 'Select the movement you want to record and review.', preferredPlacement: 'bottom' },
      { id: 'movement-capture', targetId: 'movement.capture', title: 'Capture Setup', description: 'The capture guidance helps position the camera so measurements are more usable.', preferredPlacement: 'top' },
      { id: 'movement-results', targetId: 'movement.results', title: 'Estimated Findings', description: 'Automated measurements are estimated two-dimensional values, not clinical diagnoses.', preferredPlacement: 'top' },
      { id: 'movement-coach', targetId: 'movement.coach', title: 'Coach Handoff', description: 'When available, Movement Lab can pass concise findings into AI Coach for training context.', preferredPlacement: 'top' },
    ],
  },
  {
    id: 'health-fitness',
    version: 1,
    title: 'Health And Fitness Walkthrough',
    entryLabel: 'Health And Fitness',
    description: 'Reserved for a future user-facing Apple Health sync surface.',
    steps: [
      { id: 'health-future', targetId: HELP_TARGET, title: 'Health Data', description: 'When this screen is available, the walkthrough can explain permissions, imports, duplicate prevention, and synced fields.', preferredPlacement: 'center' },
    ],
  },
];

export const FEATURE_TOUR_BY_ID = FEATURE_TOURS.reduce<Record<FeatureTourId, FeatureTourDefinition>>((acc, tour) => {
  acc[tour.id] = tour;
  return acc;
}, {} as Record<FeatureTourId, FeatureTourDefinition>);

export function getFeatureTour(id: FeatureTourId): FeatureTourDefinition {
  return FEATURE_TOUR_BY_ID[id];
}

export function shouldAutoStartTour(
  definition: Pick<FeatureTourDefinition, 'version'>,
  status: FeatureTourStatus | undefined,
): boolean {
  if (!status) return true;
  if (status.completed && status.lastSeenVersion === definition.version) return false;
  if (status.skipped && status.lastSeenVersion === definition.version) return false;
  return status.lastSeenVersion !== definition.version;
}

export function completedTourStatus(definition: Pick<FeatureTourDefinition, 'version'>, now = Date.now()): FeatureTourStatus {
  return {
    completed: true,
    skipped: false,
    lastSeenVersion: definition.version,
    completedAt: now,
  };
}

export function skippedTourStatus(definition: Pick<FeatureTourDefinition, 'version'>, now = Date.now()): FeatureTourStatus {
  return {
    completed: false,
    skipped: true,
    lastSeenVersion: definition.version,
    skippedAt: now,
  };
}

export function nextStepIndex(current: number, total: number): number {
  return Math.min(total - 1, current + 1);
}

export function previousStepIndex(current: number): number {
  return Math.max(0, current - 1);
}

export function cardPlacementForTarget(params: {
  target: FeatureTourRect | null;
  viewportWidth: number;
  viewportHeight: number;
  insets: Pick<EdgeInsets, 'top' | 'bottom'>;
  preferredPlacement?: FeatureTourPlacement;
}): FeatureTourCardPlacement {
  const horizontalMargin = 16;
  const verticalGap = 12;
  const minTop = params.insets.top + 12;
  const maxBottom = params.viewportHeight - params.insets.bottom - 12;
  const width = Math.min(params.viewportWidth - horizontalMargin * 2, 360);
  const left = Math.max(horizontalMargin, Math.min(params.viewportWidth - width - horizontalMargin, params.target ? params.target.x : horizontalMargin));
  const fallbackTop = Math.max(minTop, Math.min(maxBottom - 190, Math.round(params.viewportHeight * 0.52)));

  if (!params.target) {
    return { top: fallbackTop, left, width, placement: 'center' };
  }

  const below = params.target.y + params.target.height + verticalGap;
  const above = params.target.y - 190 - verticalGap;
  const preferred = params.preferredPlacement ?? (below < maxBottom - 120 ? 'bottom' : 'top');

  if (preferred === 'bottom' && below < maxBottom - 110) {
    return { top: below, left, width, placement: 'bottom' };
  }
  if (preferred === 'top' && above > minTop) {
    return { top: above, left, width, placement: 'top' };
  }
  if (below < maxBottom - 110) {
    return { top: below, left, width, placement: 'bottom' };
  }
  if (above > minTop) {
    return { top: above, left, width, placement: 'top' };
  }
  return { top: fallbackTop, left, width, placement: 'center' };
}

export function highlightRectForTarget(target: FeatureTourRect | null, viewportWidth: number): FeatureTourRect | null {
  if (!target) return null;
  const pad = 8;
  return {
    x: Math.max(8, target.x - pad),
    y: Math.max(8, target.y - pad),
    width: Math.min(viewportWidth - 16, target.width + pad * 2),
    height: Math.max(44, target.height + pad * 2),
  };
}

export function featureTourAccessibilityLabel(step: FeatureTourStep, index: number, total: number): string {
  return step.accessibilityLabel ?? `${step.title}. Step ${index + 1} of ${total}. ${step.description}`;
}
