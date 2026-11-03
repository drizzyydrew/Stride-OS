# StrideOS launch support checklist

Use the existing support inbox, mooredrew5@gmail.com, to handle launch questions.
The authentication sender at auth.strideosfitness.com is for automated email;
it is not a staffed support mailbox. Keep customer details in restricted support
records rather than source control or public issue trackers.

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
| Resolution | Fix or workaround, verification and customer confirmation |

Do not promise a response or restoration deadline until someone is assigned and
the underlying behavior is understood.

## Handle urgent problems first

| Problem | First response |
| --- | --- |
| Suspected cross-account access or disclosure | Stop the affected release or exposure path, preserve narrowly scoped evidence, and arrange qualified security/privacy review. Do not ask for another person's records. |
| Missing or duplicated workouts | Keep the installation and existing records. Collect the case details before resets, reinstalling, reimporting or manual database edits. |
| Purchase succeeded but access is missing | Confirm the app build, store account context and displayed error. Use the in-app restore path when available; check the matching customer and store events privately. Do not manually grant access based solely on a screenshot. |
| Password link failed | Use the newest email and request a fresh link if expired or used. Ask for the displayed message, not the link. Keep the installed app and its history. |
| Deletion is pending | Follow the existing deletion receipt and status process. Verify identity through the approved process before any manual action; never treat an email address alone as authorization. Preserve the private recovery secret. |
| AI guidance seems wrong or unsafe | Ask the user to stop following the affected guidance and report the non-sensitive context needed to investigate. Clinical or emergency concerns require appropriate professional care. |

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

## Before and after release

Before release, confirm the inbox is accessible, the public support link works,
the final reviewer login works, a person owns support coverage, and the accepted
candidate and release controls are recorded. Keep a route to disable optional
AI or billing functionality if its verified operating behavior requires it.

After release, inspect actual crashes, sign-in/email failures, save failures,
purchase/access mismatches, deletion stages and service spending. Review only
the diagnostics users have permitted. Keep changes scoped, record what was
deployed, and verify the resulting behavior before calling a report resolved.
