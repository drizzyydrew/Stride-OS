# Build 117 — logo and weight captions only

Use this guide after BUILD117_RELEASE.md confirms actual internal TestFlight
availability of **1.0.0 (117)**.

This candidate contains the owner's chosen cosmetic scope: the existing app icon
replaces the lightning bolt on sign-in/sign-up, and the weight wheels lose their
visible Hundreds/Tens/Ones captions. Height labels and wheel behavior remain.
Sign-in, session recovery, membership, and navigation behavior match build 116;
the proposed reliability safeguards are not included.

## Update and check

1. Finish/save any recording. Update using TestFlight without uninstalling or
   clearing storage. Keep your usual StrideOS account and existing history.
2. Open Settings → Profile → Weight. Confirm the numeric wheels remain and the
   place-value captions are gone. Open Height and confirm its unit labels remain.
   Opening/canceling must preserve saved measurements.
3. The sign-in/sign-up screens now show the same three-chevron icon as the app.
   There is no need to sign out merely to inspect this cosmetic replacement.

## Membership checks already completed on build 116

The owner reported Apple's successful no-charge Monthly purchase, StrideOS Pro
active, and Pro active after closing/reopening and explicitly restoring once.
That checkpoint is complete. Restore is a test/recovery option, not a requirement
on every app open, and no repeat purchase or restore is needed for this cosmetic
update. AI Coach checks membership on focus/foreground when consent and the online
account are ready; the membership-page confirmation message is action-scoped.

If access fails later, report the exact message and time rather than purchasing
again. Cancellation, renewal/expiry, other lifecycle cases and authenticated
server enforcement remain separate open gates.

The owner attributes the earlier sign-in/button symptoms to connectivity.
No reliability behavior is changed in this candidate. The six-minute recording
and offline-save acceptance from 116 remains scoped evidence; this cosmetic
candidate does not require repeating the whole app checklist.

The temporary private server QA owner was removed and its absence read back;
public server billing remains off. Authenticated client/server paid enforcement,
remaining purchase lifecycle cases, signup/reviewer/deletion acceptance, genuine
store/product screenshots, paid metadata and the final accepted binary remain
launch gates. No public review or release is part of this TestFlight delivery.
