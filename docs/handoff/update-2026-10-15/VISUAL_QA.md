# Browser Component Verification

2026-10-15, synthetic fixture only. No private routes or biometric records used.
This checks actual production React components through React Native Web, not a
replacement mockup or native-device acceptance test.

- Desktop default, 390x844 and 320x740 layouts inspected in Chrome.
- Light/dark Back and Close glyphs contain exactly two strokes; light uses
  brown/blue and dark uses clay/clay.
- Selecting the actual route slider midpoint changed the marker/profile/readout
  to 0.4 km, 2:00, 134 m, -3.1%, 110 bpm and the corresponding pace.
- Story enables the real fixture route only after selecting Route; Square has
  no Route option even after switching from an enabled Story route.
- Square minimal and editorial cards inspected; optional measured power retained
  its label and 230 W fixture average. Five metrics fit at 320px with compact
  centered content, equal margins and no horizontal overflow.
- Read-only DOM geometry at 320px: document scroll width 320px, four SVGs,
  no NaN/Infinity path data. Native map uses the same route coordinates; web
  fixture draws the route rather than substituting a basemap mock.
- The editorial wordmark and detail-selector contrast issue found during QA was
  corrected.
- Actual `ActiveOutdoorSession` inspected at 390x844 and 320x740. Time/distance,
  HR, ascent/descent and sport-specific pace/speed/cadence/power fit without
  horizontal overflow. Container-measured numeric fitting fixed an initial
  320px truncation. Synthetic ride values 42:18, 2.61 mi, 11.4 mph, 138 bpm,
  538 ft and 230 W were fully visible; controls ended at 724px in 740px height.
- Pause/Resume and Finish were exercised in the fixture. Recenter semantics were
  separately corrected against the actual Mapbox adapter: current-device follow,
  not the last accepted recorded coordinate. A gesture releases follow; Recenter
  restores it without competing coordinate commands (18 focused tests).
- Temporary browser viewport overrides were reset and the local QA server was
  stopped after inspection. Both generated QA bundles are ignored by Git/EAS.

Rebuild fixture bundle from repository root:

```sh
node_modules/.bin/esbuild docs/handoff/update-2026-10-15/visual-qa.tsx --bundle --outfile=docs/handoff/update-2026-10-15/visual-qa.js --alias:react-native=react-native-web --alias:react-native-svg=./node_modules/react-native-svg/lib/module/ReactNativeSVG.web.js --resolve-extensions=.web.tsx,.web.ts,.web.js,.tsx,.ts,.jsx,.js,.json --platform=browser --conditions=browser --loader:.js=jsx --loader:.ttf=dataurl --define:process.env='{}' --define:process.env.NODE_ENV='"development"' --define:process.env.EXPO_OS='"web"' --define:__DEV__=true
```

Serve that directory on localhost and open `visual-qa.html`. Bundle is generated
and ignored. Native modal animation, permission sheets, background execution,
ActivityKit scheduling and physical watch behavior require separate native/device
evidence; none is inferred from these browser screenshots.
