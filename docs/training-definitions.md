# Training Definitions Content Guide (Build 34)

Source of truth for the Training Definitions education layer. The data
implementation lives in `src/constants/trainingDefinitions.ts`; this doc
defines structure, tone, and the canonical term list.

## Structure — every definition answers, in order

1. What is it?
2. Why are you doing it?
3. How do you perform it?
4. How should it feel?
5. Common mistakes
6. Beginner modification (when appropriate)

Tone: a calm coach explaining to a smart beginner. Short sentences.
No jargon without immediate interpretation. Effort anchored to RPE and
conversational cues, not just paces.

Every definition modal ends with:

> "Still unsure? Ask the AI Coach to explain this workout or adjust it
> for your current fitness level."

plus an "Ask AI Coach" button that opens the coach with workout type,
current phase, athlete level, and goal in context.

## Term list

Running: Easy Run, Recovery Run, Long Run, Run/Walk, Strides,
Hill Repeats, Tempo Run, Threshold Run, VO2 Max Workout.

Concepts: RPE, Zone 2, Progressive Overload, Deload Week, Taper Week,
Base Phase, Build Phase, Race Phase.

Strength: Sets, Reps, Load, RPE (strength), Strength Progression,
Power/Plyometrics.

Mobility: Mobility, Dynamic Mobility, Static Stretching, Mobility Primer,
Recovery Mobility, Mobility vs Flexibility, Mobility vs Stability.

## Canonical content notes (bind the copywriting)

### Strides — REQUIRED framing
Strides are NOT sprints. They are short (~20–30 s or ~80–100 m),
controlled accelerations that develop running mechanics, efficiency, and
relaxed speed. Intensity: around current 5K effort — "the fastest pace
you could maintain during a 5K", not an all-out sprint. Finish smooth and
in control; you should feel like you could do another repetition. Full
easy recovery between reps. Common mistakes: sprinting too hard, forcing
speed, losing form, not recovering enough between reps.

### Easy Run
Conversational effort (can speak full sentences), roughly RPE 3–4.
Purpose: aerobic development with low stress. Mistake: running it too
fast — most runners do.

### Zone 2
Low-intensity aerobic zone, conversational. Purpose: builds the aerobic
base that supports everything else. If a user has no HR zones set up,
anchor to talk test + RPE.

### Tempo vs Threshold
Tempo: "comfortably hard", sustained (RPE ~6–7). Threshold: around the
effort you could hold ~50–60 min in a race (RPE ~7–8). Keep the two
distinct and say plainly that many plans blur them.

### Deload / Taper
Deload: planned easier week within training to absorb work. Taper:
progressive reduction before a race to arrive fresh without losing
fitness. They are not the same thing.

### Mobility vs Flexibility / Stability
Flexibility = available passive range. Mobility = usable, controlled
range. Stability = controlling position under load or fatigue. Mobility
work in StrideOS mixes range work WITH control work on purpose.

## Contextual info buttons

Small circle-"i" buttons appear wherever a workout term is shown:
workout cards, workout details, running sessions, strength sessions,
mobility sessions, training calendar entries. Tapping opens the
definition modal for that term. Terms map by workout type key, with a
fallback lookup by display label.
