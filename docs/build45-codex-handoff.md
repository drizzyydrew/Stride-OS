# Build 45 — Codex Handoff (middle 80%)

You are Codex, implementing Build 45 of StrideOS. You own the middle 80% of a strict
10/80/10 workflow. Architecture and sequencing were fixed in the first 10% and are binding.
The final 10% (audit, commit, build number, EAS, TestFlight) belongs to Fable 5 — not you.

## Your single source of truth

Read `docs/build45-sequential-execution-plan.md` in full before writing any code.
Execute its phases STRICTLY IN ORDER (1 → 12). Do not reorder, merge, parallelize, or skip
phases. Do not begin a phase until the previous phase's completion gates all pass.

## Repository safety (absolute)

- Repo: `/Users/drew/Documents/StrideOS_App_clean_build19_v3_foundation`, branch `build-19-v3-foundation`, starting HEAD `5a44753`. Verify before starting; stop and report if it differs.
- NEVER: `git commit`, `git push`, `git stash`, `git reset`, branch changes, tag creation.
- NEVER change: `expo.version`, `ios.buildNumber`, `eas.json`, Supabase schema, `modules/stride-pose`.
- `app.json` edits are allowed ONLY for the plugin/infoPlist additions specified in Phases 9 and 11.
- NEVER run `eas build`, `eas submit`, `eas update`, or any release/publication command.
- All work stays in the working tree for Fable's final audit.

## Product safety (absolute)

- Preserve existing user data: every schema change is additive with safe merge/migration; never delete or rewrite persisted records; `src/utils/scheduledSessionIds.ts` ID formats are on-disk identity and must never change.
- Preserve the canonical schedule architecture: ScheduledSession is the only schedule authority; Activity is the only completion record; planned values are never overwritten by actuals; duplicate completion stays prevented; Today/Calendar/Running/Strength/Activity/Coach must always resolve the same sessions.
- Preserve the web/Supabase-optional layer: `createAppJSONStorage()` on every persisted store, nullable Supabase client, maps facade, healthKit dynamic-require pattern. New native features must have honest web fallbacks — never fake data, never fabricate distance, never label estimates as measured.
- NO Apple Watch / watchOS / WatchConnectivity work of any kind. No leaderboards, social feeds, percentile claims, or shame mechanics. No Race Day Command Center. No clinical symptom system.

## Working discipline

- Business logic in pure `src/utils/**` modules with `node:test` coverage; UI thin.
- Read every file before editing it. Match existing style. Surgical edits in the large screens.
- Hot-file rule: the plan assigns each high-risk file to specific phases — never edit one outside its assigned phase.
- Validation after EVERY phase: `PATH=/usr/local/bin:$PATH npm run typecheck` && `npm test` && `npx expo export --platform web`. All green before proceeding.

## Progress reporting (required)

After each phase, report: phase number/name, files changed/created, contracts/migrations added, tests added + total count, validation output tails, deviations from the plan (with justification), and anything deferred with its flag. If a phase cannot meet its gates, STOP that phase, report the blocker, and await direction — do not push through with hacks or silently reduce scope.

## Endpoint

Stop after Phase 12's gates pass. Deliver a final consolidated report (all phases, full file inventory, test totals, known limitations, device-QA items flagged for the native-risk register). Then return the repository — uncommitted, unbuilt, unsubmitted — to Fable 5 for the final 10%: independent audit, device QA, release gating, commit, push, EAS production build, and TestFlight submission.
