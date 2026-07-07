# StrideOS Route Builder

Map-first route creation with snap-to-path routing, draggable waypoints, live
distance, elevation gain/loss, and saved-route details. Built as a running
intelligence feature: every route explains why planned distance and watch
distance differ (shortest-possible-route measurement vs GPS reality).

## Architecture

| Concern | Choice | Why |
|---|---|---|
| Map | `react-native-maps` (already installed; Apple Maps on iOS) | Zero new native deps — `package.json`/`app.json` are protected release paths. Mapbox SDK would require a native module + config change. |
| Routing | OSRM `foot` profile, public FOSSGIS instance (`routing.openstreetmap.de/routed-foot`) | Keyless, free, OSM-based so it snaps to footpaths/trails, returns GeoJSON. Verified working from this codebase. |
| Geometry math | Existing haversine utils in `routeStore` | Turf.js would add a dependency for two functions we already have. |
| Elevation | Open-Meteo elevation API (keyless) | Already used elsewhere in the app; ≤40 samples per route. |
| Storage | Zustand + AsyncStorage (`routeStore`), local-first | Matches StrideOS architecture; `routeToGeoJSON()` provides the interchange format. |

Files:

- `src/lib/routing.ts` — routing client, elevation fetch, GeoJSON serializer, education copy
- `src/store/routeStore.ts` — extended `RunRoute` model (additive; legacy routes stay valid)
- `src/constants/mapStyles.ts` — shared StrideOS map styling
- `app/(tabs)/training/route-builder.tsx` — builder screen
- `app/(tabs)/training/route-detail.tsx` — saved route detail
- `app/(tabs)/training/index.tsx` — RoutesTab launcher + View Details links (additive)

## API keys / setup

**None required for the MVP.** Both providers are keyless:

- Routing: `https://routing.openstreetmap.de/routed-foot/route/v1/foot/…` (FOSSGIS, fair-use)
- Elevation: `https://api.open-meteo.com/v1/elevation`

**Production upgrade (optional):** Mapbox Directions API (walking profile) for
SLA-backed routing. To switch: add `EXPO_PUBLIC_MAPBOX_TOKEN` to `.env`, then in
`src/lib/routing.ts` replace the OSRM URL builder inside `snapRouteToPaths()`
with `https://api.mapbox.com/directions/v5/mapbox/walking/{coords}?geometries=geojson&overview=full&access_token=…`.
The `RoutedPath` contract and every screen stay unchanged.

## Behavior notes

- All routing failures (offline, timeout >8s, no route found) fall back to
  direct lines, tagged `provider: 'direct'` and labeled in the UI — no fake
  snapping, distance is still computed honestly from the drawn line.
- Degenerate-result guard (architect audit): OSRM can answer `code: Ok` with
  a zero-length route snapped far from unroutable input; results whose start
  snapped >1 km from the first waypoint, or that claim ~0 m for separated
  waypoints, are rejected and fall back to direct lines.
- Builder helpers: **Out & Back** (mirrors the waypoints home), **Close
  Loop** (routes back to the start), **Fit** (frame the whole route).
  Waypoint deletion is confirm-guarded via the marker callout.
- Waypoints are the user's control points; `points` stores the full snapped
  geometry. Legacy consumers (live-run map overlay, GPS tab) read `points`
  and keep working with both old and new routes.
- Elevation gain/loss uses ±2 m hysteresis so flat routes don't accumulate
  phantom climbing (same approach as live-run GPS elevation).
- Estimated time uses the athlete's easy pace derived from weekly mileage
  (`estimateEasyPaceSecPerMi`).

## Manual QA checklist

1. Training Run → Routes → tap the "Route Builder" card → builder opens, map renders.
2. Tap the map twice → a snapped line appears between the points, the big distance updates, provider label reads "Snapped to roads & paths".
3. Tap 2–3 more points → route extends; ELEV GAIN/LOSS and EST TIME populate within a few seconds.
4. Drag a middle pin → line re-routes; distance changes.
5. Tap a pin, tap its callout bubble → point deletes.
6. Undo removes the last point; Clear (with confirm) empties the route.
7. Toggle "Direct" → line becomes straight segments; toggle back → re-snaps.
8. Airplane mode + move a point → amber "Path routing unreachable" banner, direct lines shown, no crash.
9. Save Route → name/folder/notes sheet → Save → lands on Route Detail with map, stats, elevation profile.
10. Rename via pencil icon; edit Notes; both persist after leaving and returning.
11. "Use Route for Next Run" → confirm alert → Training Run screen; start a run on the Active tab → the route line shows on the live map (existing behavior).
12. Routes list → expand any route → "View Details" opens detail; delete a test route → it disappears from the list.
13. Kill and relaunch the app → saved routes (and legacy seed routes) still present.
14. Regression: Plan/Active/Hydration tabs, a Quick Start run, and a strength session all behave as before.

## Known limitations

- Public OSRM instance is fair-use with no SLA; heavy use should move to
  Mapbox/GraphHopper (documented above). Fallback keeps the feature usable.
- Waypoint list reordering UI is not built (drag-to-reshape covers most
  cases); deletion is via the marker callout.
- Interval markers (segments) are still created in the inline builder on the
  Routes tab, not in the new full-screen builder.
- `surfaceType` is stored as `unknown` — OSRM foot doesn't return surface
  tags; honest until V2 surface detection.
- Elevation profile is a sampled bar strip, not an interactive chart.
- No visual verification was possible in this sandbox (no iOS Simulator);
  the QA checklist above is the TestFlight verification script.

## Route Builder V2 roadmap

1. **True trail-aware routing** — Valhalla `pedestrian` costing with
   `use_hills`/`surface` penalties, or self-hosted OSRM with a trail profile.
2. **Surface type detection** — query OSM way tags (Overpass) along the
   geometry to classify road/trail/mixed and store real `surfaceType`.
3. **Interactive elevation chart** — victory-native line chart with
   distance-indexed scrubbing; grade coloring.
4. **Estimated effort score** — distance + gain + athlete zones → training
   load preview before the run.
5. **Route difficulty score** — replace the static `difficulty` field with a
   computed grade (gain/mi, max grade, surface).
6. **Race tangent education+** — overlay the shortest-line vs drawn-line
   delta for a loop, quantifying "tangent savings".
7. **Planned vs actual GPS comparison** — after a run on a route, diff
   `routeCoordinates` from the log against the planned geometry (distance
   delta, drift heatmap).
8. **Live Run integration** — off-route alerts and distance-remaining from
   the planned line (builds on the existing selected-route overlay).
9. **Training calendar integration** — populate `linkedWorkoutId` from the
   planner; suggest a route matching the day's planned distance.
10. **AI Coach route recommendations** — feed saved-route stats into the
    coach context so "what should I run today" can answer with a route.
11. **Builder consolidation** — absorb interval markers into the new
    builder, then retire the inline one.
