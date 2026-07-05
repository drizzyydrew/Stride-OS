export type ReadinessInputs = {
  sleepQuality:        number; // 1-5, higher = better sleep
  energy:              number; // 1-5, higher = more energy
  stress:              number; // 1-5, higher = more stressed
  soreness:            number; // 1-5, higher = more sore
  motivation:          number; // 1-5, higher = more motivated
  trainingWillingness: number; // 1-5, higher = more willing to train
};

export type DailyReadiness = ReadinessInputs & {
  date:  string; // "YYYY-MM-DD" — matches todayDateKey() from types/checkin
  score: number; // 0-100, derived from inputs via calculateReadinessScore
};
