# StrideOS Engineering Rules

## Core Philosophy

StrideOS is an endurance-performance operating system focused on:
- physiology
- recovery
- fatigue management
- adaptive training
- long-term progression
- biomechanics
- intelligent coaching

The app should feel:
- premium
- minimal
- scientific
- performance-oriented
- modern
- emotionally motivating

NOT:
- gamified clutter
- social-media style
- generic fitness app
- bodybuilding-first

---

# Tech Stack

- React Native
- Expo Router
- TypeScript
- Zustand
- Modular architecture

---

# Architecture Rules

- Keep components modular.
- Avoid giant files.
- Prefer reusable UI components.
- Business logic belongs in utils/, not screens.
- State belongs in Zustand stores.
- Use typed models whenever possible.
- Keep screens clean and readable.
- Avoid duplicated logic.
- Avoid hardcoded repeated styles.

---

# Folder Structure

src/
  components/
  store/
  utils/
  algorithms/
  models/
  constants/
  generators/

app/
  (tabs)/

---

# UI Rules

Design language:
- dark performance aesthetic
- large typography
- soft rounded cards
- high contrast
- premium spacing
- minimal clutter

Preferred colors:
- background: #0B0F14
- cards: #151C24
- primary blue: #2563EB
- muted text: #8B9AAF
- white text: #FFFFFF

---

# Coding Rules

- Use TypeScript everywhere.
- Prefer functional components.
- Avoid unnecessary complexity.
- Avoid premature optimization.
- Keep imports organized.
- Use clear naming.
- Avoid magic numbers unless explained.

---

# Performance Model

The app should eventually support:
- readiness scoring
- fatigue accumulation
- aerobic progression
- VO2 estimation
- threshold progression
- periodization
- deload logic
- HR zones
- race prediction
- adaptive training

---

# Important

Do NOT:
- add backend yet
- add authentication yet
- add subscriptions yet
- add social features yet
- add Garmin sync yet
- rewrite architecture unnecessarily

Focus on:
- local app quality
- athlete engine
- physiology systems
- modular scalability