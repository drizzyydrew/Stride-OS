# Support custody and retention operating standard

November 3, 2026. Prepared and adopted as internal defaults under Drew's request
to finish the remaining desktop work without him. This records a handling policy;
it does not certify mailbox security, execute disposal or accept account deletion.

## Custody and permitted use

- Drew Moore is the designated custodian and initial support handler. He checks
  the existing `mooredrew5@gmail.com` inbox daily, as directly confirmed.
- Keep correspondence in its original Gmail thread with the existing StrideOS
  Support status labels. No second case database, contact mapping, mailbox export,
  local attachment archive or additional backup is designated or created.
- No other handler, contractor or reviewer is authorized to receive customer
  correspondence. Do not share the mailbox or send case data to AI tools,
  public trackers, source control or external ticketing systems. A future
  recipient needs a scoped authorization and custody terms before access.
- Use a fictional reproduction or redacted case reference for engineering.
  Collect only build/device/time/error/reproduction facts. Do not request health
  exports, routes, passwords, reset links, codes or private recovery secrets.

This is the access standard, not a finding that existing MFA, delegation,
forwarding, mail clients, sessions or provider backup controls were audited.
Those controls remain unverified. No permissions or settings changed in this pass.

## Retention schedule

| Record | Purpose and review rule | Disposal or exception |
| --- | --- | --- |
| Active support correspondence | Resolve the reported issue. Review necessity during the daily triage and at least monthly while open. | Minimize unnecessary sensitive material earlier; do not retain it just because the case is open. |
| Routine resolved correspondence, including routine billing/deletion questions | Short follow-up and regression investigation. Review no later than 90 days after the documented resolution date. | When no current purpose or specific hold remains, Drew manually disposes of the eligible messages. Earlier disposal is appropriate when the purpose ends sooner. |
| Specific dispute, incident or unresolved deletion evidence | Keep only the portion needed for that documented matter. | Record purpose, scope, custodian and next review date; review at least every 90 days while the exception continues. No indefinite category-wide exemption. |
| Temporary screenshots or other working copies, if separately authorized later | Only the minimum evidence needed for the stated investigation. | Remove when that investigation no longer needs them; no default new download or export is authorized here. |
| Backend deletion completion/recovery records | Separate status recovery, retry integrity and cleanup verification purposes documented in `DELETION_ACCEPTANCE.md`. | Review necessity at least annually as an internal governance checkpoint. No purge/TTL is implemented; actual duration, applicable obligations and recovery effects remain to be assessed before changing these records. |
| Provider backups and store/vendor records | Provider-controlled systems, distinct from Gmail correspondence and app-owned active records. | No new backup or fixed erasure deadline is introduced. Actual backup configuration, lifecycle and disposal are not accepted by this policy. |

The 90-day review is a discretionary operating choice for a small launch inbox,
not a legal minimum, permission to retain unneeded data for 90 days, or a promise
that every copy is erased by day 90. A valid privacy request or known preservation
obligation needs its own scoped assessment; this schedule does not override it.
No legally binding retention obligation is inferred from a support category.

## Apply the rule to a real case

1. Use one status label at a time. Closure requires a recorded verified outcome
   and an explicit resolution date. A new related report reopens the case; use
   its next genuine resolution date for the next review.
2. Record the resolution and follow-up date in the ordinary resolution reply
   when that reply is appropriate. Gmail has no editable private case-note field.
   Do not send a placeholder/internal email or create an export just to track
   a date. If closure is not documented, review the thread manually; do not
   invent it from message age, `older_than:` or the Resolved label alone.
3. During the monthly queue review, inspect resolved cases already due and those
   due before the next monthly review, so none waits past the 90-day checkpoint.
   Dispose when there is no continuing purpose or hold. If retention continues,
   keep the minimum evidence and a reason, custodian and next-review date in a
   separately authorized private handling record before treating the hold as
   established. No private case-note store is created by this policy. Until such
   a record is available for an exception, escalate it to Drew; do not silently
   mark an indefinite hold as accepted or write sensitive reasons into labels.
4. Gmail cannot remove an attachment in place. Review whether its entire
   message can be disposed of while preserving other necessary correspondence.
   Do not export the thread or create replacement sensitive copies. A credential
   exposure requires an incident decision, not merely message disposal.
5. Check the exact selected messages and thread scope before any authorized
   disposal. Archive, removing a label and marking Resolved are not deletion.
   Gmail's normal Trash recovery period is up to 30 days; record Trash movement
   separately from permanent deletion. No Trash emptying or provider-wide erase
   is authorized or claimed by this preparation.

Manual access, exports, deletion, credential reset and entitlement grants still
require a validated ownership check and authority for the particular action.
The sender's email address, screenshot or request reference is insufficient.
The authenticated in-app flow retains its separate release acceptance gates.

## Evidence and remaining acceptance

Two independent council reviewers (data custody/first principles and contrarian)
reviewed the defaults, exchanged objections and agreed on the bounded policy.
Their strongest corrections were to use resolution date rather than message age,
avoid indefinite exception categories, account for Gmail's attachment limits, and
separate documented controls from verified settings. The chair adopted those
corrections. No legal-compliance conclusion was reached.

The existing Gmail labels and daily handler assignment were previously verified
or owner-confirmed. This pass accessed no support messages, created no customer
records, changed no mailbox permissions/retention setting, and ran no disposal,
automatic job or reminder. Future human execution is still necessary. Remaining
acceptance covers mailbox access/security configuration, any exception-record
location, manual identity verification, backend completion-record duration and
actual provider backups; ordinary support storage and routine review defaults
are no longer undecided.

Read-only StrideOS Supabase CLI backup inventory in this pass returned
`walg_enabled: true`, `pitr_enabled: false`, no available physical backups and
empty physical-backup data. This does not establish absence or erasure of all
provider copies. No tested restore or accepted recovery plan is established.

The FTC supports collecting only necessary information, limiting access, and
documenting retention and disposal; it does not prescribe this 90-day choice.
[FTC business guidance](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business).
Gmail documents Trash and individual-message disposal behavior.
[Gmail deletion guidance](https://support.google.com/mail/answer/7401?hl=en).
The published privacy page makes no fixed support-retention or backup-erasure
promise, so no public policy change was needed or published for these defaults.
