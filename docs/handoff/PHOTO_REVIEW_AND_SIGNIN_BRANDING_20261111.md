# Owner photo review and sign-in branding — November 11, 2026

Reviewed all13 photos after the owner finished uploading. They show installed
behavior, not the pending source changes. Original photos and personal account
lists remain outside this repository.

## Evidence from the photos

| Photo | Evidence and disposition |
| --- | --- |
| First batch1 | Archive/Streak spacing and unequal bottom labels confirmed. Pending source addresses order, spacing and uniform labels; device acceptance remains open. |
| First2–3 | Coverage wording and saved race-result controls are confusing. Explanation is in BUILD114_FEEDBACK_REVIEW.md; their wording/semantics remain held for the owner's decision. |
| First4–6 | Expanded weekly totals, plan outline and activity content visibly overflow the native card/screen. Pending source constrains native bridge width; browser fixture is not native acceptance. |
| First7 | Inline identity editor crowds Profile. Pending source moves it to a page opened from the identity header, keeping photo separate. |
| First8 | MAF procedure/predictions need explanation. Pending source adds expandable explanations without formula changes. |
| First9 | Requests app-derived PRs and optional manual input. Pending source derives supported measured training bests; easy efforts do not establish maximal fitness or measured HRmax. |
| First10 | Plan/open-training cards appear below a thin empty subtab strip. Active-run full-screen mode DOES NOT explain this screenshot: Plan content is visible. This supports collapsed idle-control geometry; pending44pt intrinsic controls still need device validation. |
| Final1 |08:44 lock-screen Run shows9:29 elapsed,1.13mi, missing HR, estimated power and oldMM branding. Confirms displayed missing HR/old branding, not radio state or process liveness. |
| Final2 |08:49 TestFlight crash prompt confirms a crash event. This is the prompt observation time, not necessarily termination time. Owner separately said the crash was reported. |
| Final3 | Google account selector exposes the default Supabase hostname. Branding options verified below. |

Use08:44 displayed recording and08:49 crash prompt as extra matching clues
(Pacific;16:44 and16:49 UTC), alongside the owner's approximate08:30 reference.
A Live Activity can remain after process termination, so the first screenshot
does not prove the phone app was alive at08:44. Root cause remains unconfirmed.

## Branding feasibility — no live changes

**Google name/logo:** Google supports verified, published app branding on its
sign-in/consent screens. Assess StrideOS name/logo, existing website, privacy and
support links first. Configuring Google brand identity does not itself require
a Supabase custom-domain purchase. Saving an unverified name is insufficient;
Google controls verification and publishing. Current project branding status has
not been inspected.

**Actual custom address:** Supabase supports a project custom domain for OAuth.
Proposed hostname: `login.strideosfitness.com`, distinct from the documented email
sender domain. It is not configured or activated. The main website need not move.
Current price is$0.0137/hour (about$10/month), with a paid project plan required.
Current organization plan/add-ons have not been verified; if still Free, the plan
upgrade is additional. No purchase is authorized by this feasibility question.

DNS-over-HTTPS returned NOERROR/no CNAME answer for the proposed hostname. This
does not establish absence of other records or authorize a DNS write.

Before any domain activation: inspect exact Google/Supabase project identities,
current branding, plan/cost and DNS; verify hostname/certificate; add the new
`https://login.strideosfitness.com/auth/v1/callback` to the SAME Google OAuth
client while retaining the existing callback. Prepare any other OAuth providers
too. Supabase activation immediately changes the callback Auth advertises, while
its original project URL continues working. Then test login/account continuity,
return-to-app and email/recovery flows without resetting sessions/storage.

No app source, DNS, live Auth, Google publishing, billing, build or TestFlight
settings were changed in this review. Only review/QA notes were updated.

Official sources checked:

- [Google app branding](https://support.google.com/cloud/answer/15549049?hl=en)
- [Supabase Google branding](https://supabase.com/docs/guides/auth/social-sign-in/auth-google#setup-consent-screen-branding)
- [Custom domains and OAuth preparation](https://supabase.com/docs/guides/platform/custom-domains)
- [Custom-domain pricing](https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains)

Supabase changelog checked; CLI-v3 provisioning instructions require discovering
installed command/version help if a later setup is authorized.

## Authorized continuation — exact project and owned website

The later owner instruction authorizes implementing the discussed changes and
using the logged-in browser, followed by an approved next TestFlight candidate.
The feasibility-only statements above describe the earlier checkpoint.

Read-only public Auth discovery for project `pbzgrhnxpbtlkzpreizy` redirects to
Google client `471742251572-ubj5q3fdhg7bh3m8tplr9opoc59mho6u.apps.googleusercontent.com`,
with the existing project callback. The matching logged-in Google project is
`clever-tracker-481109-r7` / My First Project, under the owner's existing account.
Its StrideOS Web client matches exactly and it also contains an iOS client and
an older Desktop client. The project-wide app name currently reads **PFF Database**.
The overview reports all clients active but supplies no traffic data, so the
desktop integration has not been established as unused. BetDesk's separate
Google project was inspected first and left untouched.

A focused owner question is pending before a shared project-wide rename, because
it could also change that desktop integration's consent identity. Proposed
StrideOS branding uses the existing name/logo and the owned home, privacy and
terms URLs; credentials, scopes and callback remain unchanged. Saving draft
branding is not Google brand verification or proof of a changed account chooser.
No Google brand, client, scope or provider change has been saved at this point.

Supabase MCP readback identifies Moore Movement organization
`dpjvxdznzvofsullenjd` on **Free**. No paid upgrade or custom-domain add-on was
purchased. Replacing the actual Supabase Auth hostname with the proposed
`login.strideosfitness.com` remains a separate paid-domain decision and callback
migration, not an app build-number change.

The owned apex previously returned404 for its homepage. Its existing Vercel
project `prj_vTtsKG8f6mVn7XKR7BKB1Vx9ktT1` / strideos-password-association now
mirrors the four already-public website pages byte for byte. Deployment
`dpl_HpVJdT2Pit2gET3xPiuVRqiJ7kZG` is READY and assigned to
`strideosfitness.com`. Home, privacy, terms and support return200 with matching
hashes. The well-known password association file remains exactly70 bytes with
the same app identifier, JSON content type, no redirect and matching Apple-CDN
readback. No DNS, Auth, billing or availability claims changed. The pages still
describe a private iOS beta without a public download or open signup.

Evidence: `password-autofill/mirror-receipt.json` records the six-file upload
allowlist; `password-autofill/deployment-readback-20261111.json` records public
destination verification. Existing GitHub Pages URLs continue unchanged.
