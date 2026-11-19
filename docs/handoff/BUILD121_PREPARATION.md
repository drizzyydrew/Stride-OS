# Build 121 preparation — submission held

The owner explicitly said on 2026-11-19: “don’t submit to test flight just yet.” No EAS build or submission was queued for 121 in this task. The version number is reserved locally as 1.0.0 (121); it does not mean a signed archive exists. Public review and release are also untouched.

## Changes prepared

- Settings → Workout Intelligence exposes separate persistent Auto-pause runs and Auto-pause rides controls. Voice announcements remain separate.
- The existing fixed header keeps Back/Home and adds a quiet Live action when one restored, account-owned workout is active elsewhere. It opens the matching controls; it does not directly start, resume or reset a workout. Same-section navigation retains draft screens.
- Everyday energy equivalent and Calculation details use the parent width and shrink/wrap within the card, including expanded text. Energy calculations are unchanged.
- New goal plans use separate lifting experience, optional session time/equipment, useful movement roles, explicit submaximal effort and combined-demand/rest-day planning. Existing persisted goals remain on their original generator version.
- Actual set evidence drives progression advice; missing effort, unknown units or changed setups require calibration. Captured active prescriptions and new completion snapshots preserve intended versus performed work, including after a week or goal changes. Failed local saves retain the active workout for retry.
- The new band-row identifier resolves into the existing exercise inventory and has a text coaching guide.
- An older server-QA test harness now includes the existing Build 120 allowance module and URL global. No backend or subscription behavior changed.

No images, artwork, sharing components, Watch/native runtime source, authentication, billing policy, providers, dependencies or cloud services changed. The embedded share-image request was excluded under the owner's explicit instruction to ignore images.

## Verification boundary

- Final integrated affected checks: 188 passed, 0 failed, 0 skipped across 19 files. Log: `/Users/drew/.cache/strideos-build121-final-focused.log`.
- Canonical `npm run typecheck`: exit 0. Log: `/Users/drew/.cache/strideos-build121-typecheck-final.log`.
- Dependency alignment and native prebuild passed. Prebuild does not establish archive signing or device acceptance.
- The broader serial regression attempt has no final completion receipt and is not reported as a full-suite pass. It exposed the missing exercise inventory alias and stale server-QA harness; both pass their subsequent focused checks. An unchanged Swift deadline probe exceeded its 30-second limit under the broader run, then passed in isolation (1/1, no skips) without changing native code.
- Independent platform and contrarian actual-diff reviews passed. The final contrarian focused run reported 55/55 passing; the domain author's final run reported 49/49. These overlap the integrated suite and are not additional test totals. No current-build native visual acceptance or signed-archive verification is claimed.

The complete supplied-principle mapping, implemented boundaries and future examples are in [the programming integration matrix](PERSON_FIRST_PROGRAMMING_20261119.md). Generic e1RM automation, forced six-week exercise rotations and universal race taper protocols are not claimed as implemented.

## Checks when a future build is authorized

1. In Workout Intelligence, toggle actual run/ride auto-pause independently, leave and reopen Settings, and confirm the choices persist without changing voice preferences.
2. Start or pause a workout, browse another screen, then tap Live. Confirm the same workout and elapsed time return; Back still works and a paused workout remains paused.
3. Expand Everyday equivalent and Calculation details at a narrow width and with larger text. Confirm everything stays inside the card.
4. Keep an existing goal and verify it retains its plan. In a separate test goal, select lifting experience, a short time budget and available equipment; review the generated roles, dose and rest day.
5. Start a strength workout, return after navigation or a schedule change, edit actual sets/load, and finish. Confirm one history entry, captured prescription, correct units and no automatic earned increase from attendance or missing actual effort.

Do not submit 121 to TestFlight until the owner lifts the hold.
