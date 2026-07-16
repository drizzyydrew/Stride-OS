# Build 37 Screenshot Visual QA

Date: 2026-07-16  
Evidence: all 18 PNGs in `docs/build37-prototypes/`  
Rendering path: production-token static HTML rendered at 390 x 844 with headless Google Chrome 150  
Native iOS rendering: unavailable in this environment

## Review result

- Clipping: no fixed control, title, metric, input, or bottom-sheet action is clipped in the final prototype frames. The Hydration & Fueling plan intentionally continues below the captured viewport and therefore requires a native scroll check.
- Hidden controls: each flow has one visible primary action. Route detachment is visible in the action sheet; marker mode retains Cancel, Reset, and Save; notification and interval sheets retain Cancel/Confirm.
- Keyboard overlap: the Save Route prototype keeps the focused name field and sticky action row above the sheet bottom. Native keyboard movement still requires device verification.
- Scroll conflicts: prototypes show locked marker and focused wheel/sheet states without competing page controls. Native responder ownership is validated by code/tests and remains a device feel check.
- Gesture conflicts: the marker frame is visually fixed and the intended editable chain is isolated. Timeline gesture behavior is not meaningfully demonstrable in a static frame and remains on the device checklist.
- Unreadable text: primary and supporting text use warm high-contrast tokens; rate units remain legible and distinct (`mg/L` versus `mg/hr`). The initial hip-extension prototype had a wrapped-title collision; line height was corrected and the PNG was regenerated.
- Touch targets: visible icon buttons, sheet actions, primary buttons, toggles, and picker rows are designed around 44-point-or-larger targets. Native Dynamic Type and VoiceOver target verification remains required.
- Destructive-action separation: Remove From Today’s Run is separated, colored as destructive, and followed by Cancel. It is not adjacent to permanent route deletion.
- Fake affordances: every visible prototype affordance maps to an approved production behavior or implementation contract. No Apple Music, 45-degree capture, hidden swipe-only action, or decorative nonfunctional toggle is shown.

## Visual direction

The frames consistently use the StrideOS dark premium system: near-black background, rounded raised cards, restrained sage and cream accents, serif display titles, strong information hierarchy, compact clinical explanation, and minimal decorative chrome.

## Device-only visual risks

- Camera safe areas around Dynamic Island and home indicator.
- Full-body framing when setup guidance and large text are present.
- Keyboard transition and sticky Save behavior on the smallest supported iPhone.
- Wheel behavior with VoiceOver and maximum Dynamic Type.
- Marker drag visibility under a finger and at zoomed accessibility sizes.
- Live Activity and native notification presentation.
