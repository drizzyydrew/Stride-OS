// ─── Training Definitions Content (Build 34, Wave 1B) ─────────────────────────
//
// Source of truth for structure/tone: docs/training-definitions.md. Every
// definition answers, in order: what is it, why do it, how do you perform it,
// how should it feel, common mistakes, and (when appropriate) a beginner
// modification. Tone: a calm coach explaining to a smart beginner.

export type TermCategory = 'running' | 'concept' | 'strength' | 'mobility';

export type TermDefinition = {
  key:                  string;
  label:                string;
  category:             TermCategory;
  whatIsIt:             string;
  whyDoIt:              string;
  howToPerform:         string;
  howItShouldFeel:      string;
  commonMistakes:       string[];
  beginnerModification?: string;
};

export const TRAINING_DEFINITIONS: TermDefinition[] = [
  // ─── Running ─────────────────────────────────────────────────────────────────
  {
    key: 'easy_run',
    label: 'Easy Run',
    category: 'running',
    whatIsIt: 'A run at a comfortable, conversational effort — the bread-and-butter session of any training plan.',
    whyDoIt: 'Easy runs build your aerobic base and add mileage with low physical stress, so you can recover in time for your next quality session.',
    howToPerform: 'Run at a pace where you could hold a full conversation. Aim for roughly RPE 3–4 out of 10 — noticeably easier than it feels like you "should" run.',
    howItShouldFeel: 'Relaxed and sustainable. You should finish feeling like you could have run further.',
    commonMistakes: ['Running easy runs too fast — this is the single most common mistake runners make.', 'Chasing a pace instead of running to effort.', 'Comparing easy-run pace to race pace.'],
    beginnerModification: 'If continuous running feels hard at a conversational pace, mix in short walk breaks (see Run/Walk) until your aerobic base builds up.',
  },
  {
    key: 'recovery_run',
    label: 'Recovery Run',
    category: 'running',
    whatIsIt: 'A very short, very easy run done the day after a hard effort to promote blood flow without adding real stress.',
    whyDoIt: 'Light movement can help you feel loose after a hard session, without the recovery cost of a full rest day making you feel stiff or sluggish.',
    howToPerform: 'Keep it shorter than a typical easy run and run even slower — RPE 2–3. If it starts to feel like work, slow down further or stop.',
    howItShouldFeel: 'Almost effortless. This should feel like active rest, not a workout.',
    commonMistakes: ['Turning it into a normal easy run by running too far or too fast.', 'Skipping it out of guilt when a full rest day would actually serve you better.'],
    beginnerModification: 'It is completely fine to take a full rest day instead of a recovery run, especially early in a training plan.',
  },
  {
    key: 'long_run',
    label: 'Long Run',
    category: 'running',
    whatIsIt: 'The longest run of your week, done at an easy-to-moderate effort.',
    whyDoIt: 'Long runs build the aerobic endurance and mental resilience needed to cover race distance, and they are the single highest-leverage session in most running plans.',
    howToPerform: 'Run at an easy, conversational effort for most of the distance — RPE 3–5. Some plans add a faster finish; follow your plan\'s guidance on that.',
    howItShouldFeel: 'Comfortably hard by the end from duration, not from speed. Your legs should feel worked, not wrecked.',
    commonMistakes: ['Starting too fast and fading badly in the second half.', 'Skipping fueling and hydration on longer efforts.', 'Increasing distance too quickly week over week.'],
    beginnerModification: 'Break the distance up with walk breaks if needed — time on feet matters more than uninterrupted running early on.',
  },
  {
    key: 'run_walk',
    label: 'Run/Walk',
    category: 'running',
    whatIsIt: 'A structured pattern of alternating running and walking intervals within a single session.',
    whyDoIt: 'It lets you build time on feet and aerobic fitness while managing effort and impact — useful for beginners, return-to-running, or long distances.',
    howToPerform: 'Use the exact interval durations shown in today\'s workout prescription, including the warm-up walk, repeated run/walk rounds, and cooldown walk. Keep both segments at an easy effort unless the session says otherwise.',
    howItShouldFeel: 'The running segments should feel easy, and the walking segments should feel like genuine recovery, not just a slower jog.',
    commonMistakes: ['Running the run segments too hard because they feel short.', 'Treating the walk breaks as a failure instead of part of the plan.'],
  },
  {
    key: 'strides',
    label: 'Strides',
    category: 'running',
    whatIsIt: 'Short, controlled accelerations — roughly 20–30 seconds or 80–100 meters — used to develop running mechanics, efficiency, and relaxed speed.',
    whyDoIt: 'Strides are not a fitness-building session by themselves; they sharpen your form and neuromuscular efficiency without the fatigue cost of a hard workout.',
    howToPerform: 'Accelerate smoothly to around your current 5K effort — the fastest pace you could hold for a 5K race, not an all-out sprint. Hold that effort briefly, then ease back down. Take a full easy recovery (walk or easy jog) between reps.',
    howItShouldFeel: 'Fast but controlled and relaxed. You should finish each rep feeling like you could comfortably do another one — never gasping or straining.',
    commonMistakes: ['Sprinting all-out instead of running at 5K effort.', 'Forcing speed with a tense upper body instead of staying relaxed.', 'Losing form as fatigue creeps in.', 'Not taking enough recovery between reps.'],
    beginnerModification: 'Start with fewer reps at a gentler effort (closer to a fast easy run) and build toward full 5K effort over several sessions.',
  },
  {
    key: 'hill_repeats',
    label: 'Hill Repeats',
    category: 'running',
    whatIsIt: 'Repeated hard efforts run uphill, followed by an easy jog or walk back down to recover.',
    whyDoIt: 'Hills build power, running strength, and running economy while keeping impact forces lower than flat-ground sprinting.',
    howToPerform: 'Run uphill at a strong, controlled hard effort (RPE 7–8) for the prescribed time or distance, then walk or jog easily back down before the next rep.',
    howItShouldFeel: 'Hard and breathing heavily by the top of each rep, but with form holding together — not desperate or all-out.',
    commonMistakes: ['Sprinting the first rep and fading badly on the rest.', 'Cutting the downhill recovery short.', 'Leaning too far forward and shortening stride instead of driving with the arms and hips.'],
    beginnerModification: 'Use a gentler hill and fewer reps, or turn it into a hard-effort walk uphill if running uphill repeatedly is too much impact for now.',
  },
  {
    key: 'tempo',
    label: 'Tempo Run',
    category: 'running',
    whatIsIt: 'A sustained effort at "comfortably hard" intensity, usually held continuously for a set duration.',
    whyDoIt: 'Tempo runs train your body to clear metabolic byproducts more efficiently at a faster sustained pace, improving your ability to hold strong paces for longer.',
    howToPerform: 'Settle into a steady effort around RPE 6–7 — hard enough that conversation is difficult but not so hard you can\'t hold it for the full duration.',
    howItShouldFeel: 'Comfortably hard — a real effort you have to focus to maintain, but controlled rather than desperate.',
    commonMistakes: ['Starting too fast and being unable to hold the pace to the finish.', 'Confusing tempo effort with the harder threshold effort — many plans blur the two, but they are distinct intensities.'],
  },
  {
    key: 'threshold',
    label: 'Threshold Run',
    category: 'running',
    whatIsIt: 'A sustained effort right around the pace you could hold for about 50–60 minutes in a race.',
    whyDoIt: 'Threshold work raises the effort level you can sustain before fatigue accumulates rapidly, a key lever for race performance at every distance.',
    howToPerform: 'Hold a strong, sustained effort around RPE 7–8 — harder and less sustainable than tempo — for the prescribed duration or intervals.',
    howItShouldFeel: 'Hard and focused. Talking would be limited to a word or two at a time.',
    commonMistakes: ['Treating threshold and tempo as interchangeable — threshold is a harder, less sustainable effort than tempo.', 'Going out too hard on the first interval.'],
  },
  {
    key: 'vo2',
    label: 'VO2 Max Workout',
    category: 'running',
    whatIsIt: 'Short, hard interval efforts designed to push your aerobic ceiling — the top-end intensity of your training.',
    whyDoIt: 'VO2 max work raises the aerobic capacity that determines your fitness ceiling, translating into faster paces across all distances.',
    howToPerform: 'Run hard intervals (RPE 8–9) for the prescribed time or distance, with easy jog or walk recovery between reps, per your plan\'s structure.',
    howItShouldFeel: 'Very hard — breathing heavily, real focus required to hold form, but each rep should end under control rather than falling apart.',
    commonMistakes: ['Starting reps too fast and fading badly by the end.', 'Cutting recovery short between reps, which turns the session into something else entirely.', 'Skipping the warm-up before high-intensity work.'],
    beginnerModification: 'Use a longer recovery between reps or reduce the number of reps until your aerobic base can support the intensity.',
  },

  // ─── Concepts ────────────────────────────────────────────────────────────────
  {
    key: 'rpe',
    label: 'RPE',
    category: 'concept',
    whatIsIt: 'Rate of Perceived Exertion — a 1–10 scale for how hard an effort feels, independent of pace or heart rate.',
    whyDoIt: 'RPE lets you train to the right intensity even when pace is affected by heat, hills, fatigue, or a device malfunction — effort doesn\'t lie.',
    howToPerform: 'Rate your effort honestly on a 1–10 scale: 1–2 is barely moving, 3–4 is conversational easy, 6–7 is comfortably hard, 8–9 is very hard, 10 is an all-out maximum.',
    howItShouldFeel: 'RPE is a feeling check-in, not a calculation — it should take only a moment to answer "how hard does this feel right now?"',
    commonMistakes: ['Rating effort based on pace instead of how the body actually feels.', 'Underrating hard efforts out of pride, or overrating easy ones out of caution.'],
  },
  {
    key: 'zone2',
    label: 'Zone 2',
    category: 'concept',
    whatIsIt: 'A low-intensity aerobic training zone, roughly equivalent to easy, conversational effort.',
    whyDoIt: 'Zone 2 builds the aerobic base that supports every harder session in your plan — most of your weekly running volume should live here.',
    howToPerform: 'If you have heart rate zones set up, stay within your Zone 2 range. Without zones, anchor to the talk test: you should be able to speak in full sentences.',
    howItShouldFeel: 'Easy and sustainable, similar to an Easy Run — you should never feel like you\'re working hard in Zone 2.',
    commonMistakes: ['Letting Zone 2 efforts creep up into Zone 3 or higher — this is extremely common.', 'Relying only on a number without checking it against the talk test.'],
  },
  {
    key: 'progressive_overload',
    label: 'Progressive Overload',
    category: 'concept',
    whatIsIt: 'The principle of gradually increasing training demand over time so your body has a reason to adapt.',
    whyDoIt: 'Without a gradually rising stimulus, your body has no reason to keep improving — but too much, too fast, raises risk of burnout and setbacks.',
    howToPerform: 'Increase one variable at a time — distance, intensity, or frequency — in small, sustainable steps, typically no more than about 10% of weekly volume at a time.',
    howItShouldFeel: 'Each increase should feel like a manageable stretch, not a shock. If a plan bump feels overwhelming, it\'s reasonable to hold steady another week.',
    commonMistakes: ['Increasing volume and intensity at the same time.', 'Skipping recovery weeks in the pursuit of constant progression.'],
  },
  {
    key: 'acwr',
    label: 'ACWR (Acute:Chronic Workload Ratio)',
    category: 'concept',
    whatIsIt: 'A ratio comparing your recent training load ("acute," the last 7 days in StrideOS) to your longer-term average load ("chronic," a rolling 42 days in StrideOS). It is a training-load trend indicator, not a diagnostic score or injury predictor.',
    whyDoIt: 'Watching how quickly your recent load is rising relative to what your body has been adapting to may be associated with how manageable a training block feels — it can help you decide whether to hold steady or ease off before pushing volume or intensity further.',
    howToPerform: 'Acute workload ÷ chronic workload = ACWR. Around 1.0 means recent training roughly matches your longer-term average. Higher ratios mean load has climbed faster than your base; lower ratios mean recent training has eased off relative to your base. StrideOS surfaces this as a general zone, not a precise cutoff.',
    howItShouldFeel: 'Use ACWR as one input alongside how you actually feel — sleep, soreness, motivation, and RPE all matter. A rising ratio paired with rising fatigue is worth noting; a rising ratio while you feel great is not automatically a problem.',
    commonMistakes: [
      'Treating a specific ACWR number as a hard injury threshold — the research behind it is mixed and the ratio is estimated, not exact.',
      'Reacting to a single day\'s ratio instead of the multi-day trend.',
      'Ignoring how you actually feel because the number looks fine.',
    ],
    beginnerModification: 'If you\'re new to structured training, treat ACWR as a rough guide for pacing volume increases (see Progressive Overload) rather than something to optimize precisely. ACWR does not diagnose or predict injury — it is a workload-trend estimate with real limitations, and manual review of how you feel always takes priority.',
  },
  {
    key: 'deload_week',
    label: 'Deload Week',
    category: 'concept',
    whatIsIt: 'A planned easier week built into training to let your body absorb the work you\'ve been doing.',
    whyDoIt: 'Fitness is built during recovery as much as during hard efforts — a deload lets adaptation catch up with the training stimulus.',
    howToPerform: 'Reduce volume and/or intensity for the week as your plan directs, rather than skipping training altogether.',
    howItShouldFeel: 'Noticeably lighter than a normal week — you should come out of it feeling fresher, not more fatigued.',
    commonMistakes: ['Confusing a deload with a taper — they serve different purposes.', 'Trying to "make up" for an easier week by adding extra sessions.'],
  },
  {
    key: 'taper_week',
    label: 'Taper Week',
    category: 'concept',
    whatIsIt: 'A progressive reduction in training load in the days or weeks before a race, designed to arrive fresh.',
    whyDoIt: 'Tapering lets accumulated fatigue dissipate while preserving the fitness you\'ve built, so you race on your best legs.',
    howToPerform: 'Follow your plan\'s taper structure — usually a steady drop in volume while keeping some intensity to stay sharp.',
    howItShouldFeel: 'You may feel restless or oddly fresh — that\'s normal and expected, not a sign you\'re losing fitness.',
    commonMistakes: ['Panicking about lost fitness and adding extra hard sessions during the taper.', 'Confusing taper with deload — a taper is race-specific and time-limited.'],
  },
  {
    key: 'base_phase',
    label: 'Base Phase',
    category: 'concept',
    whatIsIt: 'The foundational period of a training plan focused on building aerobic capacity and consistent mileage.',
    whyDoIt: 'A solid aerobic base supports every harder session later in the plan — skipping it undermines everything built on top of it.',
    howToPerform: 'Prioritize consistent, mostly easy running with gradually increasing volume; harder efforts stay limited during this phase.',
    howItShouldFeel: 'Steady and sustainable — the base phase should feel like it\'s building a foundation, not testing your limits.',
    commonMistakes: ['Rushing into hard workouts before the base is established.', 'Treating base phase as "junk miles" instead of essential development.'],
  },
  {
    key: 'build_phase',
    label: 'Build Phase',
    category: 'concept',
    whatIsIt: 'The middle period of a training plan where intensity and race-specific work increase on top of your aerobic base.',
    whyDoIt: 'This phase converts your aerobic base into race-specific fitness — the tempo, threshold, and VO2 work that sharpens performance.',
    howToPerform: 'Follow your plan\'s prescribed harder sessions while keeping easy days genuinely easy to absorb the added intensity.',
    howItShouldFeel: 'More demanding than base phase, with noticeable fatigue on hard days that clears with your easy and recovery days.',
    commonMistakes: ['Turning easy days hard during the build phase, which erodes recovery.', 'Adding extra intensity beyond what the plan calls for.'],
  },
  {
    key: 'race_phase',
    label: 'Race Phase',
    category: 'concept',
    whatIsIt: 'The final stretch of training, including peak efforts and the taper, that leads directly into race day.',
    whyDoIt: 'This phase sharpens race-specific fitness and manages fatigue so you arrive at the start line fit and fresh.',
    howToPerform: 'Follow your plan\'s race-specific workouts and taper guidance closely — this is not the time for large changes.',
    howItShouldFeel: 'A mix of sharp, confident sessions and the restlessness of reduced volume as the taper sets in.',
    commonMistakes: ['Trying new gear, fueling, or workouts for the first time during race phase.', 'Adding extra training out of last-minute doubt.'],
  },

  // ─── Strength ─────────────────────────────────────────────────────────────────
  {
    key: 'sets',
    label: 'Sets',
    category: 'strength',
    whatIsIt: 'A group of consecutive repetitions of an exercise, performed without stopping, followed by a rest period.',
    whyDoIt: 'Organizing reps into sets with planned rest lets you accumulate enough total work to drive strength adaptation without early failure ruining form.',
    howToPerform: 'Complete the prescribed number of reps in a row, then rest for the prescribed time before starting the next set.',
    howItShouldFeel: 'Later sets should feel harder than early ones as fatigue builds — that\'s expected and part of the stimulus.',
    commonMistakes: ['Rushing rest periods, which compromises quality on later sets.', 'Stopping a set early out of caution when a couple more controlled reps were available.'],
  },
  {
    key: 'reps',
    label: 'Reps',
    category: 'strength',
    whatIsIt: 'Short for repetitions — one complete cycle of an exercise\'s movement, from start position back to start position.',
    whyDoIt: 'The rep range you train in shapes the adaptation you get — lower reps with heavier load favor strength, higher reps favor endurance and hypertrophy.',
    howToPerform: 'Perform each rep with full, controlled range of motion at the tempo prescribed — resist the urge to rush through them.',
    howItShouldFeel: 'Consistent effort and form from the first rep to the last, even as the final reps in a set feel harder.',
    commonMistakes: ['Cutting range of motion short as fatigue sets in.', 'Speeding up reps to get through a set instead of maintaining tempo.'],
  },
  {
    key: 'load',
    label: 'Load',
    category: 'strength',
    whatIsIt: 'The amount of resistance used for an exercise — bodyweight, a specific weight, or a percentage of your maximum.',
    whyDoIt: 'Load is one of the main levers for progression: gradually increasing load (once reps and form are solid) is how strength adaptations continue.',
    howToPerform: 'Use the load prescribed for your goal and rep range — you should be able to complete all reps with good form and 1–3 reps left in reserve, unless the plan calls for higher effort.',
    howItShouldFeel: 'Challenging by the last couple of reps of a set, but never so heavy that form breaks down.',
    commonMistakes: ['Chasing heavier load before reps and form are consistent.', 'Sticking with the same load indefinitely once it has become easy.'],
  },
  {
    key: 'strength_rpe',
    label: 'RPE (Strength)',
    category: 'strength',
    whatIsIt: 'Rate of Perceived Exertion applied to a strength set — a 1–10 scale for how close to failure the set felt.',
    whyDoIt: 'RPE lets you autoregulate load day to day based on how you actually feel, rather than blindly following a fixed number.',
    howToPerform: 'After a set, rate how many more reps you could have done: RPE 10 means no reps left, RPE 8 means about 2 reps left, RPE 6 means the set felt easy.',
    howItShouldFeel: 'A quick, honest gut-check right after the set, while the effort is still fresh in your body.',
    commonMistakes: ['Rating every set as maximal effort out of habit.', 'Ignoring RPE and always using the same load regardless of how the day feels.'],
  },
  {
    key: 'strength_progression',
    label: 'Strength Progression',
    category: 'strength',
    whatIsIt: 'The planned, gradual increase in training demand for strength work — through reps, load, or both — over time.',
    whyDoIt: 'Muscles and tendons adapt to demands placed on them; without gradually increasing demand, strength gains plateau.',
    howToPerform: 'Once you can complete all prescribed sets and reps with good form and some reps in reserve, add a small amount of load or a rep next session — not both at once.',
    howItShouldFeel: 'Progression should feel earned — a natural next step once the current load feels manageable, not a leap.',
    commonMistakes: ['Increasing load before earning it with clean reps at the current load.', 'Progressing every single session regardless of readiness or fatigue.'],
  },
  {
    key: 'power_plyometrics',
    label: 'Power/Plyometrics',
    category: 'strength',
    whatIsIt: 'Explosive movements — like bounds, hops, and jumps — that train your muscles and tendons to produce force quickly.',
    whyDoIt: 'Power work improves running economy and the springiness of your stride by training the stretch-shortening cycle your legs use with every step.',
    howToPerform: 'Perform each rep with maximum quality and intent, but low total volume — these are about crisp execution, not fatigue.',
    howItShouldFeel: 'Snappy and explosive at the start of a set, with noticeably less pop as fatigue sets in — stop the set when that happens.',
    commonMistakes: ['Doing plyometrics while already fatigued from other training.', 'Chasing volume instead of quality on explosive movements.'],
    beginnerModification: 'Start with lower-impact variations (e.g. pogo hops in place) before progressing to bigger bounds or depth jumps.',
  },

  // ─── Mobility ────────────────────────────────────────────────────────────────
  {
    key: 'mobility',
    label: 'Mobility',
    category: 'mobility',
    whatIsIt: 'Usable, controlled range of motion at a joint — how far you can actively move and control, not just how far you can be passively stretched.',
    whyDoIt: 'Mobility work supports comfortable, efficient movement patterns for running and daily life; it is framed as range-of-motion and movement-quality support, not injury prevention.',
    howToPerform: 'Combine range-of-motion work (dynamic movement, stretching) with control work (loaded exercises through that range) rather than stretching alone.',
    howItShouldFeel: 'Gentle and controlled — mobility work should never produce sharp pain. Ease off and breathe if something feels off.',
    commonMistakes: ['Treating mobility work as a stretch-only routine and skipping the control component.', 'Forcing range with pain instead of working within a comfortable zone.'],
  },
  {
    key: 'dynamic_mobility',
    label: 'Dynamic Mobility',
    category: 'mobility',
    whatIsIt: 'Active, moving mobility work — swinging, rocking, or flowing through a range of motion rather than holding a static position.',
    whyDoIt: 'Dynamic mobility increases range of motion and warms up tissue without the brief force reduction that long static holds can cause right before hard effort.',
    howToPerform: 'Move smoothly and rhythmically through the prescribed range for the given reps or time, without pausing in a held stretch.',
    howItShouldFeel: 'Warm and loosening — like your joints are waking up, not like a deep, held stretch.',
    commonMistakes: ['Moving too fast to control the range.', 'Turning a dynamic movement into a static hold by pausing at end range.'],
  },
  {
    key: 'static_stretching',
    label: 'Static Stretching',
    category: 'mobility',
    whatIsIt: 'Holding a stretched position at one length for a period of time, typically 20–60 seconds.',
    whyDoIt: 'Static stretching reliably improves joint range of motion over time; it is best used after training or in standalone sessions rather than immediately before hard efforts.',
    howToPerform: 'Ease into the stretch until you feel mild tension, hold while breathing steadily for the prescribed time, then release slowly.',
    howItShouldFeel: 'A gentle, steady pull — comfortable enough to hold while breathing normally, never sharp or shaking.',
    commonMistakes: ['Bouncing in and out of the stretch instead of holding steady.', 'Stretching to the point of pain rather than mild tension.', 'Doing long static holds right before a hard running effort.'],
  },
  {
    key: 'mobility_primer',
    label: 'Mobility Primer',
    category: 'mobility',
    whatIsIt: 'A short, dynamic mobility routine done before a run to prepare your joints and muscles for the effort ahead.',
    whyDoIt: 'Dynamic work increases readiness without the transient force reduction long static holds can cause immediately before intense effort.',
    howToPerform: 'Move through the prescribed dynamic exercises at an easy, warming effort — this is preparation, not a workout.',
    howItShouldFeel: 'Progressively warmer and looser as you move through it — not fatiguing.',
    commonMistakes: ['Substituting long static stretches for the dynamic primer right before running.', 'Rushing through it instead of letting it actually warm you up.'],
  },
  {
    key: 'recovery_mobility',
    label: 'Recovery Mobility',
    category: 'mobility',
    whatIsIt: 'A mobility session, often including static stretching, done after training to support comfort and range of motion.',
    whyDoIt: 'Post-training is an ideal time for static stretching\'s ROM benefits, without any of the pre-effort force concerns.',
    howToPerform: 'Move through the prescribed stretches and breathing work at an easy pace once your session is complete.',
    howItShouldFeel: 'Calming and comfortable — a chance to settle down after training, not another hard effort.',
    commonMistakes: ['Skipping it entirely after hard sessions when stiffness is most likely.', 'Rushing through holds instead of actually settling into them.'],
  },
  {
    key: 'mobility_vs_flexibility',
    label: 'Mobility vs Flexibility',
    category: 'mobility',
    whatIsIt: 'Flexibility is your available passive range of motion; mobility is the usable, controlled range you can actively move through and control.',
    whyDoIt: 'Being flexible doesn\'t automatically mean you can control that range under load — mobility work builds the "usable" half of the equation.',
    howToPerform: 'Pair range-of-motion work (stretching) with control work through that same range (loaded exercises) rather than stretching alone.',
    howItShouldFeel: 'Flexibility work feels like a passive stretch; mobility work adds an active, controlled effort on top of that range.',
    commonMistakes: ['Assuming stretching alone is enough to improve how a joint performs under load.', 'Ignoring the strength/control side of mobility entirely.'],
  },
  {
    key: 'mobility_vs_stability',
    label: 'Mobility vs Stability',
    category: 'mobility',
    whatIsIt: 'Mobility is controlled range of motion at a joint; stability is your ability to control position and resist unwanted movement, especially under load or fatigue.',
    whyDoIt: 'Running needs both — enough range to move efficiently, and enough stability to control that range as fatigue sets in late in a run.',
    howToPerform: 'Combine mobility drills with control-focused exercises (like single-leg work) that challenge you to hold position under load.',
    howItShouldFeel: 'Mobility work feels like opening up range; stability work feels like effortful control, sometimes with some wobble to manage.',
    commonMistakes: ['Only training mobility and neglecting the stability side, or vice versa.', 'Rushing stability exercises instead of controlling them slowly.'],
  },

  // ─── Additional workout-type coverage (not in the canonical term list, but
  // needed so every WorkoutType in src/types/training.ts has somewhere to
  // land via the InfoButton) ─────────────────────────────────────────────────
  {
    key: 'strength_training_overview',
    label: 'Strength Training',
    category: 'strength',
    whatIsIt: 'A session built from sets and reps of resistance exercises, targeting the muscles and movement patterns that support running.',
    whyDoIt: 'Strength training through a full range of motion improves both strength and mobility and has the strongest evidence of any training modality for supporting resilient movement.',
    howToPerform: 'Work through the prescribed exercises, sets, and reps at the given load and effort — see Sets, Reps, and Load for how each piece works.',
    howItShouldFeel: 'Progressively fatiguing across a session, with good form maintained throughout — not maximal strain on every set.',
    commonMistakes: ['Skipping strength sessions when running volume is high, even though this is when it matters most.', 'Chasing load over form.'],
  },
  {
    key: 'cross_training',
    label: 'Cross-Training',
    category: 'concept',
    whatIsIt: 'Aerobic training done in a different modality than running — cycling, swimming, the elliptical, and similar.',
    whyDoIt: 'Cross-training maintains aerobic fitness while giving running-specific tissues a lower-impact day, which can be useful around fatigue or minor niggles.',
    howToPerform: 'Match the prescribed effort (usually easy to moderate, RPE-guided) in your chosen modality for the planned duration.',
    howItShouldFeel: 'Similar effort to the run it\'s replacing — easy and sustainable unless your plan specifies otherwise.',
    commonMistakes: ['Going far harder than the running session it replaced would have been.', 'Choosing a high-impact activity that defeats the point of cross-training.'],
  },
  {
    key: 'rest',
    label: 'Rest Day',
    category: 'concept',
    whatIsIt: 'A planned day with no structured training, allowing full recovery.',
    whyDoIt: 'Adaptation happens during recovery, not just during training — rest days are a required part of getting fitter, not time lost.',
    howToPerform: 'Skip structured training entirely. Light everyday movement is fine; there\'s no need to fill the day with activity.',
    howItShouldFeel: 'Restorative — you should feel refreshed heading into your next session, not restless about "missing" training.',
    commonMistakes: ['Feeling guilty and adding an unplanned workout.', 'Treating rest days as an excuse for poor sleep or nutrition — recovery habits still matter.'],
  },
];

// ─── Lookup ────────────────────────────────────────────────────────────────────

// Workout-type keys (src/types/training.ts WorkoutType) that don't have a
// 1:1 term of the same name map to the closest canonical definition here.
const WORKOUT_TYPE_ALIASES: Record<string, string> = {
  easy_run: 'easy_run',
  recovery_run: 'recovery_run',
  run_walk: 'run_walk',
  long_run: 'long_run',
  progression_run: 'tempo',
  tempo: 'tempo',
  threshold: 'threshold',
  marathon_pace: 'tempo',
  vo2: 'vo2',
  hill_repeats: 'hill_repeats',
  fartlek: 'vo2',
  norwegian_4x4: 'vo2',
  intervals: 'vo2',
  strides: 'strides',
  sprint: 'vo2',
  taper_session: 'taper_week',
  deload_session: 'deload_week',
  recovery: 'recovery_run',
  strength: 'strength_training_overview',
  cross_training: 'cross_training',
  mobility: 'mobility',
  rest: 'rest',
};

const definitionsByKey = new Map(TRAINING_DEFINITIONS.map(d => [d.key, d]));
const definitionsByLabel = new Map(TRAINING_DEFINITIONS.map(d => [d.label.toLowerCase(), d]));

// Looks a term up by its definition key, its WorkoutType key (via alias map),
// or a fallback match on display label — whichever the call site has handy.
export function findDefinition(keyOrLabel: string): TermDefinition | undefined {
  if (!keyOrLabel) return undefined;
  const raw = keyOrLabel.trim();

  const direct = definitionsByKey.get(raw);
  if (direct) return direct;

  const aliasKey = WORKOUT_TYPE_ALIASES[raw];
  if (aliasKey) {
    const aliased = definitionsByKey.get(aliasKey);
    if (aliased) return aliased;
  }

  const byLabel = definitionsByLabel.get(raw.toLowerCase());
  if (byLabel) return byLabel;

  // Loose fallback: normalize snake_case to spaced words and try the label map again.
  const spaced = raw.replace(/_/g, ' ').toLowerCase();
  return definitionsByLabel.get(spaced);
}
