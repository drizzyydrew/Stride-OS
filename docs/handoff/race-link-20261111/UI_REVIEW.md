# Race linking UI source review

Scope: source and an extracted React Native Web / Expo UI fixture. No build, native recording, Health controls, backend write, or account write was performed.

## Implemented surfaces

- `RaceEventPicker`: controlled exact-ID selection, explicit No race selected, and full wrapping name/date/course summary. Root Running owns pre-recording metadata and Finish race / Stop race early.
- Saved Activity: Link to race / Edit race link opens a dedicated Race result page.
- After-recording editor: named race, saved run, outcome, trustworthy full recorded elapsed prefill, editable official finish time, and independent date-mismatch/replacement confirmations. Distances follow user units. Unchanged recorded timing stays recorded; a changed/unavailable clock cannot silently become an official entry.
- Race snapshots stay immutable when a later plan edits the same race ID. Archive context uses its frozen event; Activity editing uses its own linked event, including after choosing another saved run.
- Save remains pending until the domain service resolves durable verification. Failures retain the draft; Back protects unsaved edits and cannot leave a pending save. Unlink uses the domain service and explicit confirmation.
- Archive: plain Race result labels, live Activity-derived result/time, Open linked run / Edit / Unlink actions, and Link a saved run. Derived links are treated as links even before an explicit archive pointer exists. Manual result writes wait for Activity hydration and recheck new links. Existing coverage and frozen training-summary copy are unchanged.
- Calendar: exact race ID and opaque archive token; effective manual/archive/Activity outcome; separate Link a saved run and Record this race actions. Other athletes cannot use these links.

## Verification

`tsx --test scripts/tests/raceLinkUi.test.ts`: 13 passing source/behavior tests. They execute actual handlers or rendered source functions: official vs recorded elapsed, independent confirmations, owner invalidation, duplicate submissions, failed writes and draft preservation, Back guards, exact Calendar identity, original-event preservation, live-derived archive actions, and the two actual Running effects with a selected custom workout plus explicit race ID.

The final combined UI check also ran the existing Health-refresh visibility (7) and Activity recovery/focus (9) cases: 29/29 passed together. Their parent-screen harnesses now provide the added default-athlete profile hook and named Goal widgets; the original eligibility, stale-callback, and mutation-negative assertions remain unchanged.

A full source TypeScript pass succeeded before the final root-reviewed route guards; the root reviewer owns final intended TypeScript/full-suite verification. `git diff --check` passed.

CUA Chrome exercised the actual extracted editor at 320 and 400 CSS pixels with 1.35 text scale. The fixture explicitly scales React Native Text fonts/line heights and passes fontScale 1.35 to Expo UI. It showed the full long event name wrapping below the picker, imperial/metric saved-run distances, separate elapsed/confirmation controls, and no overlapping content. DOM horizontal-bound instrumentation reported 0 overflowing elements at both widths. The picker may shorten its selected menu label; the adjacent full event summary preserves all selected event text.

At 320, entering 1:29:45 changed the explanatory mode to entered finish time. Save without date confirmation produced an error and did not reach the inert service. Confirming both date and replacement reached the inert save stub. This validates UI interaction only, not disk persistence; domain service tests cover actual writes separately.

## Reproduce

From the canonical repository:

```sh
node docs/handoff/race-link-20261111/generate-ui-fixture.cjs
python3 -m http.server 8098 --bind 127.0.0.1 --directory /tmp/strideos-race-link-ui-20261111
```

Open `http://127.0.0.1:8098/?width=320&scale=1.35` or `?width=400&scale=1.35&units=metric`. All data are synthetic; owner, navigation, and persistence hooks are inert. The fixture imports actual pure domain helpers and extracts actual component functions. Intermediate TSX and the bundled React/Expo dependencies remain in /tmp.

Repo screenshots are cropped to the observed fixture column only. Full original browser captures remain private in `/tmp/strideos-race-link-ui-20261111/full-screenshots/`.

## Council boundary

Source/extracted-browser PASS for the reviewed UI with final root tests pending. Native device acceptance remains held: exercise actual route loading, native menus, large text, offline verified save/failure, linked archive/current Activity display, and recording completion. This fixture does not establish those native or transport behaviors.

## Minimalism follow-up

The approved polish changes presentation in three components only. The lifecycle card keeps the archived title, brief summary and View results visible; Training options starts closed and contains secondary navigation and benign backup status. Backup errors and lifecycle Retry remain visible. Identity keeps every field and both privacy switches visible, with the alias/email note; About profile visibility contains the longer explanation. Race linking keeps its selections, full summary, timing provenance, confirmations, feedback, Save and Done visible. The recorded-time reset appears only when it can change the selected timing mode; More options contains Unlink and the raw-metrics explanation.

`tsx --test scripts/tests/minimalismPresentation.test.ts scripts/tests/raceLinkUi.test.ts scripts/tests/profileIdentityEditing.test.ts scripts/tests/onboardingIdentity.test.ts`: 34/34 passing. The five new tests execute actual component source, verify visible/closed children and preserved action handlers, open the actual disclosure callback, and change/reset the race time. No store, persistence, owner guard, native recording or transport behavior changed.

Reproduce the follow-up fixture with `node docs/handoff/race-link-20261111/generate-minimalism-fixture.cjs`, then serve `/tmp/strideos-minimalism-ui-20261111`. Query `section=lifecycle`, `section=profile` or `section=race`, with `width=320` or `400` and `scale=1.35`. The lifecycle `error` query exposes the unchanged visible backup-failure message. Generated intermediates remain in /tmp.

Fresh CUA Chrome review captured closed and expanded source components at 320/400 CSS pixels and 1.35 text scale. All twelve observed states reported 0 horizontal-bound violations; primary controls, date/replacement warnings and visible backup error stayed outside closed options. Existing-link fixtures exposed Unlink only on expansion. Body-only screenshots and hashes are in `minimalism/`; full originals remain in `/tmp/strideos-minimalism-ui-20261111/full-screenshots`. Expanded long content scrolls vertically; screenshots capture the viewport, and single-line input values keep normal horizontal editing. This is extracted-browser proof, not native device acceptance. The server was stopped and Chrome returned to the parent reviewer.
