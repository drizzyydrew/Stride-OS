# Launch preparation — November 20, 2026 Pacific

Update November 21 Pacific: the owner clarified the image hold, council approved actual native captures, all six uploads are COMPLETE, both subscriptions are READY_TO_SUBMIT, and all ten obsolete images were removed. The later browser staging step placed the app, group and both subscription versions into one READY_FOR_REVIEW draft; all four exact relationships were independently verified, submittedDate is null and release remains MANUAL. Submit for Review was not clicked. See BUILD123_SCREENSHOT_CAPTURE_PLAN.md and BUILD123_SCREENSHOT_COMPLETION.json. The dated evidence below retains its original scope.

The remaining server work is completed within the live acceptance scope below. Apple version 1.0 selects Build 123 and remains a manual-release draft. Public App Review was not submitted. Submission is still held for the required screenshot work under the owner's explicit instruction not to change/add images; a narrow exception has been requested.

## Verified at the destination

| Area | Result and evidence |
| --- | --- |
| Auth recovery | One official project restart restored actual Auth/database responses. No reset, upgrade, key rotation or owner-data change. `LAUNCH_20261120_BACKEND_RECOVERY.json` |
| Signup and reviewer | Public signup enabled; confirmation stays on, anonymous/manual linking off. Actual signup email, confirmation redirect, password login and same-fixture recovery passed. Existing protected reviewer login passed. `LAUNCH_20261120_SIGNUP_DELETION_ACCEPTANCE.json` |
| Deletion | Narrow SQL predicate restores social-only provider actions. A real worker removed the disposable account/profile, inventory was zero, Auth absent and old JWT rejected. Global automation is enabled with explicit-null scope, existing public gateway key and one active minute cron; actual reviewer GET and ordinary cron run passed. No reviewer/owner deletion was requested. Same receipt plus `LAUNCH_READINESS_20261120_DELETION_MIGRATION.json` |
| Paid server | Billing enforcement true, QA override absent, JWT on, six final source files exact at runtime v22. Real inactive/revoked denial and active public 200 verified. One model request only; usage 0→1, no retries. `LAUNCH_PAID_SERVER_20261120.json` and `LAUNCH_READINESS_20261120_AI_DEPLOYMENT.json` |
| AI operating cost | Deployed key's organization matched the existing Console organization and $20/month cap. One event: 124 input/36 output tokens, zero cache, estimated base-price $0.000304. The 20/account/day and 500/global/day reservations remain unchanged. `LAUNCH_AI_CAPACITY_20261120.json` |
| Reviewer paid access | Existing reviewer has no-charge, nonrenewing promotional Pro until 2026-12-22T01:12:35Z. Apple notes explain that no purchase is required to inspect paid features. Credentials unchanged. `LAUNCH_READINESS_20261120_APPLE_DRAFT.json` |
| Apple metadata | Current training-bundle subscription descriptions saved/read back. Purchase History disclosure published/read back. VALID Build 123 attached to public 1.0; PREPARE_FOR_SUBMISSION / MANUAL. Existing five territories unchanged; Mainland China unavailable. `LAUNCH_READINESS_20261120_SUBSCRIPTIONS.json`, `...PRIVACY.json`, `...TERRITORIES.json` |
| Public pages | Only deletion-availability statements changed in privacy/support/terms. Pages commit 9b36cafc51fd5a6983427c16349c9ebba1865373, workflow 44849484029 succeeded; actual HTTPS200 bytes match canonical source for all three pages. `LAUNCH_READINESS_20261120_PUBLIC_PAGES.json` |

## Validation

The deletion/Apple-grant regression lane passed 60 tests with no failures/skips; independent SQL/fulfillment review passed 31. The final provider/capacity/paid regression lane passed 68 tests and Deno checks; independent subsets passed 48 and 21. These subsets overlap and are not summed. The canonical `npm run typecheck` passed after the final runtime code. `git diff --check` passed. Build 123's earlier 2,170-test/native archive evidence retains its original scope; no new app binary was necessary for server and metadata changes.

The temporary provider-organization endpoint was removed, management absence and HTTPS404 verified, and its deployable local entrypoint removed. Keys, passwords, session tokens, confirmation links, prompts, replies and purchase transaction identifiers are not stored in these receipts. No images were created, edited or uploaded. No price, trial, model, allowance, provider budget or account plan changed.

## Remaining submission materials

Both subscription review screenshots are absent, so both products remain MISSING_METADATA. Uploaded iPad/Watch screenshots reflect older interfaces; large-iPhone screenshot coverage is empty. Prepare genuine current app captures for required phone/iPad sizes and current Watch UI, inspect them, and upload the same current membership capture as the two subscription review images where appropriate. Preserve app artwork and original screenshots. This requires a narrowly scoped exception to the owner's explicit image hold; silence is not permission.

Apple's [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) and [upload workflow](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/) govern exact sizes. After images are accepted, check Apple's draft validation and attach the subscriptions for the first public review. The final Submit for Review action and public release have not occurred; release remains Manual.

## Evidence limits and operating scope

The intermittent edge/PostgREST timeout observed before the successful retry is retained in the record; one recovery and successful requests do not prove sustained capacity. Native deletion callback/local cleanup and real Apple/Google grant revocation were not newly exercised. Configured provider capability flags are not live revocation tests.

Existing read-only Sandbox history shows a trial, conversion and monthly App Store renewals, while the bounded promotional transition tests prove server authorization. They do not create fresh device Restore, StoreKit expiry/refund or production-notification delivery evidence. No purchase should be repeated merely to fill a checklist.

The current AI budget supports bounded reviewer/testing use. It does not establish capacity for 1,002 subscribers using all 20 daily requests. The cost of one short synthetic answer is not an average, invoice or growth forecast. Keep the manual public-release hold while planning capacity for a larger paid rollout; no budget increase was made.
