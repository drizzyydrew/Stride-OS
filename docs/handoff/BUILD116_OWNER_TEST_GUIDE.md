# Build 116 — focused UI and private subscription acceptance

Follow this guide only after BUILD116_RELEASE.md confirms TestFlight availability
of **1.0.0 (116)**. This guide is not a device pass or public launch approval.
The November 15 report that115 works is retained; this is a short check of changed
paths and the newly enabled purchase client. Public server billing remains off.

## 1. Update and keep your existing training account

Finish/save any current recording. Update through TestFlight without uninstalling
or clearing storage. Keep the StrideOS account that owns your current history
signed in. Update the paired Watch app when116 is offered. Confirm old workouts
remain. Stop if history is missing.

The StrideOS sign-in identifies the person who receives Pro access. The Apple
Sandbox account is a separate Apple payment-test identity. Do not use a Sandbox
Apple login as the StrideOS email/password, and do not switch StrideOS accounts
on a device that retains another account's history. A dedicated review account
needs a fresh, isolated installation. Never reset your training data for billing QA.

## 2. Check the requested UI changes

1. More → Settings → Profile. Settings should show one Profile navigation card,
   without duplicate photo, name, age, height or weight editors.
2. Open name/username, Performance Calibration, and Availability from Profile.
   Back should return to Profile, then Settings. Existing Profile sections and
   the Today avatar shortcut should still work.
3. Tap Date of birth. Check Apple's month/year selection and choose a day. For
   the first inspection use Cancel; opening must not save its initial cursor.
   If you want to save, enter only your real date. An existing age is preserved
   until a date is selected. Exact DOB stays on this device, is excluded from
   StrideOS cloud sync/automatic coaching context, and may be in OS backups.
4. Open Height and Weight, then cancel. Confirm existing values remain. Height
   uses feet/inches or meters/centimeters. Weight uses hundreds/tens/ones in lb
   or kg. Changing the entry unit without changing/saving a measurement must
   not round your saved value or turn an unknown/default weight into a measurement.
   Save only a genuine correction, if one is needed.
5. Switch Settings units to Metric, inspect Profile, then restore your preference.
6. Settings → Workout Intelligence contains Auto-pause. Running should no longer
   duplicate that switch. Leave your preferred saved mode selected.
7. Start a normal outdoor recording. At normal iPhone 13 Pro text size, short Time
   and Distance values should be side by side, with each label centered under
   its value. Large text/long values may stack centered. Nothing should overlap.
8. Open Training History/Activity details. Numeric measurements should have no
   more than two decimal places. Full saved precision and normal time/pace
   formats are preserved; no fabricated race/PR inputs are needed.

## 3. Brief background/save check after the SDK patch

Record at least six active minutes on a safe route. Keep the phone locked for
about two minutes, check Watch metrics, pause/resume once, then save once while
Airplane Mode is on and Wi-Fi off. Wait for Run saved. Reopen offline, then
reconnect and confirm exactly one saved activity. If Health writing was enabled,
check for one matching workout. No need to repeat the whole115 checklist unless
something regresses. Report any crash/disconnect with its approximate local time.

## 4. Subscription phase — wait for the exact test-account setup

Client purchases are enabled in this private candidate, but that alone does not
prove server paid-access enforcement. The server QA binding is not activated by
this guide. The app email and test window must be confirmed before server checks.
Keep the usual app sign-in; do not send passwords, tokens or recovery secrets.

1. Open More → Settings → Account & Legal → StrideOS Pro membership.
2. Select View plans with RevenueCat. Both Monthly and Annual should load real
   StoreKit prices. Current USA configuration is $9.99/month, $79.99/year, with a
   seven-day introductory free trial where Apple says the account is eligible.
   Storefront currency and eligibility can differ; capture the actual display.
3. Before buying, open Apple's confirmation and cancel it. No new Pro entitlement
   should be granted by the canceled request. Verify this from an inactive state.
4. When the controlled server check is ready, approve a genuine Sandbox purchase
   through the TestFlight installation. Apple handles the test payment. Do not
   initiate a real App Store charge or sign out of your normal Apple account
   merely to try to force a Sandbox dialog.
5. Confirm membership becomes active, close/reopen, then use Restore purchases
   and Retry membership check. The same StrideOS owner must retain the entitlement.
6. Cancel renewal in Apple's subscription controls. Cancellation alone should
   not revoke the remaining active period. Observe expiry, renewal and any
   supported retry/grace/revocation cases using the existing Sandbox controls.
7. Test both products from the appropriate inactive state; changing between two
   active plans can be a crossgrade rather than a fresh introductory purchase.
   Do not erase app/training history to reset purchase eligibility.
8. Client state, RevenueCat and the authenticated server result must agree. The
   private no-quota server check deliberately stops before AI provider calls;
   its test response is not proof of public AI delivery. Remove the temporary
   QA owner binding and verify cleanup after the controlled session.

Apple's default TestFlight subscription renewal cadence is daily, up to six times
in a week. Accelerated or failure scenarios depend on the Sandbox account controls;
old five-minute settings are not proof of today's TestFlight timing. Follow
[Apple's current instructions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/).
Only Pro AI Coach chat is paid (up to 20 requests/account/UTC day, subject to
availability). Recording, Calendar, saved history and on-device Insights remain free.

## 5. Send results, then finish the public package

```text
Phone build / Watch updated:
Usual account / old history intact:
Settings → Profile → three editors → Back:
Native DOB calendar / Cancel / actual Save if tested:
Height & weight wheels / units / untouched values preserved:
Auto-pause only in Workout Intelligence:
Time + Distance / large text / history decimals:
Six-minute background / pause / offline save / one activity:
Plans loaded with actual prices / trial eligibility:
Canceled purchase / monthly / annual / restore:
Observed renewal / expiry / grace / revocation:
Client + RevenueCat + server evidence and times:
Any error, crash, screenshot or approximate local time:
```

The remaining public sequence is: accept the exact UI/purchase candidate; finish
real signup/email/native return, reviewer access and approved disposable-account
deletion; capture genuine final-candidate large-iPhone store and subscription
review screenshots; reconcile paid privacy/reviewer text; select the accepted paid
binary and first subscriptions together; obtain the owner's public submission
and manual-release decisions. The owner checks support daily; no new response-time
promise is published. The public draft still selects 109 at the latest readback.

Apple review and publication determine the live date. Completing a submission
package by November 16 is a target, not a promise of public availability that day.
