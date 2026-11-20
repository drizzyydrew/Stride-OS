# Apple readiness check for candidate 122 — November 19, 2026 Pacific

The checks are complete within the recorded scope; public launch is **not ready**. API reads and a signed-in App Store Connect browser verified the actual destination. The browser session subsequently expired during a privacy draft edit. No public review or release occurred. No images were created, edited, removed or uploaded.

## Verified at Apple

- Public iOS 1.0 remains **PREPARE_FOR_SUBMISSION / MANUAL**, selecting **109**. Preflight found 121 VALID and no existing 122 build upload; delivery of 122 is tracked separately by the release receipt.
- Paid Apps and Free Apps agreements are **Active** through June 20, 2027. Bank account, U.S. W-9 and DSA statuses are **Active**. No financial information was changed; private financial details are intentionally absent from this receipt.
- Both existing products have 14-day free trials in USA, Canada, Australia, New Zealand and the UK. U.S. customer prices remain $9.99/month and $79.99/year. Each subscription is **MISSING_METADATA** and has **no App Review screenshot**. Descriptions still mention AI Coach only; they should describe the current paid training bundle.
- Reviewer username/password and contact fields are populated. This proves presence, not working reviewer authentication. Current review notes still state subscriptions are disabled, which is unsuitable for the paid candidate. A credential-free replacement is staged in BUILD122_REVIEW_NOTES_DRAFT.md; it has not overwritten notes for selected 109.
- Dating and Relationships and Shared Location were previously unanswered. Both are now **false**, with exact readback at 2026-11-20T02:55:55Z and every other declaration field unchanged. Apple's direct GET resource returned 403; reading through the documented appInfo relationship succeeded. The PATCH and relation readback succeeded.

## Privacy: one correction remains unsaved

The signed-in App Privacy page showed eleven linked data types: Fitness, Name, Email Address, Photos or Videos, Other User Content, User ID, Precise Location, Health, Product Interaction, Crash Data and Other Diagnostic Data. **Purchase History is missing.** RevenueCat requires it, even though Apple receives the payment-card information. Source confirms RevenueCat is configured with the authenticated account identifier.

Prepared answers: Purchase History → **App Functionality and Analytics**, **linked to identity**, **not used for tracking**. The last answer assumes the inspected no-ad-tracking setup remains unchanged. Existing labels are broad; this check does not attest every other collection/purpose/linkage classification.

The Data Collection edit dialog opened, but Next redirected to Apple login. A fresh privacy navigation also remained at login. No Purchase History change was saved or published. This is a concrete remaining Apple-session blocker, not a completed correction. The next signed-in session should save a draft only, verify the answers, and leave Publish for the later public-release preparation decision.

Age answers follow Apple's current definitions. StrideOS has no dating connection or romantic/sexual companion features. Its GPS and maps are private to the owner; inspected Story sharing exports a normalized route silhouette through the system image share sheet, without coordinates or geographic labels. The inspected Strava activity upload sends time/distance, not route or current position. No person-to-person live, ongoing or group location-sharing capability was found. The Shared Location answer is an inference from that current source scope, not a claim that GPS permission is absent.

## Existing screenshots only

Apple has three iPhone 1206×2622, three iPad 2064×2752 and four Watch 422×514 assets in COMPLETE delivery state. The old APP_IPHONE_65 set is empty. Current Apple guidance names medium Dynamic Island iPhone and iPad 13-inch as the required sizes; the uploaded dimensions are listed in that specification. The same page retains legacy large-display fallback wording, so final App Store validation should settle size coverage when submission is authorized. An empty old 6.5-inch set alone is not established as a current blocker.

Visual review found a more important problem: uploaded iPad marketing mockups use the obsolete Today/Training/Running/Profile navigation and a Coach Note design; Watch mockups show Readiness/Primed and a different workout/metric layout from the current native Start from iPhone and metric pages. These are not validated representations of the final interface. The three native iPhone calendar/history/preset captures predate 122; they do not demonstrate its new features. Both subscription review images are absent. These remain unresolved under the owner's image-change hold.

The separate Desktop package is still present: all sixteen candidate exports match their recorded hashes, eight at 1290×2796 and eight at 396×484. Its manifest explicitly identifies fictional sample data, no Apple approval, no native large-device recapture and no public upload. These are edited marketing illustrations, not new native captures or clinical/sensor/reliability evidence. No package was uploaded in this check.

## Public pages

The Apple-listed GitHub Pages privacy, terms and support URLs each returned HTTP 200 and exactly matched repository files. The separate strideosfitness.com versions returned HTTP 402. Apple currently points to the working GitHub Pages URLs. The terms describe the paid training bundle and twenty AI requests per UTC day; the pages still disclose that automatic account-deletion processing is disabled while release acceptance continues. Deletion acceptance remains a separate launch gate, not closed by this disclosure.

## Remaining public-launch gates

1. Complete and verify account signup, reviewer access and actual server-side deletion; backend billing/quota/cost checks have separate receipts.
2. Save and verify the Purchase History privacy correction once Apple UI access is restored.
3. Resolve subscription MISSING_METADATA, both missing product-review screenshots and narrow subscription descriptions. The image hold remains effective.
4. Reconcile the accepted public candidate, paid review notes, store description and accurate existing image selection before any public submission. Selected 109 and the old disabled-purchase notes must not be treated as candidate 122.

Machine-readable evidence: BUILD122_APPLE_READINESS.json. This receipt contains no keys, tokens, reviewer credentials, financial account details or private addresses.

Sources checked November 19, 2026:

- [Apple age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [RevenueCat Apple App Privacy guidance](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
- [Apple subscription review screenshot resource](https://developer.apple.com/documentation/appstoreconnectapi/subscription-app-store-review-screenshots)
