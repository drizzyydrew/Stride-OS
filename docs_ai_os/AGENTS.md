# docs_ai_os — StrideOS Agent Skills Index

This does not replace the root `AGENTS.md` (Expo version/API guidance) — read
that first for anything touching Expo APIs. This directory is process: single-
purpose, copy-pasteable prompt templates for implementation, QA, and release
work, kept deliberately narrow so invoking one costs as few tokens as
possible.

**For any non-trivial ticket** (new feature, fix, or a combined verify-and-
release ask) — load `STRIDEOS_PRINCIPAL_ENGINEER_AGENT.md` first. It carries
the product identity, architecture, protected-systems list, build history,
and roadmap context needed to make good scope calls, and it selects skills
from the table below rather than duplicating them.

**For a single narrow task with an obvious skill** — skip straight to that
skill; going through the full agent doc is unnecessary overhead for, say, "run
skill 05 to submit build X."

See `skills/00_README_HOW_TO_USE.md` for how to invoke a skill and the
standard confidence rule (single source of truth — don't restate it
elsewhere).

## Routing table

| Situation | Skill |
|---|---|
| "Verify this feature/build works" | `01_CODE_REVIEW_QA_SKILL.md` |
| "Fix this bug" / "implement this narrow change" | `02_FIX_AND_ITERATE_SKILL.md` |
| "Create a production build" | `03_BUILD_IOS_SKILL.md` |
| "Audit before we ship" | `04_RELEASE_RED_TAPE_SKILL.md` |
| "Submit an existing build to TestFlight" | `05_TESTFLIGHT_SUBMIT_SKILL.md` |
| "Compare the app to the design" | `06_SCREENSHOT_VISUAL_QA_SKILL.md` |
| "Is this task scoped right / getting too big" | `07_SCOPE_GUARD_SKILL.md` |
| Combined "verify and release" ticket | 01 → 06 → 04 → 03 → 05, in that order |

## Non-negotiables (apply across every skill, not restated per-file)

1. **Never build (03) or submit (05) without explicit instruction, or
   without the confidence gate in `00_README_HOW_TO_USE.md` /
   `04_RELEASE_RED_TAPE_SKILL.md` passing in the current turn.**
2. **Audit before you edit.** Confirm a thing exists and works the way you
   assume before building on top of it or fixing it — this codebase has had
   fully-built, fully-unused features sitting dormant before.
3. **Hard boundaries are literal and machine-checked**, not remembered —
   see `07_SCOPE_GUARD_SKILL.md` for the concrete path list and the
   `git diff --stat` check, referenced (not copy-pasted) by every other
   skill.
4. **State environment limitations plainly.** No iOS Simulator and no
   browser-automation tool are typically installed here — see
   `06_SCREENSHOT_VISUAL_QA_SKILL.md` for the fallback and how to report it
   honestly instead of implying a visual check happened when it didn't.
