# Remaining launch work with outdoor QA deferred

The owner explicitly deferred the build 111 outdoor/locked-screen recording test.
Keep that acceptance open and continue independent work. The owner-reported
closed-app password-reset retest is accepted only for that reported flow.

November 3 desk continuation: Confirm email is now saved ON with public signup
still OFF. The earlier both-off observation below is historical. See
`DESK_PREPARATION_20261103.md` for completed preparation and the laptop-only
Sandbox tester form ready for private owner completion.

## Earlier read-only checks

- Apple build 111 detail still shows the existing internal Team (Expo) group,
  one tester and the saved reset-test notes. No build/group/tester was changed.
- Public version 1.0 remains Prepare for Submission, selects build 109 and has
  manual release selected. No review submission, build replacement or release.
- The iPhone screenshot sequence contains three genuine native placements:
  `02-calendar-week.png`, `04-activity-history.png`,
  `06-strength-presets.png`. Earlier provenance is capture build 107; the fresh
  placement readback does not establish that these represent every build 111
  screen or accept the historical Watch/iPad media.
- Supabase's Allow new users to sign up and Confirm email switches are both off.
  Apple and Google providers show Enabled. Custom SMTP remains enabled.
- A read-only aggregate query against the isolated StrideOS project returned
  three Auth users, all with a non-null email confirmation timestamp. This is
  not inbox-ownership proof: earlier auto-confirm/admin creation may set that
  timestamp. No identities, passwords, records or settings were changed.
- Verified HTTPS HTTP 200 for the current homepage, support, privacy and terms
  URLs at `https://drizzyydrew.github.io/Stride-OS/`. Python's local trust store
  initially lacked its issuer; system curl verified all four without disabling
  certificate verification. No domain migration or website deployment.

## Indoor order and owner involvement

| Work | Agent can complete | Owner needed |
| --- | --- | --- |
| New-account confirmation | Audit and prepare the confirmation policy and a controlled test; keep public signup closed until accepted | Privately enter a dedicated test identity/password, open its confirmation email, and confirm successful native return/sign-in |
| Apple/Google and deletion | Prepare provider checks, disposable-identity scope and backend acceptance readback | Native provider prompts; explicitly approve deletion of the identified disposable test account; never use retained personal history |
| Purchases | Recheck product/entitlement/offering configuration and prepare an isolated current QA candidate; keep global billing off | Sandbox purchase/restore dialogs and observed access status; expiry/renewal/refund acceptance takes additional elapsed time |
| Store assets and listing | Audit metadata and genuine capture coverage; prepare truthful replacements with provenance; preserve library originals | Native capture assistance only if remote access is unavailable, plus final visual choices |
| Final package | Reconcile the accepted binary, privacy disclosures, review instructions and remaining receipts | Final submission/release decision after open acceptance gates pass |

The existing private billing QA build 110 predates the reset fix. Do not replace
the public draft with it or tell the owner to reinstall it as the normal app.
The historical production Apple notification API TEST 401 remains unresolved;
sandbox delivery previously passed. Do not release early or rotate a working
key merely to clear a possible pre-release API eligibility restriction.

Outdoor recording, Watch disconnection, Health permissions/recovery, offline and
restart persistence remain required device checks. No whole-device acceptance is
inferred from the reset pass. No human audit/legal review has been purchased or
completed. This checkpoint changes documentation only, not launch readiness.
