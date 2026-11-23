/** Optional, versioned intent. Missing intent preserves existing goal programming. */
export type GoalProfileId = 'running' | 'get_faster' | 'race_prep' | 'hybrid' | 'aerobic_base' | 'run_farther' | 'general_fitness' | 'get_stronger' | 'build_muscle' | 'power' | 'hiking' | 'downhill_skiing' | 'snowboarding' | 'cross_country_skiing' | 'mountaineering';
export type GoalIntent = { version: 1; priorities: GoalProfileId[]; season?: 'general' | 'off_season' | 'in_season'; eventDate?: string; eventName?: string };
