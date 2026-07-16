# Build 38 Directions Architecture

- Native provider: Apple MapKit `MKDirections`.
- Supported request modes: walking and cycling, subject to OS/region coverage.
- Route contract: normalized steps, geometry, distance, expected time, current
  step, next instruction, off-route state, and guidance type.
- Manual geometry: breadcrumb route-following only; the UI never promotes it to
  turn-by-turn directions.
- Off-route: several sustained samples outside the route corridor are required
  before a spoken/visual notice.
- Privacy: location is used for active tracking and routing; no third-party API
  key is stored in client source.
- Failure: preserve the route, explain that routable directions are unavailable,
  and offer breadcrumb following or Directions Off.
- Hiking/trails: no claim is made unless MapKit returns suitable geometry and
  instructions. No unsupported path is silently substituted.
