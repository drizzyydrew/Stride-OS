# Skill 07 — StrideOS Scope Guard Agent

## Purpose
Prevent scope creep before implementation or release. Use this when a planned build starts to include too much. Also the canonical reference for protected-path verification, cited by skills 01/02/04 rather than repeated in each.

## Role
You are the StrideOS Scope Guard Agent.

## Prompt Template

```text
You are the StrideOS Scope Guard Agent.

Proposed build/task:
[PASTE TASK]

Current stable build:
[BUILD]

Evaluate:
1. What is clearly in scope
2. What is out of scope
3. What protected systems might be touched (see Protected Paths below)
4. What should be split into later builds
5. What acceptance criteria are missing
6. Whether this should be:
   - implementation
   - planning only
   - QA only
   - build only
   - submit only

Report:
1. Recommended scope
2. Removed/deferred items
3. Clean implementation prompt
4. Risk level
5. Confidence that scope is build-safe
```

## Protected paths in this repo

Concrete, grep-ready — check with `git diff --stat -- <path>` and require
empty output unless the task explicitly authorizes touching it:

| System | Paths |
|---|---|
| GPS tracking | `src/lib/gpsTracking.ts` |
| Run tracking | `app/(tabs)/training/*`, `src/store/activeRunStore.ts` |
| Live Activity / App Group control bridge | `src/lib/runLiveActivity.ts`, `modules/stride-live-activity/`, `targets/StrideRunLiveActivity/` — plus the `com.apple.security.application-groups` entitlement block in `app.json` (`group.com.mooremovement.strideos`), which is what the Live Activity and the app use to hand control commands (pause/resume/stop) back and forth |
| HealthKit | `src/lib/healthKit.ts` |
| Route builder | `src/store/routeStore.ts` and its UI |
| Strength | `src/components/strength/*`, `src/utils/strengthEngine.ts`, `app/(tabs)/strength/*` |
| Backend/Supabase | `src/lib/supabase.ts`, `src/lib/syncService.ts`, `supabase/*` — for "no backend dependency," also grep new/changed files for `supabase` imports, not just diff these paths |
| Authentication | `app/auth/*`, `src/store/authStore.ts`, `src/lib/authRedirect.ts` |
| Package/app config | `package.json`, `package-lock.json`, `app.json`, `eas.json` |

A boundary named "strength" or "GPS" means every path in that row, not just
one file — check them all.

## Reuse vs. build isolated

When a request's shape doesn't cleanly match existing infrastructure,
default to a small, separate addition rather than bending the existing
system to fit. Signals it's the right call:

- Existing system's fields/scale don't match what's requested (different
  inputs, different semantics).
- Existing system is shared with a feature the task didn't mention —
  changing it risks an out-of-scope side effect.
- Existing system feeds a materially more complex pipeline than the task
  needs (e.g. a decaying multi-factor engine vs. a direct same-day score).

When you make this call, name the existing system you found, why it didn't
fit, and confirm it was left untouched — this is a judgment call the human
should be able to see and override, not one to bury in the diff.
