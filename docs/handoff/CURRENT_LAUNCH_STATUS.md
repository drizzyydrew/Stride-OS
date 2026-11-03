# Current StrideOS launch status

This is the current navigation page for launch preparation. Dated build receipts
retain their original scope. The latest internally available candidate is 111;
the last verified public draft still selects 109 with manual release. Neither
is a publicly released app. The final release candidate may change after testing.

## Completed preparation

| Item | Latest evidence |
| --- | --- |
| Internal candidate 111 | Signed archive verified; Apple VALID / IN_BETA_TESTING in the existing internal group. `BUILD111_RELEASE.md` and `BUILD111_APPLE_ACCEPTANCE.json` |
| Source checks for 111 | 1,623 passing tests, TypeScript and Expo compatibility. These are recorded runs, not a new test run for later documentation changes. |
| Password reset | Resend delivery observed and owner-reported successful cold-start retest on 111. This accepts that reported flow only. |
| Sending service | auth.strideosfitness.com verified, custom SMTP saved, branded templates saved; Resend Free retained. `email-templates/RESEND_SMTP_ACCEPTANCE_20261102.json` |
| AI organization cap | Approved $20/month limit saved and read back. Actual deployed API-key organization and over-limit enforcement are not independently matched/tested. `AI_VENDOR_SPENDING_20261102.json` |
| Apple owner setup | Developer/Paid Apps agreements, bank and W-9 recorded Active; reviewer credentials previously authenticated against the separate backend. `APP_STORE_DRAFT_REVIEW.md` |
| Public website | Home, support, privacy and terms return HTTPS 200, match canonical source and have no missing relative file targets in `PUBLIC_SITE_AUDIT_LATEST.json`. Support FAQ and mobile fixes are published. |
| Support and review preparation | `LAUNCH_SUPPORT_PLAYBOOK.md` and `INDEPENDENT_REVIEW_BRIEF.md` are prepared; no reviewer hired. |

## Open launch gates

| Gate | Remaining work | Owner dependency |
| --- | --- | --- |
| Account confirmation | Require and test the intended email-confirmation policy before reopening signup; preserve existing identities/history | Dedicated test credentials and inbox/native return confirmation |
| Device reliability | Recording with screen lock, interruption/offline, single save/restart, Health permissions/recovery, Watch and account isolation | Physical iPhone/Watch session, explicitly deferred |
| Account deletion | Real provider exchange/revocation, device receipt/cleanup/restart and support handling; general automation remains off | Identified disposable identities, native prompts and explicit deletion approval |
| Paid subscriptions | Current isolated QA candidate and real purchase, restore, renewal, expiry/refund/revocation acceptance | Sandbox dialogs and observed results; some checks need elapsed time |
| Store package | Final genuine screenshot coverage, final candidate attachment, privacy/reviewer reconciliation and submission decision | Capture assistance if needed and final owner decision |
| Naming review | Another Health & Fitness app uses StrideOS under a different seller; see `SOCIAL_HANDLE_REVIEW.md`. Hold new public handles, promotional publication and additional brand spending pending a naming decision | Owner direction and, if commissioned, qualified trademark review; no unilateral rename |

The historical Apple production notification TEST 401 remains unresolved.
Sandbox TEST previously succeeded. Do not equate it with proven production
delivery or release an unaccepted app merely to obtain production API access.

Private billing QA build 110 predates the reset fix; do not make it the normal
public candidate. Payments, general deletion automation and public release stay
off. Signup and Confirm email were both off at the last dashboard readback.

Independent engineering/device/legal reviews have not been commissioned.
Automated scoped reviews do not establish those professional review outcomes.

## Work that can continue without the owner

Website/link/copy auditing, metadata reconciliation, actual-asset inventories,
reviewer instructions, draft launch copy, support procedures and evidence
organization can proceed without phone access. Existing accounts, keys, services
and financial setup do not need to be recreated just because an old checklist
asks for them. Owner prompts and actual device outcomes cannot be replaced by
these preparation tasks.

Prepared copy: `APP_REVIEW_NOTES_111_DRAFT.md` and `LAUNCH_COPY_DRAFT.md`.
Neither draft has been sent, posted or saved into Apple's review fields.

November 3 council continuation corrected unsupported professional-analysis
wording and the support-correspondence disclosure, mapped reviewer navigation,
clarified historical checkpoints and strengthened proposed support/reviewer
custody. Private financial source documents are organized outside both app
checkouts; no invoice, private manifest or source email is stored here. The
supplemental mailbox sweep was rate-limited, and Apple's original invoice remains
uncollected despite captured order/enrollment evidence. See
`COUNCIL_LAUNCH_PREPARATION_20261103.md` for the bounded review and receipt.
