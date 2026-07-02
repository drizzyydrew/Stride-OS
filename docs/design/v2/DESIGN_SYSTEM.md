# StrideOS V2 Design System

**Status:** Official · **Version:** 2.0 · **Owner:** Product Design · **Applies to:** iOS, watchOS, and Live Activity surfaces

This document is the single source of truth for how StrideOS looks, feels, and behaves. It codifies the visual language established in the V2 mockups (AI Coach, Dashboard/Training, Run Tracking, Live Activity Widget). Every screen shipped from this point forward must be built from these tokens and components — not reinterpreted from screenshots.

If a screen you're building isn't covered here, extend the system using its existing tokens. Do not invent new colors, type sizes, radii, or components ad hoc.

---

## 1. Brand Philosophy

StrideOS exists to make serious training feel calm instead of chaotic. Endurance athletes are already surrounded by noise — conflicting data, alerts, red/green traffic-light dashboards that manufacture anxiety about numbers that don't matter. StrideOS is the opposite of that: an instrument panel designed by someone who trusts you to be capable, and respects you enough not to shout.

**The feeling we are designing for:** the quiet competence of a well-made analog watch, the reassurance of a coach who has seen a thousand athletes and isn't worried about you, and the material warmth of natural fibers and skin tones rather than the cold blue glow of "tech."

Three reference points guide every decision:

- **Apple, not a fitness startup.** Restraint over decoration. Whitespace over density. One idea per screen.
- **A coach, not a scoreboard.** Data is always paired with meaning ("Your readiness is good and training load is in a productive range") — never a bare number dropped on the athlete to interpret alone.
- **Earth and stone, not neon.** Sage, clay, steel, brown, and sand are drawn from trail, rock, and skin tones — the palette of the outdoors StrideOS trains you for, not the palette of a dashboard.

StrideOS should never feel playful (no mascots, no confetti, no bouncy easing), never feel clinical (no sterile whites-and-blues medical-app energy), and never feel cluttered (no more than one primary action or one primary metric fighting for attention on screen at a time).

---

## 2. Design Principles

1. **Calm hierarchy, not competing signals.** Every screen has exactly one hero element (a ring, a big number, a map). Supporting data is visually quieter — smaller, muted, secondary color — so the eye always knows where to land first. See Dashboard: the Readiness ring dominates; Acute Load and This Week recede into equal-weight cards below it.

2. **Earned color.** The palette is neutral by default (sand/white/steel/brown). Clay — the one warm accent — is spent deliberately: primary actions, the athlete's own selection (today's date, the active tab), and in-progress states. Because clay is used sparingly, it always means "this is the thing to notice or tap."

3. **Color carries meaning, never decoration.** Red = destructive only. Green = success only. Yellow/orange = warning only. This is a strict contract: an athlete should never have to wonder "is this red because something is wrong, or because someone liked how it looked." Reserving color this way is also what makes the calm neutral palette possible everywhere else.

4. **Data is always interpreted, never dumped.** Every metric ships with a plain-language read: "82 · High · Great to go," "Balanced · 780 · Optimal training load." The number is the evidence; the sentence is the verdict. Never present a number without its meaning alongside it.

5. **One primary action per screen.** Run states (Pause/Resume/Finish), the AI Coach composer, "Choose Video" — each screen has a single unmistakable next step, styled in the pill primary button. Everything else is secondary or tertiary.

6. **Consistent anatomy for list rows.** Every navigable row in the app — training sessions, settings, coach prompts, strength categories — follows the same anatomy: leading icon in a rounded container, title + subtitle stack, trailing chevron. An athlete who learns one screen has learned them all.

7. **Light and dark are equally first-class.** Dark mode is not an inverted afterthought — it uses true near-black surfaces (not dark gray) with the same sand/clay/sage accents at slightly higher value for legibility. Every component is specified for both.

8. **Maps and photography are muted, never saturated.** Route maps use a custom desaturated basemap so the sage route line is the only saturated element in view. This keeps the run-tracking screen calm even mid-effort.

9. **Numbers are legible before they are stylish.** All metric and timer numerals use tabular (fixed-width) figures at large, high-contrast sizes, because they are read at a glance, often mid-run or mid-lift — never squint-tested typography.

---

## 3. Color System

### 3.1 Core Palette

| Name | Hex | Role |
|---|---|---|
| Sage | `#8B927C` | Primary brand color — progress, active states, running |
| Clay | `#DCC0A7` | Secondary accent — primary CTAs, selection, warmth |
| Steel | `#708489` | Structural neutral — strength/analytics accents, secondary icons |
| Brown | `#4D433E` | Deepest neutral — primary text (light mode), dark-mode surfaces |
| Sand | `#EFE7DA` | Light-mode background |
| White | `#FFFFFF` | Light-mode surfaces / cards |

These six colors are the **entire** brand palette. No other hue is ever introduced for decorative purposes. Every color below is derived from this set via tint/shade, not by picking a new hue.

### 3.2 Primary & Secondary

- **Primary (Sage `#8B927C`)** — represents the app's core identity: training, progress, "in motion." Used for the Running state, primary progress-ring fills, chart bars, map route lines, and the active/selected state of icons in bottom navigation.
- **Secondary (Clay `#DCC0A7`)** — the warm accent reserved for calls-to-action and things the athlete should tap: primary buttons ("Choose Video," "Pause," the send button), the active pill in segmented controls, today's date indicator, and floating add (+) buttons.

Sage and Clay are never used interchangeably — Sage narrates *state* (you are running, this is progress), Clay narrates *action* (tap this, this is selected).

### 3.3 Background, Surface, Card

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `bg.base` | Sand `#EFE7DA` | Near-black `#161513` | App background behind all content |
| `surface.raised` | White `#FFFFFF` | Elevated Brown `#211E1B` | Cards, sheets, modals |
| `surface.sunken` | Sand-100 `#E4DACB` | Recessed `#100F0E` | Input fields, inset list wells |
| `surface.overlay` | White @ 95% | Brown `#4D433E` @ 95% | Bottom sheets, dashed upload panel fill |

Rationale: Light mode never uses pure white as the page background — Sand is the canvas, and White cards sit a visible half-step above it. This is what gives the light mode its "warm paper" feeling instead of a stark white app. Dark mode mirrors this exactly in reverse: true near-black is the canvas, and a lifted brown-black is the card surface — elevation is communicated by lightness, matching how Apple's dark mode avoids drop shadows in favor of tonal steps.

### 3.4 Borders & Dividers

| Token | Light Mode | Dark Mode |
|---|---|---|
| `border.subtle` | Brown @ 8% | White @ 10% |
| `border.default` | Brown @ 14% | White @ 16% |
| `border.dashed` (upload panels) | Clay @ 60% | Clay @ 50% |

Borders are always low-opacity neutrals, never a saturated color — they separate, they don't decorate. The one exception is the dashed upload-video panel border, which uses Clay to signal "this whole region is actionable."

### 3.5 Text Hierarchy

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `text.primary` | Brown `#4D433E` | White `#FFFFFF` | Titles, metric values, primary labels |
| `text.secondary` | Brown @ 65% | White @ 70% | Subtitles, supporting copy |
| `text.tertiary` | Brown @ 40% | White @ 45% | Captions, timestamps, unit labels (e.g. "mi," "bpm") |
| `text.on-accent` | Brown `#4D433E` | Brown `#4D433E` | Text/icons on top of Clay or Sage fills (buttons, badges) |
| `text.disabled` | Brown @ 25% | White @ 25% | Disabled labels |

Note text-on-accent is always the dark Brown, in both modes — Clay and Sage are light-to-mid value fills, so dark text sits on top for contrast in both light and dark mode (see the "PAUSE" button, which uses dark text-on-clay identically whether the surrounding screen is light or dark).

### 3.6 Buttons

| State | Fill | Label Color |
|---|---|---|
| Primary / default | Clay `#DCC0A7` | Brown `#4D433E` |
| Primary / running state | Sage `#8B927C` | Brown `#4D433E` |
| Secondary (outline) | Transparent, 1.5px Brown/White border | Brown / White |
| Tertiary (text only) | Transparent | Sage or Brown/White |
| Destructive | Red `#C1483B` | White |
| Disabled | Brown/White @ 12% | Brown/White @ 30% |

### 3.7 Alerts

Alert color is **strictly semantic** — never used for emphasis or branding:

- **Success — Green `#5F8A5C`.** Completed workout, goal hit, sync successful. Never used for a "resume" or "in-progress" state — those are Sage or Clay.
- **Warning — Amber `#C98A3E`.** Low battery, missed hydration reminder, readiness caution. Warning is informational, not blocking.
- **Destructive — Red `#C1483B`.** Delete, Stop (permanently ending, not pausing), Reset, Remove, Discard, and their confirmation dialogs only. A "Pause" or "Finish run" action is never red — Finish is an outlined neutral button because ending a run is a normal, positive action, not a destructive one.

This is a hard rule: if a designer or engineer reaches for red/green/amber outside these three cases, that is a bug to fix, not a style choice.

### 3.8 Disabled

Disabled controls drop to 12% fill / 25–30% label opacity of their base neutral (Brown in light mode, White in dark mode) and lose all accent color — a disabled primary button is never a washed-out Clay, it is neutral gray-brown. This keeps "is this tappable" unambiguous at a glance.

### 3.9 Charts

- Bars/series: Sage `#8B927C` for the primary series (e.g. weekly mileage bars), at full opacity for the current/today value and 40% opacity for past values, per the Analytics and Dashboard weekly bar charts.
- Axis labels and gridlines: `text.tertiary`, never a separate chart-specific gray.
- Comparative deltas ("+12% vs last week"): Sage for positive/expected trend, Amber only if the trend itself is a caution (e.g. load spiking too fast) — never automatically green/red for up/down, because in training more isn't always better.

### 3.10 Maps

Map surfaces use a **custom, desaturated basemap** so the route is the only saturated element on screen:

- Light mode basemap: warm off-white/sand terrain with pale sage green parks and light gray roads.
- Dark mode basemap: near-black charcoal terrain with muted slate roads.
- Route line: Sage (dark mode) / deep olive-brown (light mode), 4–5px, rounded caps and joins.
- Start marker: white-filled dot with a colored ring matching the route line.
- Current-position marker: same treatment, persistent pulse reserved for live tracking only (see Motion).

Never use a default/Apple-blue map style or a bright saturated route color — the muted basemap is what keeps the run screen restful even at high heart rate.

### 3.11 Progress Rings

- Track: Brown/White @ 10% (light/dark).
- Fill: Sage for readiness/training-load rings in a positive-to-neutral range; Amber for a caution range; never red (a ring never represents a destructive state).
- Center value: largest `text.primary` numeral on screen inside the ring, with a one-word qualifier beneath (e.g. "High," "Balanced") — the ring is never shown as a bare number.

### 3.12 Metric Colors

Metric values (pace, heart rate, elevation, distance) are typographically prominent but **color-neutral** (`text.primary`) by default — color is not used to encode metric *type*. The one exception is the live-tracking Distance figure, which is rendered in Sage to mark it as the "hero" metric of an active run (paired with the large Time figure in neutral primary text). Heart rate, pace, and elevation stay neutral so the eye isn't pulled to secondary numbers.

---

## 4. Typography

**Typeface:** SF Pro (San Francisco), the system font, across iOS, watchOS, and Live Activity — reinforcing the "Apple-grade instrument" feel and guaranteeing perfect Dynamic Type support. Fallback stack: `-apple-system, "SF Pro Display", "SF Pro Text", Inter, sans-serif`.

Numerals are set with **tabular (monospaced) figures** everywhere a value updates live (timers, pace, distance, heart rate) so digits never shift width and cause layout jitter mid-run.

| Style | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| Display | 40–48px | Bold (700) | 1.05 | -0.02em | Live Activity Time/Distance, in-run Time, watch face time |
| H1 | 24–28px | Bold (700) | 1.15 | -0.01em | Screen titles (Dashboard, Training, AI Coach) |
| H2 | 18–20px | Semibold (600) | 1.2 | -0.005em | Card titles ("Today's Plan," "Aerobic Base Build") |
| H3 | 15–16px | Semibold (600) | 1.25 | 0 | List row primary labels, section card headers |
| Body | 14–15px | Regular (400) | 1.4 | 0 | Subtitles, descriptions, chat message text |
| Caption | 11–12px | Medium (500) | 1.3 | +0.04em, uppercase | Metric unit labels ("TIME," "AVG PACE"), section eyebrows ("TODAY," "STATES") |
| Metric Numbers | 28–36px | Bold (700), tabular | 1.0 | -0.01em | Readiness score, Acute Load number, ring center values |
| Button Labels | 15–16px | Semibold (600) | 1.0 | 0 (sentence case) / +0.03em (all-caps watch/widget) | In-app buttons sentence case ("Choose Video"); Live Activity/watch buttons uppercase ("PAUSE," "RESUME") |
| Tab Labels | 13–14px | Medium (500) | 1.0 | 0 | Segmented controls (Chat/Insights, Run/Strength/Mobility) |

**Why uppercase captions and eyebrows:** small all-caps labels with wide tracking read as *structure* (a section label, a unit) rather than *content*, letting the eye separate scaffolding from data at a glance — critical on data-dense screens like Analytics and Run Settings.

**Why sentence-case in-app buttons but uppercase watch/widget buttons:** the phone app is read at arm's length in a relaxed context (sentence case feels conversational, coach-like); the Live Activity and watch face are read in a glance mid-motion, where uppercase's larger perceived weight and letterform distinctness aid instant recognition.

---

## 5. Spacing

StrideOS uses a strict **8-point base grid**. Every margin, padding, and gap is a multiple of 4, with 8 as the default step — never an arbitrary value like 10 or 15.

| Token | Value | Usage |
|---|---|---|
| `space.2xs` | 4px | Icon-to-label micro gaps, badge internal padding |
| `space.xs` | 8px | Gap between stacked caption + value, chip internal padding |
| `space.sm` | 12px | Gap between icon and text in list rows; gap between adjacent metric columns |
| `space.md` | 16px | Standard card padding; gap between list rows |
| `space.lg` | 20px | Section-internal padding on larger cards (Live Activity widget) |
| `space.xl` | 24px | Gap between major sections on a screen (e.g. Readiness card → Today's Plan) |
| `space.2xl` | 32px | Top padding below nav bar; gap between screen title and first card |
| `space.3xl` | 48px | Gap between distinct screen regions (e.g. above the bottom feature-highlight band) |

Rule of thumb: 8px within a component, 16px between components in the same card, 24px+ between cards/sections.

---

## 6. Corner Radius

| Token | Value | Usage |
|---|---|---|
| `radius.sm` | 8px | Chips/badges (zone badge "Z2," metric badges) |
| `radius.md` | 12px | Icon containers in list rows, small icon tiles |
| `radius.lg` | 16px | Standard cards (list rows, settings rows, strength categories) |
| `radius.xl` | 20px | Feature cards (Today's Plan, Readiness, Live Activity widget, dashed upload panel) |
| `radius.2xl` | 24px | Bottom sheet stat card over the map (top corners only) |
| `radius.full` | 999px (pill) | All primary/secondary buttons, segmented controls, tab pills, input fields, progress-ring track, avatar circles |

Rationale: the radius scale has exactly two registers — **soft rectangles** (8–24px, for containers that hold content) and **full pills/circles** (for anything tappable that represents a single action or selection: buttons, tabs, chips, avatars). An engineer should never need a radius outside this list; if a new component seems to need one, it should map to the nearest existing token.

---

## 7. Shadows

Shadows are used sparingly and only to lift genuinely floating elements above their background — not decoratively on every card, because most elevation is communicated through surface color (see §3.3 and §8).

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `shadow.none` | none | none | Standard list rows, in-flow cards (elevation via color only) |
| `shadow.sm` | `0 1px 2px rgba(77,67,62,0.06)` | `0 1px 2px rgba(0,0,0,0.4)` | Slightly raised cards (Today's Plan, Readiness) |
| `shadow.md` | `0 4px 12px rgba(77,67,62,0.10)` | `0 4px 16px rgba(0,0,0,0.5)` | Floating action button (+), sticky bottom sheet stat card |
| `shadow.lg` | `0 12px 32px rgba(77,67,62,0.14)` | `0 12px 32px rgba(0,0,0,0.6)` | Modals, the Live Activity widget itself, in-run map stat sheet |

Dark mode shadows are deliberately darker/higher-opacity black rather than a scaled-down version of the light shadow, because on a near-black background a light-mode-style soft shadow is invisible — dark mode elevation relies primarily on the surface lightness step, with shadow only reinforcing depth at the edge.

---

## 8. Elevation

Card hierarchy, lowest to highest:

1. **Level 0 — Base.** The screen background (Sand/near-black). Nothing sits here directly except section eyebrow labels.
2. **Level 1 — In-flow card.** Standard list rows, settings rows, training-day rows. Surface color only, no shadow, separated by `space.xs`–`space.sm` gaps and/or a hairline divider.
3. **Level 2 — Feature card.** Today's Plan, Readiness, Acute Load, Today's Focus. `shadow.sm`, `radius.xl`, holds a single hero metric or message.
4. **Level 3 — Floating control.** The (+) add button, the bottom sheet stat card during a run, the Pause/Finish button pair. `shadow.md`, always pinned to a fixed position (bottom-right or bottom-of-map) rather than flowing in the list.
5. **Level 4 — Overlay.** Modals, the Live Activity widget as a system surface, action sheets. `shadow.lg`, appears above all in-app content including Level 3.

Never skip a level for a component that doesn't need it — e.g. a plain list row should never carry `shadow.md`, or the hierarchy collapses and nothing reads as more important than anything else.

---

## 9. Iconography

- **Style:** Outlined (stroke-only) line icons throughout — SF Symbols as the default source, matching weight/style across the system. Filled icons are reserved for a single selected/active state (e.g. the active bottom-nav icon may fill or bolden slightly) and for status dots.
- **Stroke width:** 1.5px at small sizes (16–20px icons), 1.75px at large sizes (28px+), so stroke weight stays visually consistent as size scales — thin strokes at large sizes read as flimsy, thick strokes at small sizes clog up.
- **Sizes:**
  - 16px — inline with caption text (metric unit icons, e.g. heart/mountain glyphs next to "bpm"/"ft")
  - 20px — list row leading icons, bottom-nav icons, chevrons
  - 24px — card header icons, top-bar action icons (settings gear, map layers)
  - 32px — feature-card icon badges (Today's Focus, AI Coach category icons)
  - 56–64px — empty-state / hero icons (Upload Video circle icon)
- **Color:** Icons follow the same neutral-by-default rule as text — `text.secondary` for utility icons, `text.primary` for active/selected, Sage/Clay only when the icon itself communicates state (running-shoe icon on an active session, a colored zone badge).
- **Containers:** Icons that sit inside a rounded tile (list rows, feature cards) use a tonal background — a low-opacity tint of the icon's own semantic color (e.g. a Sage icon on a Sage-10% tile) rather than a flat gray box, so the icon tile itself hints at category (running = Sage tile, strength = Steel tile, nutrition = Clay tile).

---

## 10. Motion

Motion in StrideOS is **quiet and purposeful** — it clarifies state changes; it never performs for its own sake.

- **Timing scale:**
  - Micro (icon tap, toggle flip, chip select): 120–150ms, ease-out
  - Standard (card expand, tab switch, sheet reveal): 200–250ms, ease-in-out
  - Screen transition (push/pop, modal present): 300–350ms, spring
- **Spring behavior:** Standard iOS spring curve (`response: 0.35, dampingFraction: 0.86`) for sheet presentations and the Pause↔Resume button morph — enough softness to feel organic, damped enough that nothing overshoots or bounces visibly. No bouncy/elastic easing anywhere; overshoot reads as playful, which StrideOS explicitly is not.
- **Persistent/live elements:** the current-position marker on the run map uses a slow (1.6s) breathing opacity pulse, not a bounce — signals "live" without distraction. The Live Activity widget's numbers tick in place (no slide/roll digit animation) to avoid visual noise during a run.
- **Segmented control / tab switch:** the active pill slides to its new position (200ms ease-in-out) rather than cross-fading, so the eye tracks continuity of selection.
- **Chart bars / progress rings:** animate in once on first appearance (fill from 0, 400ms ease-out), then update in place without re-animating from zero on every data refresh.
- **Never:** parallax scroll effects, spring overshoot/bounce, confetti or celebratory particle effects, screen shake, or auto-playing looped decorative animation.

---

## 11. Haptics

Haptics confirm physical actions the athlete takes mid-motion (often without looking at the screen), and must map to iOS standard haptic types:

| Interaction | Haptic |
|---|---|
| Start run / Quick Start tapped | Medium impact |
| Pause run | Light impact |
| Resume run | Light impact |
| Finish run (confirmed) | Success notification |
| Discard / Delete confirmed (destructive) | Warning notification, then success on completion |
| Rep/interval/mile auto-lap milestone | Selection tick |
| Readiness or Acute Load crosses into caution range | Warning notification (once, not repeated) |
| Toggle switch flipped (Settings) | Light impact |
| Segmented control tab change | Selection tick |
| Chat message sent | Light impact |
| AI Coach response received | Selection tick |
| Video analysis complete | Success notification |
| Low battery warning surfaced | Warning notification |
| Drag-to-reorder / long-press action sheet opened | Medium impact |

Haptics are never used for passive/informational UI (scrolling, opening a card, viewing a chart) — only for a deliberate action or a state crossing a meaningful threshold.

---

## 12. Accessibility

- **Dynamic Type:** All text styles in §4 must scale with the user's system text-size setting up to at least *Accessibility Large* (AX3). Metric Numbers and Display styles are permitted to clip growth at AX1 (large but not accessibility-large) with a documented max, since these serve as glanceable hero numerals in a fixed layout (e.g. Live Activity), but all Body/Caption/H1–H3 text must reflow, never truncate silently.
- **VoiceOver:** Every icon-only control (chevrons, top-bar settings gear, layer toggle, bottom-nav icons) carries an explicit accessibility label describing its action, not its glyph (e.g. "Open settings," not "gear icon"). Metric tiles are read as a single combined element ("Readiness, 82, High, great to go") rather than three separate fragments, matching how the visual hierarchy groups value + qualifier + sentence.
- **Contrast:** All text/background pairs meet WCAG AA (4.5:1 for body text, 3:1 for large/Display text) in both light and dark mode. This is why `text.primary` is a near-black Brown rather than a mid-tone — every neutral in §3.3–3.5 has been checked against both Sand and near-black backgrounds.
- **Touch targets:** Minimum 44×44pt hit area on every tappable element, even when the visible glyph is smaller (e.g. a 20px chevron still gets a 44pt tap zone). Bottom-nav items, segmented-control pills, and list rows all meet this by construction (list rows are ≥56pt tall).
- **Reduced Motion:** When "Reduce Motion" is enabled, spring/slide transitions in §10 are replaced with a straight 150ms cross-fade; the live-position breathing pulse and any auto-playing motion is disabled entirely (marker becomes static).

---

## 13. Component Library

### Buttons
- **Primary (filled):** `radius.full`, Clay fill / Brown label by default, Sage fill during an active running state (Pause), 48–56pt height, `space.md` horizontal padding ×1.5. Icon + label combinations center both with `space.xs` gap.
- **Secondary (outline):** `radius.full`, transparent fill, 1.5px border in `text.primary`, same label color. Used for the non-primary option in a pair (e.g. "Finish" next to "Pause").
- **Tertiary (text):** No fill or border, Sage or `text.secondary` label, used for lower-emphasis actions ("Record Video," "View all").
- **Floating Action (+):** Circular, `radius.full`, Clay fill, `shadow.md`, 48pt diameter, always bottom-anchored within its list context (adding a session/exercise).
- **Destructive:** Same shape as Primary, Red `#C1483B` fill, White label — reserved exclusively for Delete/Stop/Reset/Remove/Discard.

### Cards
- Base: `surface.raised`, `radius.lg`–`radius.xl` depending on elevation level (§8), `space.md` internal padding.
- **Feature card** (Today's Plan, Readiness, Today's Focus): icon badge or ring top-left/leading, title (H2/H3), supporting sentence (Body/Caption), optional chevron or trailing icon-button.

### Metric Tiles
- Value in Metric Numbers style, unit as a smaller inline suffix (e.g. "0.35" + "mi"), Caption-style label beneath in uppercase. Tiles are laid out in a 2–3 column grid with `space.sm` gaps, never wrapped in an individual bordered box — separation comes from spacing and the caption label alone, keeping a stat row visually light.

### Progress Rings
- Circular, track per §3.11, stroke width proportional to ring diameter (~10% of diameter), rounded line caps, value + qualifier centered inside. Used for Readiness and Acute Load; never for a linear/non-cyclical metric.

### Segment Controls
- Full-width or intrinsic-width pill container in `surface.sunken`, `radius.full`, individual segments also pill-shaped once active (Clay fill, Brown label), inactive segments transparent with `text.secondary` label. Used for Chat/Insights, Run/Strength/Mobility, Workouts/Progress, Week/Month/Year.

### Inputs
- `radius.full` pill text fields (chat composer) for single-line conversational input; `radius.lg` rectangular fields for structured settings inputs. Placeholder text in `text.tertiary`. Chat composer always pairs with a trailing circular send button (Clay fill).

### Badges
- Small pill (`radius.sm`–`radius.full`), Caption-weight label, tonal fill (e.g. Sage-tinted "Z2" training-zone badge). Badges communicate a short categorical tag, never a live-updating metric.

### Lists
- Standard row anatomy: leading icon in a tonal `radius.md` tile (§9), title (H3) + subtitle (Body, `text.secondary`) stack, trailing chevron (`text.tertiary`). Rows are separated by `space.xs` gaps or a single hairline `border.subtle` divider — never both. Section groups are introduced by an uppercase Caption eyebrow (TODAY, TOMORROW, THURSDAY…) with `space.sm` above and below.

### Charts
- Bar charts: Sage bars, `radius.sm` bar caps, current period at full opacity/others at 40%, Caption-style axis labels, no gridlines unless a value needs a baseline reference.
- Route/line: see §3.10 (Maps) for the map-specific line treatment.

### Bottom Navigation
- 5 fixed items (Dashboard, Training, Strength, Analytics, Profile), icon (20px) + Caption label stacked, active item in Clay (icon + label), inactive in `text.tertiary`. Persistent across all primary app screens; hidden only during an active full-screen run or video capture.

### Top Navigation
- Left: back chevron or nothing (root screens). Center or left-aligned H1 screen title. Right: at most one contextual icon action (settings gear, map layer toggle) — never more than one trailing icon to preserve the "one action" principle.

### Empty States
- Centered icon badge (56–64px icon, tonal circular background), H3 headline, Body supporting sentence, single Primary button if an action exists (e.g. "Upload or Record Video" panel doubles as an empty state pattern: icon, headline, sentence, primary + tertiary action pair). Empty states never use a full illustration — icon + type only, keeping tone consistent with the rest of the system.

### Loading States
- Skeleton blocks matching the exact shape/radius of the content they replace (card-shaped placeholders, not generic shimmer bars), using `surface.sunken` fill. For indeterminate waits (AI Coach "thinking," video analysis processing) use a subtle pulsing opacity on the icon badge rather than a spinner, consistent with the calm-motion principle in §10.

### Error States
- Same anatomy as Empty States, substituting Amber (recoverable — retry available) or Red (destructive/unrecoverable, e.g. permanently failed upload requiring discard) for the icon tint per §3.7, with a clear plain-language explanation sentence and a single recovery action.

---

## 14. Design Tokens

Engineering-ready token names. Values reference the definitions above; implement as your platform's native token/theme format (e.g. `Color`/`ColorSet` assets in Xcode, or a `Tokens.swift`/`tokens.json` file) — this table is the contract regardless of format.

### Color
```
color.sage                 #8B927C
color.clay                 #DCC0A7
color.steel                #708489
color.brown                #4D433E
color.sand                 #EFE7DA
color.white                #FFFFFF

color.success              #5F8A5C
color.warning              #C98A3E
color.destructive          #C1483B

color.bg.base.light        #EFE7DA
color.bg.base.dark         #161513
color.surface.raised.light #FFFFFF
color.surface.raised.dark  #211E1B
color.surface.sunken.light #E4DACB
color.surface.sunken.dark  #100F0E

color.border.subtle.light      rgba(77,67,62,0.08)
color.border.subtle.dark       rgba(255,255,255,0.10)
color.border.default.light     rgba(77,67,62,0.14)
color.border.default.dark      rgba(255,255,255,0.16)

color.text.primary.light   #4D433E
color.text.primary.dark    #FFFFFF
color.text.secondary.light rgba(77,67,62,0.65)
color.text.secondary.dark  rgba(255,255,255,0.70)
color.text.tertiary.light  rgba(77,67,62,0.40)
color.text.tertiary.dark   rgba(255,255,255,0.45)
color.text.onAccent        #4D433E
color.text.disabled.light  rgba(77,67,62,0.25)
color.text.disabled.dark   rgba(255,255,255,0.25)
```

### Typography
```
type.display.size      44     type.display.weight   700   type.display.tracking  -0.02em   type.display.lineHeight 1.05
type.h1.size           26     type.h1.weight         700   type.h1.tracking       -0.01em   type.h1.lineHeight      1.15
type.h2.size           19     type.h2.weight         600   type.h2.tracking       -0.005em  type.h2.lineHeight      1.20
type.h3.size           15.5   type.h3.weight         600   type.h3.tracking       0         type.h3.lineHeight      1.25
type.body.size         14.5   type.body.weight       400   type.body.tracking     0         type.body.lineHeight    1.40
type.caption.size      11.5   type.caption.weight    500   type.caption.tracking  +0.04em   type.caption.lineHeight 1.30
type.metric.size       32     type.metric.weight     700   type.metric.tracking   -0.01em   type.metric.lineHeight  1.00
type.buttonLabel.size  15.5   type.buttonLabel.weight 600
type.tabLabel.size     13.5   type.tabLabel.weight   500
```

### Spacing
```
space.2xs   4
space.xs    8
space.sm    12
space.md    16
space.lg    20
space.xl    24
space.2xl   32
space.3xl   48
```

### Radius
```
radius.sm    8
radius.md    12
radius.lg    16
radius.xl    20
radius.2xl   24
radius.full  9999
```

### Shadow
```
shadow.none  none
shadow.sm    0 1px 2px rgba(77,67,62,0.06)   |  dark: 0 1px 2px rgba(0,0,0,0.40)
shadow.md    0 4px 12px rgba(77,67,62,0.10)  |  dark: 0 4px 16px rgba(0,0,0,0.50)
shadow.lg    0 12px 32px rgba(77,67,62,0.14) |  dark: 0 12px 32px rgba(0,0,0,0.60)
```

### Motion
```
motion.micro.duration     130ms   motion.micro.curve     easeOut
motion.standard.duration  220ms   motion.standard.curve  easeInOut
motion.screen.duration    320ms   motion.screen.curve    spring(response:0.35, damping:0.86)
motion.pulse.duration     1600ms  motion.pulse.curve     easeInOut, autoreverse
```

### Icon
```
icon.size.inline   16
icon.size.row      20
icon.size.header   24
icon.size.feature  32
icon.size.hero     56–64
icon.stroke.small  1.5
icon.stroke.large  1.75
```

---

*Questions or proposed additions to this system should go through Product Design review before adoption — this document is the contract every StrideOS surface is built against.*
