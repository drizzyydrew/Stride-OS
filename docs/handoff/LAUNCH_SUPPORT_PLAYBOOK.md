# StrideOS launch support checklist

Use the existing support inbox, mooredrew5@gmail.com, to handle launch questions.
The authentication sender at auth.strideosfitness.com is for automated email;
it is not a staffed support mailbox. Keep customer details in restricted support
records rather than source control or public issue trackers.

## Owner-confirmed initial coverage — November 3, 2026

Drew Moore will handle initial launch support and check the existing Gmail
support inbox daily. This is the owner's stated coverage commitment. No backup
handler or public response-time guarantee is assigned. See
`SUPPORT_COVERAGE_CONFIRMATION_20261103.json` for the decision receipt.

## Gmail queue setup — November 3, 2026

The existing support Gmail account was verified through the connected profile.
The following empty labels were created and read back, each with zero messages:
StrideOS Support, StrideOS Support/New, StrideOS Support/Investigating,
StrideOS Support/Waiting on user, and StrideOS Support/Resolved.

Use New for intake, Investigating when a handler is actively working the issue,
Waiting on user after a specific follow-up is sent, and Resolved after the
recorded outcome is confirmed. Apply one status label at a time. Keep the email
thread as its existing correspondence record; a label does not require copying
the message or its attachments into Git or a new case database. Do not change
retention, access or delete correspondence merely to move its status.

No customer message was read, moved, labeled, exported or sent during setup.
No auto-reply, mailbox filter, response deadline or automated monitoring was
enabled. The owner subsequently confirmed the daily coverage above. Retention
and the other custody/access decisions below remain open.

## Proposed custody and coverage — not operational acceptance

The owner has accepted initial support coverage. This playbook's remaining
handling steps do not establish approved case storage, a verified identity
procedure or a retention policy.
The existing inbox is a contact route, not proof that its access, backups or
retention have been reviewed. Do not create additional customer-data copies or
give a reviewer access until the owner records the decisions below privately.

| Decision required before operation | Private record to complete |
| --- | --- |
| Initial handler and coverage | Confirmed: Drew Moore handles support and checks the existing Gmail inbox daily; no backup designated or public response-time promise |
| Storage | Exact owner-approved private case location outside Git/public trackers, how it is protected and backed up, and a case-reference-to-contact mapping kept only there; no location is approved here |
| Access | Named people, necessary scope, authorization, expiry/review date and removal evidence; no shared public links or broad reviewer mailbox access |
| Permitted tools and transfers | Approved tools/recipients and minimum redacted evidence each needs; no customer records in AI tools, personal accounts, external tickets or contractor systems without explicit approval for that use |
| Confidentiality and outside review | Written confidentiality, approved tools/subprocessors, access expiry and return/deletion terms before case evidence is supplied; the review brief alone does not establish these terms |
| Retention and disposal | Owner-approved purposes and periods for messages, attachments, case notes and backups; authorized exceptions/holds, responsible person and verified disposal/return procedure; all remain undecided here |

Use a case reference rather than contact details in any redacted engineering
handoff. Do not forward an entire thread or export a mailbox for convenience.
If unnecessary sensitive material arrives, restrict access and escalate to the
custodian for an authorized handling decision; do not circulate it, invent a
retention deadline or promise that every provider copy has been erased.
No cases, access grants, storage folders or retention controls are created by
this checklist. Custody decisions still require approval and verification.

## Collect a useful report

Ask for the app version/build, device and operating-system version, approximate
time and time zone, steps taken, expected result, actual result, and visible error.
A screenshot is optional and should hide account details, routes and health data.
Never request passwords, reset links, one-time codes, API keys, deletion recovery
secrets, raw health exports or private video in the initial report.

Record each report with these fields:

| Field | Entry |
| --- | --- |
| Private case reference | A unique support reference |
| Category | Sign-in, saved data, recording, billing, deletion, AI, appearance or other |
| Impact | Who is affected and which action is blocked |
| Candidate | App build and operating system |
| Reproduction | Steps, observed result and error text |
| Handling | Owner, next action and next update |
| Custody | Approved private location, authorized recipients and applicable retention/hold decision; record undecided items as pending |
| Resolution | Fix or workaround, verification and customer confirmation |

Do not promise a response or restoration deadline until someone is assigned and
the underlying behavior is understood.

## Handle urgent problems first

| Problem | First response |
| --- | --- |
| Suspected cross-account access or disclosure | Escalate first to the assigned incident lead/owner and recommend holding the affected release or feature. Only an authorized operator may change the exposure path. Preserve narrowly scoped evidence; do not ask for another person's records or copy them to demonstrate the issue. |
| Missing or duplicated workouts | Keep the installation and existing records. Collect the case details before resets, reinstalling, reimporting or manual database edits. |
| Purchase succeeded but access is missing | Confirm the app build, store account context and displayed error. Use the in-app restore path when available; check the matching customer and store events privately. Do not manually grant access based solely on a screenshot. |
| Password link failed | Use the newest email and request a fresh link if expired or used. Ask for the displayed message, not the link. Keep the installed app and its history. |
| Deletion is pending | Collect only the visible reference, build and displayed stage. Point to the app's status/retry guidance. No approved manual identity-verification procedure is established here: hold manual account actions and escalate to the owner until a scoped procedure is approved and validated. An email address, screenshot or request reference alone is not identity proof. Never collect the private recovery secret. |
| AI guidance seems wrong or unsafe | Ask the user to stop following the affected guidance and report the non-sensitive context needed to investigate. Clinical or emergency concerns require appropriate professional care. |

## Proposed escalation procedure

1. Intake only the minimum report above. If no custodian, private case location
   or authorized handler is assigned, record that operational gap with the owner
   without copying customer content into a new tool. Do not represent the case
   as actively investigated or promise a reply time without an assigned handler.
2. Triage suspected disclosure, wrong-account access, data loss and unsafe AI
   guidance before cosmetic issues. Record suspected versus reproduced behavior,
   affected build, impact, last known safe state and the evidence still needed.
   A suspected serious issue needs escalation even when reproduction is pending.
3. For identity-dependent access, exports, deletion or entitlement changes,
   require an owner-approved, validated ownership-check procedure and explicit
   authority for the particular action. Until both exist, give safe navigation
   help only. Do not reset credentials, transfer records, grant access or delete
   an account from an email assertion. The authenticated in-app deletion flow
   remains subject to its separate acceptance and authorization gates.
4. Give the owner/assigned lead a redacted case reference, impact, proposed
   containment, operator needed and next evidence step. Request qualified review
   where needed; this is not permission to hire, contact third parties, change
   production, disable services or send customer messages. Record any authorized
   action and its result separately from the recommendation.
5. Reproduce with fictional/disposable data where possible. Record the exact
   deployed or installed build and verified outcome before offering a workaround
   or marking a fix accepted. Keep unresolved questions open; customer confirmation
   and technical evidence are separate fields. Close access and dispose/return
   working copies only under the agreed custody terms, recording what was verified.

## Reply templates

Initial response:

> Thanks for reporting this. Please send your StrideOS build, device/OS version,
> approximate time and time zone, and the steps that led to the problem. Include
> the displayed error if there is one. Please leave out passwords, reset links,
> codes, private routes and health records. Keep the app installed while we check
> any saved-data issue.

Progress update:

> We have recorded your report under [case reference]. We are checking
> [specific behavior]. [Verified workaround, if available.] We will update you
> when we have a verified result or a specific next step.

Resolution:

> [Specific behavior] is corrected in [verified build or service change]. Please
> [safe verification step]. Let us know whether that resolves your report. Your
> case will stay open until the remaining issue is understood.

Replace brackets with verified facts before sending. These are drafts; no
customer messages or new support accounts have been created.

## Proposed monitoring before and after release

Assign a person and approved read-only access before using this checklist. The
proposed cadence is a check at the beginning and end of each assigned coverage
period, plus a check after an authorized change or serious report. The owner must
choose actual coverage and cadence; no continuous monitoring or response SLA is
claimed. Establish a baseline from permitted evidence rather than inventing a
failure-rate threshold. Do not enable telemetry or run a transaction to fill a row.

| Signal to review | Trigger and proposed response |
| --- | --- |
| Account isolation and sensitive-data exposure | Any credible wrong-account/disclosure report: escalate immediately when observed to the assigned lead/owner; recommend holding the affected release/feature pending evidence and an authorized containment decision |
| Sign-in and account email | Repeated comparable failures or a reproducible blocked return: record build, time and failure stage; escalate without requesting passwords, codes or reset links, sending test email, or reopening signup |
| Recording, save and restart | Any report of lost/duplicated work: preserve installation and records; compare redacted reports by build; do not recommend reinstall/reset as the first repair |
| AI availability and spending | Failed requests, unsafe guidance, quota/spend warnings or inability to verify cap scope: escalate with permitted aggregate evidence; a saved cap is not proof of enforcement. Only an authorized operator may change service access |
| Purchases and entitlements, only if enabled and accepted | Successful purchase without matching access or contradictory lifecycle state: escalate using authorized private store evidence; do not buy, grant access or switch on billing for this check |
| Deletion stages | A reported error, unresolved provider/cleanup stage or lack of an assigned handler: record reference and stage, escalate; do not call a request completed, invent a processing deadline or run manual deletion |
| Support backlog and custody | An urgent unassigned case, missed agreed next update, access beyond its approved expiry or an undecided retention/hold: escalate to the custodian/owner; do not silently extend access or duplicate case records |

For each check record time/time zone, observer, build/service scope, permitted
evidence source, observed result, assigned next action and next agreed check in
the approved private location. An unavailable source is an evidence gap, not a
healthy result. Review customer diagnostics only with the applicable permission;
use redacted reports where telemetry is declined or unavailable.

Before release, confirm the inbox is accessible, the public support link works,
the final reviewer login works, a person owns support coverage, and the accepted
candidate and release controls are recorded. Keep a route to disable optional
AI or billing functionality if its verified operating behavior requires it.

After release, inspect actual crashes, sign-in/email failures, save failures,
purchase/access mismatches, deletion stages and service spending. Review only
the diagnostics users have permitted. Keep changes scoped, record what was
deployed, and verify the resulting behavior before calling a report resolved.
