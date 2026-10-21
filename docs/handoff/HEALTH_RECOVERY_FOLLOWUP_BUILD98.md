# Health Recovery Follow-Up - Build 98

Status: candidate under verification, October 21, 2026. The user reports that recovery still fails after build 97. The supplied images show the unavailable screen and confirmation for the selected Health workout, not the result after confirming Restore. A question requesting that result/error remains outstanding. Do not claim that the phone's failure has been diagnosed or the race recovered.

## Confirmed Findings And Corrections

- Rename the installed app from `StrideOS: Run, Lift, Recover` to `StrideOS`. Clean iOS prebuild produces `StrideOS.xcodeproj` and reads back `CFBundleDisplayName: StrideOS`, version 1.0.0 (98). Bundle identifiers, Expo project/slug and signing profiles remain unchanged. The native-target contract test discovers the generated Xcode project rather than requiring the obsolete display-name path.
- The workout list displays `SourceProxy`. The installed Nitro bridge registers its inherited name rather than HKSource.name; serialize the nested source through its actual `toJSON()` method. Preserve its source bundle identity. This is a confirmed label defect, not proof of the restore failure.
- The Activity confirmation read used the initial-hydration storage reader, which retries read errors indefinitely. Reproduced a post-write error that left recovery and the commit queue pending. Add a guarded one-shot read for confirmations only. Initial hydration continues retrying failed reads and blocking writes until saved data has been read safely.
- A concurrent edit could be pending in the middleware write queue when the older snapshot was acknowledged. Durable Activity commits now drain queued edits and verify the current snapshot, with at most three attempts. Continuous edits reject with a retryable message; no rollback or duplicate insertion.
- Selected recovery now rejects conflicting recording-instance/Health UUID evidence and competing exact matches, before and inside the queued mutation. Do not modify global recording-identity precedence or choose between competing records automatically.
- Show read-details, route, metrics, saving and opening phases. Keep a pinned failure panel with the selected workout and explicit same-selection retry. A retry refreshes the session/list and requires the same UUID/source; it cannot substitute another workout. Do not stack a second native alert during confirmation dismissal.
- Closing while recovery is pending explicitly reports that saving is not confirmed and an in-progress write may still finish. A 15-second hint is informational, not a timeout, cancellation or permission to start a duplicate save.
- A focus-session token and focus-keyed picker prevent covered or previous screen sessions from navigating after a late result, including after focus returns. Owner, deletion, route and request fences remain in force.

## Verification And Limits

- Final serial suite: 1,054/1,054 passed, zero failures/skips (`/tmp/strideos-build98-tests-final.log`).
- Integrated synthetic test uses the actual adapter, recovery service, Activity store and hydration-safe persistence wrapper. A rejected confirmation read returns promptly, retains the saved row, preserves edits and retries with the same canonical ID. Held concurrent edits cannot receive an early acknowledgment; continuous edits are bounded. Owner changes and deletion during confirmation are covered.
- UI harness covers immediate rejection, each phase, single-flight confirmation, same-selection retry, cancelled/late results, timer cleanup and focus remounts. The generated phone plist and all 22 native-target contract tests pass.
- Final semantic typecheck, iOS Hermes export and whitespace checks passed. Both independent reviewers issued source GO after cross-examining the storage loop, nested conflicting identities and UI lifecycle. A single consistent recording instance may have multiple Health exports; an unambiguous existing edited row is preserved unchanged, including its earlier Health UUID. Conflicting top-level/nested instance claims are rejected before writes. These policies have native-like integrated fixtures.
- Signed archive and Apple acceptance are pending.
- Neither the storage-read reproduction nor conflicting-identity fixtures are confirmed as the user's device failure. No Health data was modified, old links reassigned, inferred recording created, or personal Health record committed. Native Watch transport/completion, badge artwork, dependencies and earning rules are unchanged.

## Listing Name

The App Store/TestFlight catalog title is separate from the binary display name. App Store Connect opened at the existing app but required Apple sign-in. The user has been asked to sign in; no store title or other catalog metadata has been changed. EAS build/submission can use existing credentials independently. A supported metadata pull confirmed the existing English title. No metadata push was performed: that command also processes release, version and other fields, outside the requested title-only edit. Pulled configuration/screenshots were moved out of the source tree to a temporary local readback folder and are not committed or included in the build.

## Device Acceptance

Update without uninstalling. Select the original workout and confirm Restore. Record the phase or exact pinned error if it fails, or verify the opened canonical activity and reopening it from Activity after restarting. Confirm same-selection retry does not create duplicates. An unresolved old link is not reassigned. Do not repeat a bulk-history restore as a substitute for observing this result.
