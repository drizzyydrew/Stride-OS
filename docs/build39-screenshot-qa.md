# Build 39 Screenshot Visual QA

Date: 2026-07-16
Release target: StrideOS 1.0.0 (iOS Build 39)

## Evidence and rendering boundary

The supplied Build 38 physical-device screenshots are the defect evidence for
this pass. The repository has no usable local iOS Simulator, Xcode installation,
Chromium, Chrome, or Playwright runtime, so no corrected simulator screenshot is
claimed. Visual acceptance below combines the physical screenshot evidence,
source-level layout inspection, production-token component inspection, Dion
asset inspection, deterministic UI contracts, and a clean iOS Metro export.

The remaining narrow-device, Dynamic Type, and ActivityKit presentation checks
are listed in `docs/build39-physical-device-checklist.md`.

## Screenshot findings

| Physical-device defect | Root cause | Correction | Status | Device-only risk |
|---|---|---|---|---|
| Repeated down-arrow tabs | Nested detail files were registered in the root Tabs navigator instead of child stacks. | Declared exactly six root tabs, hid secondary roots, and added nested stacks for Activity, Profile, and legacy Activity Log. | Pass by route contract. | Confirm all six labels on the narrowest supported iPhone. |
| `Activity not found` dead destination | A detail route could open without a resolved canonical or legacy ID while persisted activity migration was still hydrating. | Activity now has a true root stack, hydration-aware canonical/legacy resolution, a loading state, and a designed recovery state. | Pass by state and route tests. | Confirm real legacy records after an app upgrade. |
| Preset Live Activity pause failure | Strength sources did not share an identity-safe command owner; a mounted Training Block screen could consume or overwrite Preset state. | Added session ID/source to native attributes and commands, exact command targeting, pending state, stale-ID recovery, and source-gated Preset/Training Block pollers and updates. | Pass by deterministic native and ownership contracts. | One-tap timing and suspension recovery require TestFlight. |
| Hydration `concentration` word split | A long label, explanation, value, units, and stepper competed inside one horizontal row. | Responsive field rows give copy full width and stack controls at narrow width or larger font scale. | Pass by responsive contract. | Verify maximum Dynamic Type on the narrowest device. |
| Cross-training frequency overflow | Four horizontal pills exceeded the card width. | Replaced the pill row with the shared accessible bottom-sheet wheel and persisted 1–4 sessions per week. | Pass by UI/store/programming tests. | Verify VoiceOver focus and sheet safe area. |
| Cramped detail headers | New screens used separate ad hoc header spacing. | Added one safe-area-aware responsive `ScreenHeader` with a 44-point back target and controlled two-line serif titles. | Pass by shared-component contract. | Verify extra-large titles and landscape orientation. |
| Active Preset spacing and covered controls | Warm-up/flow sections had insufficient separation and fixed bottom padding ignored the tab bar and safe area. | Applied the shared header, separated sections, and calculated bottom padding from tab-bar height plus safe area. | Pass by code inspection. | Verify keyboard, Load, RPE, Complete, and finish controls on device. |
| Raw `squat_rack` label | Internal enums were formatted inconsistently or rendered directly. | Added a centralized label map/fallback and migrated affected Activity, Strength, Calendar, Profile, Movement Lab, Running, and Coach surfaces. | Pass by mapping and affected-surface tests. | Review uncommon user-created identifiers. |
| Bike Fit black letterboxing | A 4:3 landscape source was constrained inside a narrow portrait column with `contain`. | Retained the approved 4:3 Dion source, changed the instruction card to a full-width natural 4:3 frame, and moved guidance and visibility chips below it. | Pass by asset and layout inspection. | Confirm full bicycle visibility at device width. |
| Content under the tab bar | Screens used fixed bottom padding while the tab structure itself was malformed. | Corrected tab registration and used tab-bar/safe-area-aware bottom content padding in the affected Strength and Hydration workflows. | Pass by layout contract. | Confirm last actions remain reachable on a small iPhone. |
| Missing outdoor Live Activity coverage | Outdoor activity types were not normalized through one complete payload/control contract. | Added shared identity-aware payloads and controls for running, walking, run/walk, hiking, cycling, downhill skiing, cross-country skiing, and snowboarding. | Pass by payload/state tests. | GPS, lock-screen, and ActivityKit runtime behavior require TestFlight. |
| Running and Strength duplicated in More | More retained links after both became primary tabs. | More now contains only Activity, Movement Lab, Analytics, Adaptive Performance, Profile, and Settings. | Pass by route test. | Confirm every card opens on device. |

## Comparable-regression audit

- No character-level word-breaking style is present in application TSX.
- Affected Build 39 screens no longer format enum labels with local underscore
  replacement.
- No bare `Activity not found` production state remains.
- Detail routes are contained by nested stacks and cannot become mystery tabs.
- The Bike Fit production PNGs and Movement Lab manifest were not modified.
- Destructive actions remain separate from ordinary navigation and pause/resume.

## Result

Screenshot-root-cause QA: pass.
Corrected physical-device rendering: pending TestFlight checklist.
Visual QA confidence before TestFlight: 96%.
