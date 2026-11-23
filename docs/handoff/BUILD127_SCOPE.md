# Build 127 scope and acceptance

Authorized November 23, 2026 after the owner asked to proceed once the requirements were understood. This work follows Build 126; it does not withdraw or replace the existing public App Review submission or publish an App Store release. No exercise images, AI purchase products, allowance rules, provider budgets or dependencies are changed.

## User-visible work

- Edit/archive-delete previous goals without deleting actual completed workouts. Keep captured prescriptions and original summary windows intact. Repeat starts a fresh goal.
- Explicit ordered goal intent: primary, secondary, tertiary. Meaningful Aerobic Base, Run Farther, general fitness, strength/muscle/power and outdoor profiles, with a shared time/recovery budget and specific movement/conditioning choices.
- Outdoor choices: Hiking, Downhill Skiing, Snowboarding, Cross-Country Skiing, Mountaineering. The final label follows the owner's wording; mountaineering programming includes uphill-on-skis demands and descent preparation. Season and an optional actual event govern event tapering; ordinary non-event blocks do not invent a race peak.
- Foot-control, calf-strength and low-volume reactive modules. Dynamic single-leg clock reaches and unilateral loading have distinct purposes. Meaningfully loaded seated calf raises remain an option. Short-foot practice is optional with the small-tent analogy.
- Whole-workout deletion remains deleted across local projections, restart, cloud restoration and Health re-import. Apple Health originals are not deleted by this action.
- Planned/completed/missed calendar colors have the same meanings in month and week. Activity icons and a separate Today outline retain other information.
- Edit a saved route without rerouting it just by opening it. Save changes or save as a new route. Geographic sections have their own range, distance and optional target. Reshaping requires section review. Active route guidance uses a captured snapshot.
- AI Coach saved-history retry is actionable; typing and Send recover safely from a failed initial read, preserving unread records and the draft. Welcome/suggestion spacing stays compact and balanced.

## Verification gates

Behavioral tests must exercise storage restart, stale cloud/owner boundaries, archived-plan preservation, goal priority and time budget, exercise/equipment fit, active route snapshots, geographic section geometry/cues, calendar mixed statuses, and Coach storage recovery. PostgreSQL tests cover RLS, stale writes and account deletion cascade. Project typecheck and applicable existing regressions must pass before committing and building. Any hosted migration needs live schema/ACL/readback verification. TestFlight completion requires actual Apple processing and internal beta status, not just a successful upload.

Completed source, checks, hosted changes, build identifiers and TestFlight delivery evidence will be recorded separately. Device acceptance is not inferred from automated checks.
