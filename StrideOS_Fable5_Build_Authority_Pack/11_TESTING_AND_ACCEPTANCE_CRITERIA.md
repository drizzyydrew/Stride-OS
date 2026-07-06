# Testing And Acceptance Criteria

Work is not done until it is verified.

## Required Verification

Run the repo's standard checks:

- TypeScript check
- Expo check
- whitespace/diff check

Use the exact commands already established in this repo when available.

## Functional Acceptance

Each completed feature must satisfy:

- navigation works
- buttons work
- inputs save
- persisted values reload
- calculations produce expected ranges
- empty states are handled
- no fake controls
- no dead screens
- no console errors

## Visual Acceptance

Compare against:

- current screenshots in `02_CURRENT_APP_STATE_SCREENSHOTS/`
- target references in `03_TARGET_UI_REFERENCE_SCREENSHOTS/`
- StrideOS brand rules in `01_STRIDEOS_IDENTITY_AND_BRAND.md`

The result should feel:

- cleaner
- more premium
- more useful
- more coherent
- still unmistakably StrideOS

## Engine Acceptance

Running:

- run modes work
- active run screen works
- pause/resume/finish work
- saved run does not corrupt history

Hydration:

- current engine preserved
- inputs update outputs
- outputs explain why

Strength:

- history preserved
- sets/reps/weight/RPE save
- exercise library is useful

AI Coach:

- uses app context where available
- avoids generic advice

Movement Lab:

- checklist saves
- finding/meaning/recommendation output is present

Analytics:

- no chart exists without interpretation and recommendation

## Final Report Format

At completion, report:

1. Completed checklist
2. Files changed
3. Executive decisions made
4. Why those decisions were made
5. Anything intentionally deferred
6. Known limitations only
7. Verification performed
8. Confidence score that Drew will like the result
