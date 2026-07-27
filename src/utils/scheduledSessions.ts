import type { CalendarEntry } from './calendarEngine';
import { addDays, parseYMD, toYMD } from './calendarEngine';
import type { WeekPlan } from './trainingEngine';
import type { RichWorkout } from '../types/workout';
import type { StrengthSession } from '../types/strength';
import type { GeneratedBeginnerPlan, BeginnerPlanSession } from '../types/beginnerPlan';
import type { TrainingFocus, TrainingPhase } from '../types/training';
import type { SessionStressProfile } from './sessionStress';
import { BEGINNER_PLAN_DEFINITIONS } from './beginnerPlans';
import { displayLabel } from './displayLabels';
import { formatPrescriptionWithSets } from './prescriptionFormat';
import { classifySessionStress } from './sessionStress';
import {
  beginnerScheduledSessionId,
  otherScheduledSessionId,
  runScheduledSessionId,
  strengthScheduledSessionId,
} from './scheduledSessionIds';
import type { CompletionClassification } from '../types/activity';

export type ScheduledSessionStatus =
  | 'upcoming'
  | 'today'
  | 'in_progress'
  | 'completed'
  | 'partial'
  | 'skipped'
  | 'moved'
  | 'missed'
  | 'replaced'
  | 'optional';

export type ScheduledSessionPriority = 'primary' | 'supporting' | 'optional';

export type RunWalkPrescription = {
  totalMinutes: number;
  warmupMinutes: number;
  runSeconds: number;
  walkSeconds: number;
  rounds: number;
  cooldownMinutes: number;
  hrZone: string;
  rpe: string;
  pace: string;
  voicePrompts: string[];
};

export type ScheduledSession = {
  scheduledSessionId: string;
  trainingBlockId?: string;
  goalPlanId?: string;
  date: string;
  originalDate: string;
  activityType: CalendarEntry['type'];
  subtype: string;
  title: string;
  purpose: string;
  priority: ScheduledSessionPriority;
  durationMinutes: number;
  distanceMiles?: number;
  warmup?: string;
  mainSet?: string;
  cooldown?: string;
  target: string;
  hrTarget?: string;
  rpeTarget?: string;
  paceTarget?: string;
  runWalk?: RunWalkPrescription;
  richWorkout?: RichWorkout;
  strengthSession?: StrengthSession;
  status: ScheduledSessionStatus;
  completedActivityId?: string;
  completionState?: CompletionClassification;
  adaptationReason?: string;
  loadEstimate?: number;
  trainingPhase?: TrainingPhase;
  trainingFocus?: TrainingFocus;
  stress?: SessionStressProfile;
};

function localEndOfDay(dateYMD: string): number {
  const d = parseYMD(dateYMD);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function statusFor(dateYMD: string, completed: boolean, missed: boolean | undefined, now = new Date()): ScheduledSessionStatus {
  if (completed) return 'completed';
  const today = toYMD(now);
  if (dateYMD === today) return 'today';
  if (dateYMD < today && now.getTime() > localEndOfDay(dateYMD)) return 'missed';
  if (missed && dateYMD < today) return 'missed';
  return 'upcoming';
}

export function buildRunWalkPrescription(session: BeginnerPlanSession): RunWalkPrescription | null {
  if (session.kind !== 'run_walk') return null;
  const warmupMinutes = 5;
  const cooldownMinutes = 5;
  const runSeconds = session.runSeconds ?? 90;
  const walkSeconds = session.walkSeconds ?? 90;
  const availableMainSeconds = Math.max(0, (session.durationMinutes - warmupMinutes - cooldownMinutes) * 60);
  const rounds = session.repeats ?? Math.max(1, Math.floor(availableMainSeconds / Math.max(1, runSeconds + walkSeconds)));
  const totalMinutes = warmupMinutes + cooldownMinutes + Math.round((rounds * (runSeconds + walkSeconds)) / 60);
  return {
    totalMinutes,
    warmupMinutes,
    runSeconds,
    walkSeconds,
    rounds,
    cooldownMinutes,
    hrZone: 'Zone 2 or below',
    rpe: '3-4',
    pace: 'Conversational',
    voicePrompts: [
      'Begin running.',
      'Slow to a walk.',
      'Thirty seconds until the next running interval.',
      'One minute remaining in this interval.',
      'Workout complete.',
    ],
  };
}

export function describeRunWalk(prescription: RunWalkPrescription): string {
  return `${prescription.totalMinutes} min - ${prescription.rounds} rounds - ${prescription.runSeconds} sec run / ${prescription.walkSeconds} sec walk - ${prescription.hrZone}`;
}

export function runWalkMainSetText(prescription: RunWalkPrescription): string {
  return `${prescription.rounds} rounds: ${prescription.runSeconds} seconds running / ${prescription.walkSeconds} seconds walking`;
}

function beginnerWorkoutFromSession(session: BeginnerPlanSession, dayIndex: number): RichWorkout | undefined {
  if (!['run_walk', 'easy_run', 'long_session', 'walk'].includes(session.kind)) return undefined;
  const runWalk = buildRunWalkPrescription(session);
  const title = beginnerTitle(session);
  const durationMinutes = runWalk?.totalMinutes ?? session.durationMinutes;
  const richType = session.kind === 'run_walk'
    ? 'run_walk'
    : session.kind === 'long_session'
      ? 'long_run'
      : session.kind === 'walk'
        ? 'recovery_run'
        : 'easy_run';
  const mainInstruction = runWalk
    ? runWalkMainSetText(runWalk)
    : `${durationMinutes} minutes at a conversational effort.`;
  return {
    id: session.id,
    title,
    description: session.explanation || session.purpose,
    type: richType === 'long_run' ? 'long_run' : richType === 'run_walk' ? 'easy_run' : 'easy_run',
    richType,
    zone: 'easy',
    durationMinutes,
    targetDistance: undefined,
    energySystem: 'aerobic_power',
    recoveryCost: session.intensity === 'moderate' ? 42 : 24,
    fatigueScore: session.intensity === 'moderate' ? 35 : 18,
    completed: false,
    intensity: session.intensity === 'recovery' ? 'very_easy' : session.intensity,
    paceGuidance: {
      label: 'Conversational',
      description: 'Slow enough that the next interval still feels controlled.',
      targetPace: 'Conversational',
    },
    dayIndex,
    paceRange: { minSecPerMi: 720, maxSecPerMi: 540 },
    hrZoneTarget: 2,
    rpeRange: session.intensity === 'moderate' ? [4, 6] : [3, 4],
    warmup: {
      label: 'Warm-up',
      duration: runWalk ? `${runWalk.warmupMinutes} min` : '5 min',
      paceGuide: 'Easy walk or very easy jog',
      hrZone: 1,
      rpe: [2, 3],
      instructions: runWalk ? `${runWalk.warmupMinutes}-minute easy walk.` : 'Start with five minutes easy.',
    },
    mainSet: [{
      label: 'Main set',
      duration: runWalk
        ? `${Math.round((runWalk.rounds * (runWalk.runSeconds + runWalk.walkSeconds)) / 60)} min`
        : `${Math.max(0, durationMinutes - 10)} min`,
      paceGuide: runWalk?.pace ?? 'Conversational',
      hrZone: 2,
      rpe: session.intensity === 'moderate' ? [4, 6] : [3, 4],
      instructions: mainInstruction,
    }],
    cooldown: {
      label: 'Cooldown',
      duration: runWalk ? `${runWalk.cooldownMinutes} min` : '5 min',
      paceGuide: 'Easy walk',
      hrZone: 1,
      rpe: [1, 2],
      instructions: runWalk ? `${runWalk.cooldownMinutes}-minute easy walk.` : 'Finish with five minutes easy.',
    },
    intervals: runWalk ? {
      setCount: runWalk.rounds,
      workLabel: `${runWalk.runSeconds} sec`,
      restLabel: `${runWalk.walkSeconds} sec walk`,
      workPaceGuide: runWalk.pace,
      workHRZone: 2,
      workRPE: [3, 4],
      restType: 'walk',
      totalWorkMin: Math.round((runWalk.rounds * runWalk.runSeconds) / 60),
      progressionNote: 'Progress only when the current ratio stays conversational and symptoms remain quiet.',
    } : undefined,
    purpose: session.explanation || session.purpose,
    instructions: runWalk
      ? [
        `${runWalk.warmupMinutes}-minute easy walk.`,
        runWalkMainSetText(runWalk),
        `${runWalk.cooldownMinutes}-minute easy walk.`,
        'Keep effort conversational and hold the week if recovery or symptoms are not responding.',
      ]
      : [
        'Start easy for five minutes.',
        mainInstruction,
        'Finish with a five-minute cooldown.',
      ],
    executionCues: runWalk?.voicePrompts ?? ['Keep the effort conversational.', 'Ease the pace if heart rate drifts high.'],
    failureConditions: [
      'Stop or switch to walking for concerning symptoms, sharp pain, chest symptoms, or unusual dizziness.',
      'This is coaching guidance, not a medical diagnosis or guarantee.',
    ],
    modifications: [
      {
        condition: 'If heart rate or RPE stays above target for more than a few minutes',
        action: 'Extend the walk portions or shorten the main set.',
      },
      {
        condition: 'If symptoms increase during or after the session',
        action: 'Hold this session type and use walking or mobility until symptoms settle.',
      },
    ],
    rationale: {
      adaptation: 'Aerobic consistency and impact tolerance',
      mechanism: 'Short controlled bouts build running rhythm while walking recoveries limit unnecessary intensity accumulation.',
      timeframe: 'Expect tolerance changes over several consistent weeks.',
      scienceBasis: 'Conservative beginner periodization principles: durability before intensity, gradual progression, and recovery weeks.',
    },
    score: {
      intendedLoad: Math.round(durationMinutes * (session.intensity === 'moderate' ? 5 : 3)),
      estimatedFatigueCost: session.intensity === 'moderate' ? 32 : 20,
      expectedAdaptation: 55,
      recoveryDemandHours: 24,
      confidenceScore: 78,
      executionDifficulty: runWalk ? 28 : 22,
    },
    progressionNote: session.explanation,
  };
}

function beginnerTitle(session: BeginnerPlanSession): string {
  if (session.kind === 'run_walk') return 'Run/Walk Intervals';
  if (session.kind === 'walk') return 'Endurance Walk';
  if (session.kind === 'easy_run') return 'Easy Aerobic Run';
  if (session.kind === 'long_session') return 'Long Easy Session';
  if (session.kind === 'strength') return 'Runner Foundation Strength A';
  if (session.kind === 'mobility') return 'Recovery Mobility';
  if (session.kind === 'cross_training') return displayLabel(session.activityType);
  return displayLabel(session.kind);
}

function beginnerPriority(session: BeginnerPlanSession): ScheduledSessionPriority {
  if (session.supplements) return 'supporting';
  if (session.kind === 'mobility') return 'optional';
  return ['walk', 'run_walk', 'easy_run', 'long_session'].includes(session.kind) ? 'primary' : 'supporting';
}

function attachStress(session: ScheduledSession): ScheduledSession {
  return { ...session, stress: classifySessionStress(session) };
}

function trainingFocusForBeginnerSession(session: BeginnerPlanSession): TrainingFocus {
  if (session.kind === 'strength') return 'Strength';
  if (session.kind === 'mobility') return 'Recovery';
  if (session.kind === 'cross_training') return 'Aerobic Capacity';
  return session.kind === 'long_session' ? 'Durability' : 'Aerobic Capacity';
}

export function sessionsFromBeginnerPlanForDate(
  plan: GeneratedBeginnerPlan,
  dateYMD: string,
  now = new Date(),
): ScheduledSession[] {
  if (dateYMD < plan.startDate || dateYMD > plan.targetDate) return [];
  const dayOffset = Math.floor((parseYMD(dateYMD).getTime() - parseYMD(plan.startDate).getTime()) / 86_400_000);
  if (dayOffset < 0) return [];
  const week = plan.weeks[Math.floor(dayOffset / 7)];
  if (!week) return [];
  const dayIndex = dayOffset % 7;
  const goalTitle = BEGINNER_PLAN_DEFINITIONS[plan.goal].title;

  return week.sessions
    .filter(session => session.dayIndex === dayIndex)
    .map(session => {
      const runWalk = buildRunWalkPrescription(session);
      const title = beginnerTitle(session);
      const richWorkout = beginnerWorkoutFromSession(session, dayIndex);
      const target = runWalk
        ? describeRunWalk(runWalk)
        : `${session.durationMinutes} min - ${displayLabel(session.intensity)} effort`;
      return attachStress({
        scheduledSessionId: beginnerScheduledSessionId(plan.id, session.id),
        trainingBlockId: 'active-preset-plan',
        goalPlanId: plan.id,
        date: dateYMD,
        originalDate: dateYMD,
        activityType: session.kind === 'run_walk'
          ? 'run_walk'
          : session.kind === 'walk'
            ? 'walk'
            : session.kind === 'strength'
              ? 'strength'
              : session.kind === 'mobility'
                ? 'mobility'
                : session.kind === 'cross_training'
                  ? 'cycling'
                  : 'run',
        subtype: session.kind,
        title,
        purpose: session.explanation || session.purpose || `${goalTitle} progression session.`,
        priority: beginnerPriority(session),
        durationMinutes: runWalk?.totalMinutes ?? session.durationMinutes,
        warmup: runWalk ? `${runWalk.warmupMinutes}-minute easy walk` : undefined,
        mainSet: runWalk
          ? `${runWalk.rounds} rounds: ${runWalk.runSeconds} sec run / ${runWalk.walkSeconds} sec walk`
          : session.purpose,
        cooldown: runWalk ? `${runWalk.cooldownMinutes}-minute easy walk` : undefined,
        target,
        hrTarget: runWalk?.hrZone ?? 'Easy aerobic HR',
        rpeTarget: runWalk?.rpe ?? (session.intensity === 'moderate' ? '5-6' : '3-4'),
        paceTarget: runWalk?.pace ?? 'Conversational',
        runWalk: runWalk ?? undefined,
        richWorkout,
        status: statusFor(dateYMD, false, false, now),
        adaptationReason: week.isRecoveryWeek ? 'Recovery week - reduced duration and no added intensity.' : undefined,
        loadEstimate: session.durationMinutes * (session.intensity === 'moderate' ? 5 : session.intensity === 'recovery' ? 2 : 3),
        trainingPhase: week.isRecoveryWeek ? 'deload' : 'foundation',
        trainingFocus: trainingFocusForBeginnerSession(session),
      } satisfies ScheduledSession);
    });
}

function sessionFromCalendarEntry(entry: CalendarEntry, now = new Date()): ScheduledSession {
  const workout = entry.workout as RichWorkout | undefined;
  const strength = entry.session;
  const title = entry.label;
  const durationMinutes = workout?.durationMinutes ?? strength?.targetDuration ?? 0;
  const target = workout
    ? `${workout.durationMinutes} min - HR Zone ${workout.hrZoneTarget} - RPE ${workout.rpeRange[0]}-${workout.rpeRange[1]}`
    : strength
      ? `${strength.targetDuration} min - ${strength.exercises.length} exercises`
      : displayLabel(entry.type);
  return attachStress({
    scheduledSessionId: workout
      ? runScheduledSessionId(entry.date, workout.id, workout.dayIndex)
      : strength
        ? strengthScheduledSessionId(entry.date, strength.id)
        : otherScheduledSessionId(entry.date, entry.type, title),
    date: entry.date,
    originalDate: entry.date,
    activityType: entry.type,
    subtype: workout?.richType ?? strength?.sessionType ?? entry.type,
    title,
    purpose: workout?.purpose ?? strength?.purpose ?? title,
    priority: entry.type === 'mobility' ? 'optional' : entry.type === 'strength' ? 'supporting' : 'primary',
    durationMinutes,
    warmup: workout?.warmup?.instructions ?? strength?.warmupProtocol,
    mainSet: workout?.mainSet?.map(segment => `${segment.label}: ${segment.duration}`).join('; ')
      ?? strength?.exercises.map(ex => `${ex.exercise.name}: ${formatPrescriptionWithSets(ex.sets, ex.repScheme, `${ex.repRange[0]}-${ex.repRange[1]} reps`)}`).join('; '),
    cooldown: workout?.cooldown?.instructions ?? strength?.cooldownProtocol,
    target,
    hrTarget: workout ? `Zone ${workout.hrZoneTarget}` : undefined,
    rpeTarget: workout ? `${workout.rpeRange[0]}-${workout.rpeRange[1]}` : strength ? 'See exercise targets' : undefined,
    paceTarget: workout?.paceGuidance.targetPace,
    richWorkout: workout,
    strengthSession: strength,
    status: statusFor(entry.date, entry.completed, entry.missed, now),
    loadEstimate: workout?.score.intendedLoad,
  });
}

export function scheduledSessionsForDate(
  weekPlan: WeekPlan,
  activeBeginnerPlan: GeneratedBeginnerPlan | null,
  dateYMD: string,
  now = new Date(),
): ScheduledSession[] {
  const beginner = activeBeginnerPlan ? sessionsFromBeginnerPlanForDate(activeBeginnerPlan, dateYMD, now) : [];
  if (beginner.length > 0) {
    const projectedEntries = weekPlan.calendarMap.get(dateYMD) ?? [];
    const enrichedById = new Map(
      projectedEntries
        .filter(entry => entry.scheduledSessionId)
        .map(entry => [entry.scheduledSessionId!, sessionFromCalendarEntry(entry, now)]),
    );
    return dedupePrimarySessions(beginner.map(session => {
      const enriched = enrichedById.get(session.scheduledSessionId);
      return {
      ...session,
      ...(enriched ?? {}),
      scheduledSessionId: session.scheduledSessionId,
      date: session.date,
      originalDate: session.originalDate,
      status: enriched?.status ?? session.status,
      priority: session.priority,
      runWalk: session.runWalk,
      richWorkout: session.richWorkout ?? enriched?.richWorkout,
      strengthSession: enriched?.strengthSession ?? session.strengthSession,
      };
    }));
  }
  return (weekPlan.calendarMap.get(dateYMD) ?? []).map(entry => sessionFromCalendarEntry(entry, now));
}

export function calendarEntriesFromScheduledSessions(
  sessions: ScheduledSession[],
): CalendarEntry[] {
  return sessions.map(session => ({
    date: session.date,
    type: session.activityType,
    label: session.title,
    color: session.activityType === 'strength' ? '#A855F7' : '#DCC0A7',
    workout: session.richWorkout,
    session: session.strengthSession,
    completed: session.status === 'completed' || session.status === 'partial',
    missed: session.status === 'missed',
    scheduledSessionId: session.scheduledSessionId,
    completedActivityId: session.completedActivityId,
    completionState: session.completionState,
    originalDate: session.originalDate,
    designation: session.priority,
    summary: session.mainSet ?? session.purpose,
    target: session.target,
    status: session.status,
  }));
}

export function scheduledSessionsForWeek(
  weekPlan: WeekPlan,
  activeBeginnerPlan: GeneratedBeginnerPlan | null,
  weekStartDate = weekPlan.weekStartDate,
  now = new Date(),
): ScheduledSession[] {
  return dedupePrimarySessions(
    Array.from({ length: 7 }, (_, index) => toYMD(addDays(weekStartDate, index)))
      .flatMap(date => scheduledSessionsForDate(weekPlan, activeBeginnerPlan, date, now)),
  );
}

export function dedupePrimarySessions(sessions: ScheduledSession[]): ScheduledSession[] {
  const byDate = new Map<string, boolean>();
  return sessions.filter(session => {
    if (session.priority !== 'primary' || !['run', 'run_walk', 'walk'].includes(session.activityType)) return true;
    if (byDate.get(session.date)) return false;
    byDate.set(session.date, true);
    return true;
  });
}

export function primarySessionForDate(sessions: ScheduledSession[]): ScheduledSession | null {
  return sessions.find(session => session.priority === 'primary')
    ?? sessions.find(session => session.priority === 'supporting')
    ?? sessions[0]
    ?? null;
}

export function getScheduledSessionsForDate(
  weekPlan: WeekPlan,
  activeBeginnerPlan: GeneratedBeginnerPlan | null,
  dateYMD: string,
  now = new Date(),
): ScheduledSession[] {
  return scheduledSessionsForDate(weekPlan, activeBeginnerPlan, dateYMD, now);
}

export function getPrimarySessionForDate(sessions: ScheduledSession[]): ScheduledSession | null {
  return primarySessionForDate(sessions);
}

export function getSupportingSessionsForDate(sessions: ScheduledSession[]): ScheduledSession[] {
  return sessions.filter(session => session.priority === 'supporting');
}

export function getScheduledRunForDate(sessions: ScheduledSession[]): ScheduledSession | null {
  return sessions.find(session =>
    session.priority === 'primary'
    && ['run', 'run_walk', 'walk'].includes(session.activityType),
  ) ?? sessions.find(session => ['run', 'run_walk', 'walk'].includes(session.activityType)) ?? null;
}

export function getScheduledStrengthForDate(sessions: ScheduledSession[]): ScheduledSession | null {
  return sessions.find(session => session.activityType === 'strength') ?? null;
}

export function getSessionById(sessions: ScheduledSession[], scheduledSessionId: string): ScheduledSession | null {
  return sessions.find(session => session.scheduledSessionId === scheduledSessionId) ?? null;
}

export function activeScheduledSessionsForDate(
  sessionsForDate: ScheduledSession[],
  allKnownSessions: ScheduledSession[],
  dateYMD: string,
  selectedSessionId?: string,
  removedSessionIds: string[] = [],
): ScheduledSession[] {
  const removed = new Set(removedSessionIds);
  const visibleForActiveUse = sessionsForDate.filter(session => !removed.has(session.scheduledSessionId));
  // "Remove from Today" hides a session from primary/run/strength selection
  // (below, via the 'optional' demotion) but must not make it unreachable —
  // it still appears as a secondary entry so Calendar and the Running/
  // Strength surfaces agree on what's scheduled today.
  const removedButVisible = sessionsForDate
    .filter(session => removed.has(session.scheduledSessionId))
    .map(session => ({ ...session, priority: 'optional' as const }));

  if (!selectedSessionId || removed.has(selectedSessionId)) {
    return [...visibleForActiveUse, ...removedButVisible];
  }

  const selected = allKnownSessions.find(session => session.scheduledSessionId === selectedSessionId)
    ?? visibleForActiveUse.find(session => session.scheduledSessionId === selectedSessionId);
  if (!selected) return [...visibleForActiveUse, ...removedButVisible];

  const selectedForToday: ScheduledSession = {
    ...selected,
    date: dateYMD,
    originalDate: selected.originalDate,
    status: selected.status === 'completed' || selected.status === 'skipped' ? selected.status : 'today',
  };

  return [
    selectedForToday,
    ...visibleForActiveUse.filter(session => session.scheduledSessionId !== selectedSessionId),
    ...removedButVisible,
  ];
}

// Reschedule ("move date"): pulls sessions moved to `dateYMD` in from
// elsewhere in the known set and drops sessions moved away from `dateYMD`.
// `allKnownSessions` bounds the search to whatever the caller already has in
// hand (in practice, the current week) — a session rescheduled outside that
// window won't be found, which is an accepted limitation rather than a
// cross-week reschedule engine.
export function applyDateOverridesForDate(
  sessionsForDate: ScheduledSession[],
  allKnownSessions: ScheduledSession[],
  dateYMD: string,
  dateOverrides: Record<string, string | undefined>,
): ScheduledSession[] {
  if (Object.keys(dateOverrides).length === 0) return sessionsForDate;

  const remaining = sessionsForDate.filter(session => {
    const overrideDate = dateOverrides[session.scheduledSessionId];
    return overrideDate === undefined || overrideDate === dateYMD;
  });

  const alreadyPresent = new Set(remaining.map(session => session.scheduledSessionId));
  const incoming = allKnownSessions
    .filter(session =>
      dateOverrides[session.scheduledSessionId] === dateYMD
      && session.date !== dateYMD
      && !alreadyPresent.has(session.scheduledSessionId))
    .map(session => ({ ...session, date: dateYMD }));

  return [...remaining, ...incoming];
}

export function actionLabelForScheduledSession(session: ScheduledSession | null): string {
  if (!session) return "View Today's Plan";
  if (session.completedActivityId || session.status === 'completed' || session.status === 'partial') return 'View Completed Activity';
  if (session.status === 'in_progress') return 'Resume Workout';
  if (session.activityType === 'strength') return 'Start Strength';
  if (session.activityType === 'run_walk') return 'Start Run/Walk';
  if (session.activityType === 'run') return 'Start Run';
  if (session.activityType === 'mobility') return 'View Mobility';
  return `Start ${displayLabel(session.activityType)}`;
}
