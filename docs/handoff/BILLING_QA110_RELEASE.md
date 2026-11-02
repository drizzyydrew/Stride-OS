# Private purchase-test candidate 110

Prepared November 2, 2026 from production candidate 109/source `d71403e` in
an isolated worktree. Only `app.json` build number changes to 110; the existing
`billing-qa` profile sets client billing true. Canonical production remains
109/client billing false, and the public App Store draft must stay on 109.

This is internal purchase-test preparation, not payment activation or lifecycle
acceptance. The existing Team (Expo) internal group was freshly verified to have
one tester, the owner. No invitations, external group or public link are added.
The existing Starter build allowance displayed $12/$45 used; one medium job fits
the observed allowance without an upgrade or add-on. Usage may post later.

TypeScript semantic and Expo compatibility checks passed. The 49 focused billing,
privacy and observability checks passed with no skips. App/runtime dependencies,
native modules, routes, training history and SDK implementation are unchanged.
Internal build preflight confidence is 95% as an engineering judgment, not a
measured reliability probability or public-launch signoff.

The existing prepared server QA policy is now deployed as AI Coach v14 with all
three source files byte-matched and JWT verification preserved. Both global
billing and QA-owner settings were absent before deployment. Leave them absent
until the dedicated test account is confirmed. The expected owner-only
402 → 429 → 402 progression tests access without AI allowance/provider use;
it does not establish ordinary AI success or a completed paid lifecycle.

Single-assistant scope review, not independent council consensus: preparing the
artifact saves an owner wait; the strongest countercase is accidental promotion
or testing against the wrong account. Isolation, exact build labeling, the
unchanged 109 draft, one existing internal tester and a separately confirmed
test-owner binding address those risks. Never promote 110 to the public draft.

Before purchase testing: confirm the disposable QA identity, bind that owner on
the server, register the SDK customer, verify the server binding, and have the
owner approve sandbox purchase dialogs. Do not delete the owner's personal
account, enable global billing, consume AI quota as a QA shortcut, or represent
synthetic fixtures as purchase evidence. Remove the QA binding after testing.

Record exact EAS/archive/Apple results after they exist; until then this file
does not establish compilation, upload, internal availability or installation.
