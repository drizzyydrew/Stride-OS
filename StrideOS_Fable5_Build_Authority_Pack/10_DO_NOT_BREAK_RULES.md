# Do Not Break Rules

Do not:

- delete working features
- replace the brand
- make it look like a generic fitness app
- add fake functionality
- remove local storage
- break navigation
- remove hydration
- remove strength history
- remove AI Coach structure
- change colors without reason
- prioritize aesthetics over function
- break GPS tracking
- break HealthKit paths
- break Live Activity / Dynamic Island paths
- break App Group control bridge behavior
- break TestFlight build readiness
- remove saved user data pathways

Every feature must answer:

Does this help the athlete make a better training decision?

## Protected Product Truths

StrideOS is not a dashboard of numbers.

StrideOS is not a random workout generator.

StrideOS is not a punishment app.

StrideOS is not a social fitness feed.

StrideOS is an adaptive training operating system.

## Risk Rule

If a change touches native modules, package versions, app config, GPS, Live Activities, HealthKit, auth, backend sync, or release settings:

1. Verify the exact current implementation.
2. Keep the change minimal.
3. Test thoroughly.
4. Document the reason.

Do not change these areas casually.
