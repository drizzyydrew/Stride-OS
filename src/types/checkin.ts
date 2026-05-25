export type DailyCheckIn = {
  date:        string;   // "YYYY-MM-DD" — identifies which calendar day this belongs to
  sleepHours:  number;
  hrDelta:     number;   // BPM above baseline resting HR
  soreness:    number;   // 1–10 subjective scale
  motivation:  number;   // 1–10 subjective scale
};

export type PostWorkoutNote = {
  completionKey: string;   // matches workoutStore week-scoped key
  rpe:           number;   // 1–10 Rate of Perceived Exertion
  notes:         string;
  timestamp:     number;   // Date.now() at save
};

// Returns "YYYY-MM-DD" for the current local date.
// Used consistently in checkInStore and components to detect "today".
export function todayDateKey(): string {
  const d   = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
