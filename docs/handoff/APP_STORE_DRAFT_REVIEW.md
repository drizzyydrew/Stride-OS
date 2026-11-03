# App Store draft readback

Current navigation: [Current launch status](CURRENT_LAUNCH_STATUS.md). Latest
internal candidate is 111; last verified public draft is 109/manual release.
The older build-1/108 observations below are historical and do not supersede that
readback. Current reviewer-note preparation is `APP_REVIEW_NOTES_111_DRAFT.md`;
it has not been saved to Apple or accepted as a complete submission packet.

## Historical publish preparation — November 1, 2026 late Pacific

This section records that session's readback. It superseded earlier observations
at the time, but does not supersede the current navigation above. Build selection,
credentials, assets and declarations below retain their original evidence scope;
do not repeat completed setup or use these old targets as current instructions.

- Apple session is authenticated. Version 1.0 remains Prepare for Submission;
  manual release remains selected. The draft still selects historical build 1;
  it must be replaced with an accepted candidate before public review.
- The public description now includes Goal archive and optional open training.
  Save completed and a fresh reload confirmed the exact paragraph. The current
  description is 2,027 characters. Marketing/support/privacy URLs are unchanged.
- Three genuine native iPhone placements are saved: Calendar week, Activity
  history, Strength presets, source Simulator 107 / `3e1513c`. Previous phone
  placements were removed without deleting their library assets. Watch/iPad
  legacy assets are preserved but not accepted as current. See the native-107
  manifest and `NATIVE_CAPTURE_BOOTSTRAP_FIX.md`.
- Existing restricted Apple reviewer credentials were checked against the
  isolated StrideOS backend using the public auth client, with no stored session.
  Result: **invalid_credentials (400)**. No password, email, token or customer
  record was printed or added to source. This initial failed credential pair is superseded by the owner correction below;
  presence of credentials alone was insufficient.
- Owner created a new dedicated user and updated Apple's restricted review
  fields. A fresh supported metadata pull and private no-session auth check now
  succeed against the isolated StrideOS backend (HTTP200). Credential mismatch
  is closed; ordinary native sign-in and reviewer navigation on 108 still need
  acceptance. No credentials or tokens are reproduced here.
- Medical-device declaration is complete: the owner confirmed general fitness
  only and no medical-device status. No was saved; Apple readback confirms the
  app is declared not a regulated medical device in any country or region.
  Current category/rating and notification configuration were not changed.
- Privacy-label reconciliation is now published and verified after a full reload:
  11 supported types, all linked, reviewed purposes, no tracking/unlinked preview
  or incomplete setup. See `PRIVACY_LABEL_RECONCILIATION.md`; future billing and
  support workflow changes still require reassessment.
- Production billing-off build 108 finished from `cf41d1a` as EAS
  `f647a146-5f2c-4ff9-b32d-ad15989c92c7`. Actual signed phone/Watch/widget
  checks passed; exact upload `d4180bb6-437f-426f-9aa2-365ef33f6ac3` succeeded.
  Apple now confirms 108 VALID / IN_BETA_TESTING internally, not expired.
  Actual device acceptance remains separate. See `BUILD108_RELEASE.md`.
- Reviewer navigation/permission/optional AI and billing-off instructions were
  saved in Apple; a fresh supported metadata pull verified the exact 1,293-character
  text. See `APP_REVIEW_NOTES_108.md`. No credential values are in that file.
  Add the accepted deletion steps before public submission.
- No Add for Review, Submit for Review, public release, asset-library deletion,
  purchase activation, or new service charge was performed.


## Historical store URL and asset continuation — November 1, 2026 Pacific

All four existing public pages returned HTTP 200. The homepage's fake download
buttons, old screenshot display and overbroad media wording were corrected and
published at the same marketing URL, separately from the app branch. Uncached
readback matches the new source exactly. Support, privacy and terms are preserved;
no new domain or paid service was purchased. See `STORE_URL_REVIEW.md`.

The brand-only `01-hero.png` placement was removed from version 1.0/en-US through
Media Manager, with the file retained in Asset Library. Fresh reload shows four
remaining original-size iPhone placements and no hero in the scaled sequence;
the exact library asset still opens. Other images remain historical/unaccepted
as current. A six-iPhone / three-to-four-Watch replacement storyboard and
conditional iPad plan are in `STORE_ASSET_REFRESH.md`. No asset/app review,
public release, billing activation or library deletion occurred. At the owner's
request for actual-app replacements, one isolated simulator capture build
`05c212a2-9c70-4da6-886e-e79b6470ac81` was subsequently queued from Build 106
source using existing EAS allowance. It is not a new TestFlight submission or
physical-device acceptance. Native installation, clean test-account access and
replacement capture/upload remain unproven; see both linked continuation records.

Actual native sign-in on that fresh capture installation subsequently exposed a
first-login blocker: athlete-store hydration persisted seeded defaults, which
the unchanged ownership guard correctly quarantined as unclaimed data. The
producer correction and 21 focused regression cases are implemented and have
passed independent scoped re-review. All 1,447 broad tests, semantic TypeScript
and Expo dependency checks passed on the final source. Build 107 is prepared;
its native acceptance remains pending. Do not submit Build 106 publicly
or classify the replacement set as ready on the strength of a storyboard.
See `NATIVE_CAPTURE_BOOTSTRAP_FIX.md` for exact observations and boundaries.

## Historical owner completion readback — November 1, 2026 Pacific

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

## Historical November 1, 2026 Pacific continuation

Earlier pending declarations, privacy publication and financial setup in this
section were superseded by the completion receipts above. They are not new
owner tasks. Use [Current launch status](CURRENT_LAUNCH_STATUS.md) for open work.

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

## Historical read-only metadata pull

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

At this historical checkpoint, outstanding acceptance included current screenshots
and selected binary, an isolated working reviewer account and clear review
instructions, truthful privacy labels
and age answers, agreements/tax/banking, subscription review assets/lifecycle,
availability and final public-release approval. The metadata pull does not verify
all those fields. Public policy pages were separately published and verified in
`DELETION_ACCEPTANCE.md`.
