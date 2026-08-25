# Build 57 Contextual Feature Walkthroughs

## Architecture

Build 57 adds one shared feature-tour system rather than screen-local tutorial logic.

- `src/utils/featureTours.ts` defines tour IDs, versions, steps, copy, target IDs, first-use rules, and layout placement helpers.
- `src/store/featureTourStore.ts` persists completed/skipped tour state using the existing app JSON storage pattern.
- `src/components/featureTour/FeatureTourProvider.tsx` owns active tour state, measures real rendered targets, blocks accidental touches, handles accessibility focus, and records analytics-ready events.
- `src/components/featureTour/FeatureTourTarget.tsx` registers measured UI targets with the provider.
- `app/(tabs)/settings/feature-tours.tsx` lets users replay available tours.

The system is data-driven, versioned, and analytics-ready without adding a new analytics SDK.

## Implemented Tours

- Today
- Calendar
- Running
- Strength
- AI Coach
- Gear
- Stride Report
- Achievements
- Movement Lab

Health and Fitness Sync is defined as a future-ready tour entry but is not shown in replay because there is no current user-facing sync screen to teach.

## Accessibility

The overlay uses modal accessibility semantics, step progress labels, logical focus movement, Reduce Motion detection, safe-area-aware positioning, and touch interception so highlighted controls are not accidentally activated.

## Layout Behavior

Targets are measured with `measureInWindow`, so the spotlight follows rendered UI instead of screenshot coordinates. Missing or unmounted targets fall back to a centered explanation card. This avoids orphaned overlays when a feature is hidden, a tab is not mounted, or navigation changes during a replay.

## Validation Coverage

Focused tests in `scripts/tests/featureTours.test.ts` cover:

- required tour definitions
- versioned first-use triggering
- completed/skipped behavior
- replay-safe status separation
- step progression
- missing target recovery
- safe-area and narrow-screen placement
- highlight bounds
- accessibility label generation
- independent completion state between features
