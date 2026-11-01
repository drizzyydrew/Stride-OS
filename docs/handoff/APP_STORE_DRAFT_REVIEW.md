# App Store draft readback

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
