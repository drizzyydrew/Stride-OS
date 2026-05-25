import type { TrainingPhase } from './training';

export type ActionCategory = 'recovery' | 'training' | 'load_management' | 'race_prep' | 'habit';
export type ActionDueWindow = 'today' | 'this_week' | 'next_week';
export type ActionPriority  = 'high' | 'medium' | 'low';

export type PlannedAction = {
  id:              string;        // 'w{week}_{insightId}_{slug}' — resets on week change
  title:           string;
  reason:          string;
  category:        ActionCategory;
  priority:        ActionPriority;
  dueWindow:       ActionDueWindow;
  sourceInsightId: string;
};

export type ActionPlanInput = {
  currentWeek:     number;
  fatigueScore:    number;
  recoveryScore:   number;
  acwr:            number;
  trainingPhase:   TrainingPhase;
  isRestDay:       boolean;
  checkedIn:       boolean;
  isTodayComplete: boolean;
};
