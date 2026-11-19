# Build 121 preparation — programming integration

The owner held the earlier 121 source checkpoint (03f76f6) on 2026-11-19. The subsequent request expanded programming, presets and exercise adjustments and explicitly authorized: “you have my permission to push and submit to TestFlight.” That newer instruction lifts the internal-TestFlight hold for the completed combined change. Public App Review and release remain separate. Build/upload/Apple receipts will be recorded separately; the local version number alone is not delivery proof.

## Changes prepared

- Settings → Workout Intelligence exposes separate persistent Auto-pause runs and Auto-pause rides controls. Voice announcements remain separate.
- The existing fixed header keeps Back/Home and adds a quiet Live action when one restored, account-owned workout is active elsewhere. It opens the matching controls; it does not directly start, resume or reset a workout. Same-section navigation retains draft screens.
- Everyday energy equivalent and Calculation details use the parent width and shrink/wrap within the card, including expanded text. Energy calculations are unchanged.
- New goal plans use separate lifting experience, optional session time/equipment, useful movement roles, explicit submaximal effort and combined-demand/rest-day planning. Existing persisted goals remain on their original generator version.
- Actual set evidence drives progression advice; missing effort, unknown units or changed setups require calibration. Captured active prescriptions and new completion snapshots preserve intended versus performed work, including after a week or goal changes. Failed local saves retain the active workout for retry.
- The new band-row identifier resolves into the existing exercise inventory and has a text coaching guide.
- An older server-QA test harness now includes the existing Build 120 allowance module and URL global. No backend or subscription behavior changed.

The expanded programming implementation and its boundaries are documented in [BUILD121_PROGRAMMING.md](BUILD121_PROGRAMMING.md). It includes actual goal-specific macro phases, explicit practice/recovery clocks, actual-volume and quality progression, eligible Norwegian 4×4, hybrid placement, preset dose/setup corrections, per-exercise adjustments, and durable future preferences.

No images, artwork, sharing components, Watch/native runtime source, authentication policy, billing policy, providers, dependencies or cloud services changed. The embedded share-image request was excluded under the owner's explicit instruction to ignore images.

## Verification boundary

- The earlier source checkpoint passed 188 focused checks. That is historical evidence for 03f76f6 and is not added to the final total.
- Expanded final regression: **2,058/2,058 passed**, zero failures/cancellations/skips, across 227 files. The first expanded attempt exposed outdated strict test mocks for new store imports; those fixtures were corrected without changing their assertions, and the complete rerun exited 0.
- Final canonical npm run typecheck exited 0; dependency alignment and native prebuild passed. See BUILD121_PROGRAMMING_VERIFICATION.json for log hashes and the tested runtime fingerprint.
- Independent source review passed. Its 96 focused tests and final 5-case beginner-boundary rerun overlap the full suite and are not extra totals. The domain runs likewise overlap.
- Signed archive, Apple processing, tester assignment and final physical-device acceptance are separate stages. No new native visual/device acceptance is claimed from local tests.

The expanded implementation and remaining boundaries are in [BUILD121_PROGRAMMING.md](BUILD121_PROGRAMMING.md). The earlier principle matrix is retained as a historical record. Generic e1RM automation, mandatory six-week exercise replacement and a universally individualized taper are not claimed.

## Checks when a future build is authorized

1. In Workout Intelligence, toggle actual run/ride auto-pause independently, leave and reopen Settings, and confirm the choices persist without changing voice preferences.
2. Start or pause a workout, browse another screen, then tap Live. Confirm the same workout and elapsed time return; Back still works and a paused workout remains paused.
3. Expand Everyday equivalent and Calculation details at a narrow width and with larger text. Confirm everything stays inside the card.
4. Keep an existing goal and verify it retains its plan. In a separate test goal, select lifting experience, a short time budget and available equipment; review the generated roles, dose and rest day.
5. Start a strength workout, return after navigation or a schedule change, edit actual sets/load, and finish. Confirm one history entry, captured prescription, correct units and no automatic earned increase from attendance or missing actual effort.

The owner has lifted the internal-TestFlight hold for this expanded scope. Submit only the exact verified build after final checks and council review.
