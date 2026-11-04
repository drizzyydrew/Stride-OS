# Store packet — prepared for review

This is a local draft package. It has not been uploaded or published and is
not ready for submission. The manifest records the remaining acceptance gates.

- `metadata.json` maps the listing fields and recorded candidate identities.
  Title, promotional text, keywords and the 2,027-character description come
  from the earlier November 3 Apple readback. Browser reconnection/control
  errors prevented a fresh field pull during this pass. Subtitle is unknown
  here; it was not guessed from the website tagline.
- `description.txt` is the recorded listing text, kept separate for review.
- `review-billing-off.txt` is a concise billing-off reviewer draft.
- `review-paid.txt` is the source-mapped purchase/restore reviewer draft.
- `privacy-paid.json` describes the proposed purchase-enabled label overlay.
- `manifest.json` contains byte hashes, field lengths and submission holds.

The reviewer files contain explicit deletion/purchase placeholders. Replace
them only with accepted outcomes, then recheck the 4,000-byte review-notes limit.
Match one notes variant to the final normal binary. Normal internal 111,
private QA112 and the saved draft 109 are different artifacts. QA112 must not
be selected as the normal public release candidate; 109 lacks the reset fix.

Keep reviewer credentials in Apple's restricted fields. There are no credentials
in this package. A field-length pass does not establish native behavior, correct
screenshots, product availability or App Review acceptance.

Field limits were checked against Apple's
[platform-version reference](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)
and [app-information reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information).
Keywords and reviewer notes are checked as UTF-8 bytes. Name, promotion and
description are checked as character counts. The billing-on privacy reasoning
and source map are in `../SUBMISSION_PREPARATION_20261103.md`.
