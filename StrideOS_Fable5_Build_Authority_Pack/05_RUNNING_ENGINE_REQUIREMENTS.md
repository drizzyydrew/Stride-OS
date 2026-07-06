# Running Engine Requirements

The running system is a core StrideOS surface.

It should help the athlete understand the purpose of today's run, execute it cleanly, and learn what the run did for their training.

## Required Run Modes

- Quick Start
- Time Goal
- Distance Goal
- Structured Workout
- Race

## Quick Start

Purpose:

Start running immediately with GPS tracking.

Must support:

- start
- pause
- resume
- finish
- save
- discard only when clearly intentional

## Time Goal

Purpose:

Run until a selected duration is complete.

Must show:

- elapsed time
- remaining time
- distance
- pace
- heart rate if available

## Distance Goal

Purpose:

Run until a selected mileage target is complete.

Must show:

- distance complete
- distance remaining
- pace
- estimated finish

## Structured Workout

Purpose:

Execute planned training.

Supported workout types:

- easy
- tempo
- threshold
- intervals
- long run

Each workout needs:

- purpose
- target intensity
- segments
- expected benefit

## Race Mode

Purpose:

Support race execution.

Must include:

- target pace
- predicted finish
- distance remaining
- fueling reminders
- effort guardrails

## Live Run Screen

Map should be primary.

Metrics should be readable at a glance:

- time
- distance
- current pace
- average pace
- heart rate
- zone
- elevation gain

Controls:

- Pause
- Resume
- Finish

No clutter. No fake metrics. No dead controls.

## Live Activity And Lock Screen

Requirements:

- Big readable numbers.
- Single primary action.
- Running state shows Pause.
- Paused state shows Resume.
- Include time, distance, pace, heart rate, and zone where available.

Keep Live Activity native logic stable unless the task explicitly requires native changes.
