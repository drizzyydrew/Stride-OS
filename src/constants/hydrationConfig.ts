// ─── Hydration Screen Configuration (Build 36) ─────────────────────────────
//
// Static config + copy for the Hydration Plan screen and its fueling
// reminders. No engine logic lives here — src/utils/hydrationEngine.ts stays
// the single source of truth for calculations. Codex wires reminder
// persistence/scheduling to FUELING_REMINDER_INTERVALS/DEFAULT_FUELING_REMINDER_INTERVAL_MIN.

/** Selectable fueling-reminder intervals, in minutes. */
export const FUELING_REMINDER_INTERVALS = [15, 20, 30, 40] as const;
export type FuelingReminderIntervalMin = (typeof FUELING_REMINDER_INTERVALS)[number];

export const DEFAULT_FUELING_REMINDER_INTERVAL_MIN: FuelingReminderIntervalMin = 20;

/** Every hourly-rate unit on the Hydration screen renders with this suffix —
 *  never used for a concentration value (e.g. mg/L), which is a strength, not
 *  a per-hour amount. */
export const PER_HOUR_UNIT = '/hr';
/** Concentration unit — sodium per liter of drink mix, never rendered with PER_HOUR_UNIT. */
export const CONCENTRATION_UNIT = 'mg/L';

export const DISTANCE_STEP_MI = 0.01;
export const DURATION_STEP_MIN = 1;

// ─── Info-affordance copy (tap-for-explanation) ─────────────────────────────
//
// Plain-language, evidence-safe explanations for each personalization input.
// "may be associated with" / "estimated" / "manual review recommended"
// language only — never a diagnosis, never a guarantee.

export const HYDRATION_INFO_COPY: Record<
  'sweatRate' | 'saltiness' | 'cramping' | 'fluidComfort' | 'giTolerance',
  { title: string; body: string }
> = {
  sweatRate: {
    title: 'Sweat Rate',
    body: 'An estimate of how much fluid you lose per hour of running. A higher sweat rate may be associated with a higher fluid target. If you know your rate from a pre/post-run weigh-in, entering it directly gives a more personalized estimate than the general estimate — manual review is recommended if your results feel off.',
  },
  saltiness: {
    title: 'Saltiness',
    body: 'A self-reported sense of how much visible salt residue you get on skin or clothing after a sweaty run. Saltier sweat may be associated with a higher sodium target. This is a rough self-rating, not a lab measurement.',
  },
  cramping: {
    title: 'Cramping',
    body: 'How often you experience exercise-associated muscle cramping on runs like this one. Frequent cramping may be associated with a more conservative (higher) fluid and sodium target, though cramping has many possible contributing factors and this is not a diagnosis.',
  },
  fluidComfort: {
    title: 'Fluid Comfort',
    body: 'How much fluid volume your stomach can comfortably handle while running at effort. This tunes pacing of the plan toward smaller, more frequent sips or larger, less frequent servings — it does not change the total estimated target.',
  },
  giTolerance: {
    title: 'GI Tolerance',
    body: 'An estimate of how many grams of carbohydrate per hour your gut can comfortably process during exercise. Lower tolerance may be associated with a lower carb target and a recommendation to practice fueling in training. Manual review recommended if you are unsure — "Not sure" uses a conservative default.',
  },
};
