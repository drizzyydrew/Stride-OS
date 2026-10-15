# October 15 R&D Notes

Research date 2026-10-15. Competitor documentation establishes capability patterns,
not permission to reproduce UI, proprietary algorithms, text, or assets. Screenshot
search summaries are not technical authority.

## Navigation And Route Review

- [Expo SDK56 Router](https://docs.expo.dev/versions/v56.0.0/sdk/router/)
  documents iOS `gestureEnabled` and `fullScreenGestureEnabled`. Disable in all
  stacks rather than trying to win a responder conflict inside the video slider.
  Retain explicit, accessible safe-area-aware navigation. Native screen headers
  stay fixed while page content scrolls. Existing `@expo/ui` is absent; preserve
  the established modal implementation rather than introduce an unrelated native
  package migration merely to supply escape controls.
- [AllTrails Navigate overview](https://support.alltrails.com/hc/en-us/articles/360059000272-Navigate-feature-overview)
  describes inspecting distance/elevation/grade on an elevation graph. StrideOS
  will use its own palette/layout and extend the temporal inspection to recorded
  heart rate and available sensor samples. Cached basemap availability and local
  GPS recording are separate concerns.
- [Slopes Timeline Editor](https://slopes.helpscoutdocs.com/article/33-inaccuratestatsormissingdata)
  documents that automatic descent/lift segmentation can miss short runs or fail
  with GPS gaps and permits corrections. StrideOS must preserve its source track,
  label inferred segments, and not turn GPS gaps/noise into counted descents.

## Power And Provenance

- [Garmin running power](https://www.garmin.com/en-GB/garmin-technology/running-science/running-dynamics/running-power/)
  identifies speed-change, potential-energy, oscillation, and air-resistance
  components, using inputs including running dynamics and environmental context.
  Phone GPS alone cannot reproduce that full measurement/model. A simplified
  StrideOS model must name its missing components and must not claim equivalence.
- [Strava cycling power estimation](https://support.strava.com/es/articles/15401944-como-calcular-la-potencia-de-tus-vueltas-en-bicicleta)
  describes estimation from rider/bike mass, speed, and elevation when a meter
  is unavailable. StrideOS will use published physical relationships and explicit
  assumptions, not claim access to Strava's internal implementation.

Engineering consequence: measured power wins over estimates; mass, distance and
time must be valid; grade/speed inputs need smoothing and gap rejection. Store
model version and assumptions. No power badge award rules are specified yet.
For unsupported sports, do not invent universal total human watts. A defensible
climbing-work component can be labeled as such and must not be compared to cycling
crank power, running wearable power, calories, or downhill gravitational energy.

Independent offline-auth and Apple/sensor research will be appended with source
links and implementation-specific decisions after council review.

## Published Models And Limits

- [Martin et al. 1998 cycling model](https://pubmed.ncbi.nlm.nih.gov/28121252/)
  supplies the physical road-load decomposition. StrideOS uses gravity,
  rolling resistance, aerodynamic drag and optional acceleration, converts GPS
  horizontal velocity to slope-path velocity using `sqrt(1 + grade^2)`, then
  applies an explicit drivetrain efficiency. Assumed still air/drag area/bike
  mass are not measured environmental data. Post-workout v2 omits acceleration
  and says so. Zero demand does not establish coasting or braking.
- [Minetti et al. 2002](https://journals.physiology.org/doi/full/10.1152/japplphysiol.01177.2001)
  studied treadmill locomotion in ten runners. Its running cost curve is used
  only as a **metabolic** expenditure estimate, not mechanical or wearable
  power. No mixed run/walk or extrapolation beyond the studied grade domain.
  A valid average requires at least 70% eligible recorded coverage; missing
  altitude is never silently treated as flat ground.
- Hiking/walking can show the body-mass climbing-work component `m*g*h` in kJ.
  This excludes equipment mass and cannot distinguish assisted ascent from GPS
  alone. It is neither total exercise energy nor total power, and is not offered
  as a comparable power leaderboard or new badge.

Measured, device-estimated and model-estimated streams remain distinct. Each
stream must qualify for coverage before precedence applies. Pauses expire old
sensor observations. Imports keep their actual provenance or say unknown.

Auth/session and exact-completion R&D is recorded in
`P1_OFFLINE_AUTH_COMPLETION_REVIEW_2026-10-15.md`, including primary Supabase and
version-pinned Expo links. Phone GPS and connected biometric sensors do not need
cell service; basemap downloads/caching are a separate feature, not claimed here.
