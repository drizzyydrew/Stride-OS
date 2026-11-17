# Live Activity logo correction

The owner reported an opaque gray box beside Training Run on the physical Lock Screen and explicitly requested the existing three-chevron logo, transparency, researched sizing and a fit check. The old asset was the1024px rounded app-icon tile, approximately95%fullyopaque, shown in a28pt view. This is evidence of an unsuitable asset; it does not conclusively attribute every gray-box rendering to one OS cause.

The new exports recover the approved icon's exact three-chevron body and palette, remove the tile and composited edge fringe, and fit26ptof ink inside a28pt transparent canvas. Catalog entries are28px@1x,56px@2x and84px@3x. Image/catalog rendering explicitly requests original/full color. Header geometry, other widget logic, controls, intents, metric freshness and Watch/phone transport are unchanged.

Independent platform/contrarian review: PASS for an internal candidate. ExistingLiveActivity checks25/25; root's combined native version/Watch and LiveActivity checks35/35. Exact whole-widget SwiftUI semantic checking and assetcatalog compilation/readback passed. The native bound-image preview verifies the modifier/layout chain using an explicit PNG resource; it is not a physicalActivityKit LockScreen render or proof of AlwaysOn behavior. The validation.json receipt records that reviewer's pre-build checkpoint.

Apple sources checked17November2026:
- https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities — assets should not exceed presentation size; example minimal image bound45×36.67pt.
- https://developer.apple.com/documentation/widgetkit/widgetaccentedrenderingmode — full-color image treatment in accented mode.

The actual installed-logo check requires the next native build; editing an example image cannot prove the runtime issue resolved. No Watch-reliability or purchase-lifecycle acceptance is inferred. The image edits use fictional marketing data at the owner's request and do not alter account, HealthKit or training records.
