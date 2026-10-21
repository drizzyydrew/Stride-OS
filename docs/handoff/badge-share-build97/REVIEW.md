# Fixed Badge Shares - Build 97

Latest written request supersedes prior poster layouts: the captured image contains only the canonical badge and StrideOS wordmark. No duplicate title, unlock heading, footer target, date, metrics, photo, drag or scale controls. Badge-internal lettering and numbers remain part of the unchanged canonical artwork.

## Implementation

- `BadgeShareCanvas` is the shared fixed renderer. Square uses a 360-unit composition with a 240-unit badge; story uses 360x640 with a 288-unit badge. The entire composition scales together after layout. Wordmark is inset 24 units from the top and left.
- Achievement detail no longer passes related activity data or offers the combined activity variant. Normal activity sharing remains in its existing editor. The hub's legacy export IDs map to the same fixed renderer, capturing the inner canvas rather than its rounded preview wrapper.
- Minimal, Editorial and transparent backgrounds remain available. Transparent uses the canonical transparent artwork; locked previews retain locked artwork. Existing earned-only sharing checks remain at both screen entry points.
- Fixed app navigation, including the double back chevrons and StrideOS name, remains outside the capture ref. No badge artwork, family definitions, earning thresholds or native Watch code changed.

## Council And QA

Independent Platform/Product and Contrarian/Export passes identified the second exporter and its rounded capture wrapper. Both issues were corrected and cross-examined. These are source and browser-render checks, not physical-device PNG acceptance.

- Browser rendered the actual RN-web `BadgeShareCanvas`, `ShareBrandMark`, `AchievementBadge` and canonical SVG renderers, not a redrawn approximation.
- 24 combinations: August/200K Month, square/story, three styles, 320/430-wide canvases. Every canvas had one SVG, only `StrideOS` DOM text, and contained the badge bounds. All eight transparent combinations reported alpha-zero canvas backgrounds.
- Visually inspected August Minimal/story, 200K Editorial/square and 200K transparent/story. A drag attempt left the badge's measured rectangle unchanged. Header chevrons were checked in dark and light themes.
- Browser matrix does not establish iOS snapshot alpha, first-share readiness, native font rendering or installed-device fidelity. Test Create Share PNG immediately after opening a badge and after changing format/style on the device. Confirm no clipping, no preview-wrapper corners, correct alpha, and no navigation or controls in the PNG.
- Full automated suite and release receipt are recorded in the parent Build 97 handoff.

## Reproduce The Browser Fixture

Build `qa.tsx` with esbuild using `--bundle --platform=browser --alias:react-native=react-native-web --resolve-extensions=.web.tsx,.tsx,.web.ts,.ts,.web.js,.js,.json --loader:.ttf=file --jsx=automatic`. Serve `qa.html`, the bundle as `/badge-share-build97-qa.js`, and the referenced local font path. `?matrix` shows all 24 compositions. Individual query fields are `badge=monthly`, `format=square|story`, `variant=minimal_card|transparent_overlay|editorial_card`, and `theme=light|dark`.
