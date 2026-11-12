# App Store preparation alongside candidate 115

This prepares the next review packet; it does not submit public review, change
the selected public binary, or assert that the app is completely launch-ready.
The owner currently authorizes implementation, commit/push and an approved next
TestFlight candidate. Device/provider acceptance and the public-release decisions
remain distinct.

## Fresh readback

Official Apple API readback still shows public version 1.0
`7f934645-486b-478c-9a6e-1d396e86782d`, PREPARE_FOR_SUBMISSION, MANUAL release,
selected build 109 / VALID. Reviewer detail
`8a4b651d-dc9d-48bf-8771-1a273ee76c63` still requires a demo account and has
nonempty private username/password and contact name/email/phone fields. Presence
is not successful native reviewer login. The saved 1,293-character notes hash is
`aef87178d22f776f70cb04f2cedbc16f3555d1720124bb782ee3a64a1ed18433`.
No private field value is copied here and no Apple field was changed.

The four existing public pages now also work on the owned domain:

- https://strideosfitness.com/
- https://strideosfitness.com/support.html
- https://strideosfitness.com/privacy.html
- https://strideosfitness.com/terms.html

The old GitHub Pages links continue working. Policy content is unchanged, so this
does not imply a new privacy acceptance or authorize silently changing Apple's
saved policy URLs. Exact source/destination hashes are in
`password-autofill/deployment-readback-20261111.json`.

## Candidate-matched materials

`BUILD115_OWNER_TEST_GUIDE.md` gives the next device order and
`BUILD115_TESTFLIGHT_NOTES.txt` is the proposed beta testing text. The approved
badge family remains 800m, 1 Mile, 5K, 10K, 13.1 and 26.2; full event names remain in UI.
The prior `store-package-20261105/` retains the metadata, saved-description
readback, proposed Watch/PR additions and separate billing-off/paid review drafts.
Do not represent those proposed additions as already saved to Apple.

Before final public review notes are saved, update the billing-off navigation
paragraph to reflect the visible Running → Active quick-start path, the compact
Training options disclosure, and identity editing from the profile header.
Describe pre/post-recording race links only after the exact candidate is accepted.
Use the existing private reviewer fields; do not copy credentials into a note,
repository, screenshot or chat. Basic review can use fictional profile/manual-log
information in that dedicated review context, without personal Health media.

The deletion placeholder in the prior draft remains an explicit unresolved gate.
Replace it with observed provider/device behavior only after an approved
disposable-account test. Do not publish a placeholder or promise instant erasure.
If subscriptions will launch, reconcile the separately accepted paid binary,
purchase/restore/renewal/expiry/revocation outcomes, product review screenshots,
server notifications and privacy scope first. Normal 115 keeps purchases off.

## Finalization still requires evidence

1. Accept the exact phone/Watch candidate, including the reported crash scenario;
   source tests, browser fixtures and cloud compilation are different proof.
2. Confirm real signup/email/native return and the restricted reviewer flow in a
   clean test context without resetting the owner's ordinary history.
3. Complete the separately approved disposable-account deletion acceptance.
4. If paid launch is chosen, complete the coordinated current paid lifecycle;
   do not attach historical QA112 as the current public binary.
5. Capture genuine current screens and reconcile the required Apple screenshot
   wells; synthetic QA fixtures are not store screenshots. Keep iPhone-only host
   support and supported Watch scope accurate.
6. Reconcile privacy/age/export/territories/reviewer notes against that exact
   accepted binary, retain daily owner support coverage, and close the documented
   operational and naming decisions in CURRENT_LAUNCH_STATUS.md.
7. Obtain the final public submission decision, then the manual launch decision
   after Apple approval. Verify the actual public listing and first-launch state.

No purchase, open signup, paid-domain add-on, public submission or public launch
was performed as part of this preparation.
