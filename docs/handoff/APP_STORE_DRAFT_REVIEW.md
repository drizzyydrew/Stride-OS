# App Store draft readback

## Owner completion readback — November 1, 2026 Pacific

The owner personally submitted banking and U.S. Form W-9 information, then
accepted the updated Developer Program agreement. A fresh Apple Developer
account reload records that agreement as **Issued October 29, 2026 / Accepted
November 1, 2026**. No agreement was accepted by the assistant.

Subsequent Business-page readback shows **Free Apps Agreement Active**, the bank
account **Active**, and **U.S. Form W-9 Active**. The earlier banking Processing /
24-hour banner and missing-information statuses below are superseded by these
observed statuses; their earlier timestamps remain historical evidence.

The separate updated Paid Apps Agreement was then opened with its checkbox
unchecked for the owner. The owner personally accepted it and reported completion.
Fresh Business-page readback now shows **Paid Apps Agreement Active**, **Free Apps
Agreement Active**, **bank account Active**, and **U.S. Form W-9 Active**; the
new-agreement banner is absent. This supersedes the earlier New Agreement
Available receipt. Neither agreement was accepted by the assistant. No public
review, release or production billing activation was performed.

Only status readback was needed; private taxpayer IDs and bank account values
were not requested, entered or recorded in this handoff.

## November 1, 2026 Pacific continuation

- Live Apple session is authenticated. The app remains **1.0 Prepare for
  Submission**; no public review, release, binary promotion or payment activation.
- Primary/secondary categories were previously unset. **Health & Fitness /
  Sports** were saved and read back on a subsequent page load.
- Age questionnaire: corrected Advertising to **No**; completed the newly
  unanswered Social Media and Social Media Disabled for Users Under 13 entries
  as **No**. The latter does not assert an age-check API is implemented. Existing
  No controls, unrestricted web, broadly distributed UGC and person-to-person
  messaging answers were retained. Existing Health/Wellness Yes, infrequent
  Medical Information and infrequent Contests were retained; other mature,
  sexual, violence and gambling answers retained their recorded None/No values.
  The final wizard Save completed and the app page still shows **13+** for the
  main region group. No higher-age override was selected. This is not clinical
  or legal clearance.
- App Privacy still says Published 4 months ago. The definite GPS linkage
  correction was prepared but **cancelled at the Publish boundary**; there is
  no separate saved draft in this editor. No label change is claimed. The
  source-backed draft and unresolved vendor/retention facts are in
  [`PRIVACY_LABEL_RECONCILIATION.md`](PRIVACY_LABEL_RECONCILIATION.md).
- Apple Business explicitly requires the Account Holder to review/accept an
  updated Developer Program License Agreement. Free Apps Agreement reads
  **Active (New Agreement Available)**; Paid Apps Agreement reads **Pending User
  Info**. The page says a bank account must be added and tax forms are incomplete;
  U.S. Form W-9 reads **Missing Tax Info**. No terms were accepted or banking/tax
  values entered. The owner was asked to complete those direct Apple actions.
- The Regulated Medical Device declaration is unanswered (both Yes/No unselected).
  The dialog was inspected and closed without submission. App-level DSA reads
  non-trader; the Business page also warns about EU trader requirements. The
  current five app territories were not expanded to the EU, and those status
  messages do not establish worldwide compliance or a legal trader conclusion.
- Supported CLI readback freshly reconfirms Build **106 VALID / IN_BETA_TESTING**,
  not expired, with exact build/submission IDs in `BUILD106_RELEASE.md`. Actual
  installation, device acceptance and sandbox lifecycle acceptance remain open.
- Screenshots of the saved category page and owner Business blockers were kept
  locally under `/tmp`; the latter contains owner contact details and is not
  committed. No customer records or private keys were inspected.

## Earlier read-only metadata pull

October 31, 2026 Pacific / November 1 UTC. A supported EAS CLI metadata pull
completed successfully for the existing StrideOS production submit profile.
It did not modify App Store Connect. Raw metadata and downloaded screenshots
were kept outside the repository; reviewer credentials are not reproduced here.

Verified saved fields:

- English (U.S.) name: `StrideOS: Run, Lift, Recover`; subtitle:
  `Your plan. Your pace.`
- The saved 1,819-character description uses the safer training/measurement/AI
  disclosures in `docs/app-store.md`, with privacy, terms and support links.
- Screenshot slots contain five iPhone 6.5-inch, three iPad Pro 12.9-inch and
  four Apple Watch Ultra images. Presence does not prove current-build accuracy,
  image quality, privacy review or full device/slot coverage.
- First release remains manual (`automaticRelease: false`). No public review
  or release was requested.
- Reviewer contact, demo username/password and demo-required fields are saved.
  The pull did not test those credentials or establish that this is an isolated
  account containing only synthetic data. Reviewer notes are empty.
- The current age questionnaire includes health/wellness, infrequent/mild
  medical information and contests, and advertising marked present. This is
  readback, not acceptance of its accuracy; reconcile each answer with actual
  released behavior and the current questionnaire before submitting.

Still requires acceptance: current screenshots and selected binary, an isolated
working reviewer account and clear review instructions, truthful privacy labels
and age answers, agreements/tax/banking, subscription review assets/lifecycle,
availability and final public-release approval. The metadata pull does not verify
all those fields. Public policy pages were separately published and verified in
`DELETION_ACCEPTANCE.md`.
