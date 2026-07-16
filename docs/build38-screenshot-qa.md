# Build 38 Screenshot Visual QA

Date: 2026-07-16

Evidence reviewed:

- 22 static high-fidelity Build 38 prototype PNGs rendered from production
  tokens.
- Both full-resolution Dion Bike Fit instruction images.
- Existing Build 37 prototype and QA evidence.

Result:

- Hierarchy, contrast, selected states, destructive separation, applicable
  metrics, Live Activity priorities, acknowledgment language, and primary
  actions are coherent.
- No prototype intentionally uses a 45-degree Movement Lab view, hidden
  destructive gesture, duplicate pace/speed display, or diagnosis/injury-risk
  claim.
- Live Activity strength content keeps exercise, set, reps, and load readable.
- Bike Fit images preserve direct-lateral framing, full rider/bicycle visibility,
  canonical wardrobe/identity, and distinct top/bottom pedal phases.

Rendering limitation:

- macOS Quick Look adds right-side canvas padding to the 390-point HTML phone
  frame. The phone content itself was inspected; these are not simulator
  screenshots.

Device-only checks:

- Keyboard avoidance, safe-area behavior, Dynamic Type, VoiceOver focus,
  gesture arbitration, native map controls, Dynamic Island sizing, StandBy,
  camera preview, and screen-lock behavior require TestFlight validation.
- No fake or intentionally nonfunctional production affordance was accepted;
  routes, activity starts, manual logging, plan selection, and Bike Fit actions
  are wired to production screens.
