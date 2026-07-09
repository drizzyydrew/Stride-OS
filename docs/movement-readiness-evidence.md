# Movement Readiness Evidence Standard (Build 34)

This document is the evidence contract for the Running/Walking Readiness
Assessment, the mobility system, and every recommendation the Movement Lab
produces. Code that generates findings or recommendations must be
consistent with this file. `evidenceVersion: 1`.

Product stance, shown to users:

> "StrideOS uses movement findings to guide training decisions, not to
> diagnose injury."

## Evidence hierarchy (priority order)

1. Systematic reviews and meta-analyses
2. Clinical practice guidelines
3. Prospective cohort studies
4. Randomized controlled trials
5. High-quality biomechanical studies
6. Expert consensus — only when stronger evidence is unavailable

Weak correlations, single small studies, and social-media movement rules
do not justify user-facing claims.

## What the app can reasonably infer

- Estimated 2D joint angles from a known camera view, with confidence.
- Range-of-motion screens (e.g. knee-to-wall distance entered by user).
- Capacity counts entered by the user (e.g. single-leg heel raises).
- Movement-quality observations (estimated, camera-view dependent).
- Right/left differences large enough to exceed measurement noise
  (2D phone video noise is real — treat <10–15% side differences as
  within noise for most series).

## What the app must NOT claim

- Diagnosis of any condition.
- That any finding *causes* injury.
- Footstrike pattern, ankle dorsiflexion angle, or exact gait events
  (no foot landmarks in Apple Vision).
- Clinical-grade measurement ("angles are estimates, not clinical
  measurements" disclaimer on every relevant screen).
- Injury *prediction* from screening — screening tests have consistently
  shown poor predictive value for injury in systematic reviews. Findings
  guide training emphasis, nothing more.

## Language rules

Allowed: "may affect", "may contribute to", "worth monitoring",
"consider addressing", "commonly associated with".
Forbidden: "this causes injury", "bad form", "high injury risk",
"you will get injured", "diagnosis", "dysfunction" as a user-facing label.

## Domain research notes

### Ankle dorsiflexion
- Knee-to-wall (weight-bearing lunge) test has good intra- and
  inter-rater reliability (systematic reviews of measurement studies).
  Common reference point: ~9–10 cm wall distance or ~35–40° inclinometer;
  we treat side-to-side asymmetry (> ~2–3 cm) as the more useful signal.
- Restricted dorsiflexion is associated in biomechanical studies with
  altered landing mechanics and greater knee valgus displacement.
  Association with specific injuries is mixed and mostly cross-sectional.
- App claim ceiling: "Limited ankle mobility may affect squat depth and
  landing mechanics; worth addressing with mobility work."

### Hip mobility / hip extension
- Limited hip extension may be compensated by anterior pelvic tilt or
  lumbar extension during late stance; evidence is largely biomechanical
  and cross-sectional.
- Stretching + strengthening programs improve hip extension ROM (RCTs,
  small effects).
- App claim ceiling: "Limited hip extension may affect stride mechanics
  behind the body; consider hip mobility work."

### Single-leg control
- Step-down / single-leg squat quality relates to hip abductor function
  in biomechanical studies. Contralateral pelvic drop has been associated
  with running injury in case-control (retrospective) work — not
  established prospectively, so it is a "worth monitoring" finding only.
- Hip/trunk strength and control programs are low-risk and improve
  movement quality measures (RCTs of variable quality).

### Calf / soleus capacity
- Single-leg heel-raise capacity has published age/sex reference values
  (reliability studies); a practical field test.
- Soleus experiences among the highest muscle forces in running
  (biomechanical modeling); calf strengthening is a cornerstone of
  Achilles tendinopathy management in clinical practice guidelines.
- App claim ceiling: "Lower or asymmetric calf capacity may affect
  tolerance for running volume; consider calf capacity work."

### Trunk / pelvic control
- Trunk lean and pelvic drop are measurable estimates from video; their
  relationship to injury is associative, not causal.
- Gait-retraining evidence (below) is stronger than posture-correction
  evidence. Keep recommendations training-oriented.

### Running / walking gait mechanics
- Cadence increases of ~5–10% reduce measures of joint loading (multiple
  biomechanical studies and reviews) — the best-supported gait
  modification we can suggest.
- Overstriding (foot far ahead of the body at contact) is associated with
  higher braking forces; from 2D video we may describe it only as an
  estimated observation.
- We do not classify footstrike (no foot landmarks) and do not claim any
  footstrike is superior (evidence does not support a universal best).

### Mobility / stretching (for the mobility engine)
- Static stretching improves joint ROM (meta-analyses); chronic
  performance harm is not supported, but long (>60 s per muscle) static
  holds immediately before intense work may transiently reduce force —
  hence "Primer" workouts use dynamic work, static emphasis goes to
  post-run/standalone sessions.
- Foam rolling / dynamic mobility acutely increases ROM without
  performance decrement (meta-analyses).
- Stretching alone has not been shown to reduce overall injury rates
  (systematic reviews); mobility work is framed as ROM, comfort, and
  movement-quality support — never as injury prevention guarantees.
- Strength training through range improves both strength and ROM and has
  the strongest evidence for injury-risk reduction of any exercise
  modality (meta-analyses) — mobility workouts therefore include loaded
  control work (bridges, heel raises, step-downs), not stretching only.

## Recommendation mapping (assessment → mobility)

| Finding | Recommendation | Basis |
|---|---|---|
| Limited ankle dorsiflexion | Ankle Dorsiflexion Routine | Reliability of screen + ROM trainability (RCTs) |
| Limited hip extension | Hip Extension Mobility | ROM trainability (RCTs) |
| Reduced single-leg control | Single-Leg Control Prep | Strength/control RCTs, low risk |
| Low/asymmetric calf capacity | Calf/Soleus Mobility + Capacity | CPG-aligned calf loading |
| Trunk/pelvic control estimate | Hip Control + Mobility | Associative; framed as "worth monitoring" |
| Post-run stiffness (user-reported) | Post-Run Recovery Mobility | ROM/comfort evidence |

Every recommendation card cites its rationale in one plain sentence and
never promises injury prevention.

## Readiness report rules

- Categories: Good / Monitor / Needs attention / Manual review recommended.
- Conservative by construction: missing or low-confidence data always
  degrades toward "Manual review recommended", never toward "Needs
  attention" (we don't alarm on absent data).
- Numeric subscores, if shown, display their inputs ("what moved this
  score") and confidence.
- Right/left comparisons show both values and label the noise floor.
- Pain reported anywhere → "Consult a clinician for pain or injury
  concerns" messaging; the app never interprets pain.
