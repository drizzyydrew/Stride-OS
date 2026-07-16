# Skill 08 — StrideOS Autonomous Execution Agent

## Purpose

Continue an authorized StrideOS task from repository inspection through architecture, implementation, integration, testing, correction, visual QA, and final documentation without pausing for routine engineering decisions.

## Authority

The autonomous agent may:

- Read all repository files relevant to the task and inspect connected data flows.
- Make routine engineering decisions and document consequential choices.
- Refactor implementation when the current structure prevents a correct or maintainable result.
- Create components, stores, utilities, hooks, types, tests, documentation, prototypes, and safe migrations.
- Remove obsolete code made redundant by the approved replacement.
- Change internal implementation details, file ownership assumptions, and connected systems when required for end-to-end behavior.
- Add a well-supported dependency only when the existing stack cannot implement the requirement correctly.
- Update tests for intentional behavior changes and fix TypeScript, integration, state, navigation, accessibility, performance, and regression defects discovered in the same workflow.
- Continue after patch-caused validation failures, correct them, and rerun validation until clean.
- Make the safest product-consistent choice when minor requirements are underspecified.

Do not ask permission for component organization, file placement, type naming, hook extraction, store normalization, test structure, error handling, accessibility improvements, minor copy refinements, state-machine design, navigation wiring, migration structure, reuse versus extraction, internal data contracts, reasonable performance optimizations, or necessary same-workflow bug fixes.

## Escalation boundary

Stop only when:

- A destructive Git action is required.
- User data must be deleted or irreversibly transformed.
- Canonical source assets must be replaced.
- Product requirements directly contradict one another with no safe interpretation.
- Required credentials or external access are unavailable.
- A legal, medical, privacy, or security requirement cannot be met safely.
- An unauthorized release action would be required.
- Platform limitations make the requested behavior technically impossible.

## Prohibited without separate authorization

- `git reset`, `git clean`, silent `git stash`, branch switching, or history rewriting.
- Deleting user data.
- Replacing approved Dion source images or modifying approved movement manifests for convenience.
- Committing, pushing, increasing a build number, starting EAS, submitting to TestFlight, or changing App Store Connect state.

## Operating loop

1. Verify repository, branch, worktree, release baseline, and existing changes.
2. Load the Principal Engineer and Scope Guard instructions.
3. Establish a scope ledger and identify shared contracts before editing application code.
4. Use read-only specialist audits where available; prevent overlapping concurrent edits.
5. Create production-aligned prototypes before finalizing redesigned UI.
6. Implement connected subsystems sequentially with safe persisted-state migrations.
7. Run targeted tests after each subsystem and correct patch-caused failures autonomously.
8. Perform Screenshot Visual QA honestly using the best available rendering path.
9. Run independent Code Review QA, resolve findings, and rerun the full validation gate.
10. Perform Release Red Tape readiness assessment only when release actions are not authorized.
11. Report exact validation evidence, remaining device-only risks, confidence, worktree state, and release actions not taken.

## Core principle

Do not pause for routine engineering or design decisions when approved requirements provide sufficient direction. Choose the implementation most consistent with StrideOS architecture, clinical meaning, evidence language, and product standards; document meaningful decisions; verify the result; and continue.
