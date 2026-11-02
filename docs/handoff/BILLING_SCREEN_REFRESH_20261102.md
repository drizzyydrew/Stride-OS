# Billing screen refresh and email presentation

Source-only change based on canonical `cbf19327a342cd12ece722647b127f9179aa6615`.
The requested component names live in `app/(tabs)/coach/index.tsx` and
`app/(tabs)/settings/membership.tsx`; there are no corresponding `src/components`
screen files at this revision. The existing architecture and theme are retained.

## Result

- Coach rechecks membership whenever its route regains focus and when the app
  returns to the foreground while that route is focused. The listener is removed
  on blur. Every check reads current AI consent and requires ready, allowed,
  matching cloud-access owner and configured billing. The subscription store's
  existing owner-lease protection still governs publication of access results.
- Membership purchase/restore results no longer claim active access solely from
  the purchase SDK response. The screen inspects the refreshed subscription
  state, including errors which `refresh()` records without throwing. Failure
  reports a finished request with unverified access; a verified negative result
  reports inactive access. Both offer a membership-only retry which never repeats
  purchase or restore. Only a verified same-owner Pro result claims active access.
- Purchase/restore and plan-load outcomes are fenced after owner changes, lost
  local access, or unmount. Plans/messages clear on owner/access changes. The
  existing single-flight purchase/restore control remains.
- Signup/password-reset success text asks the user to check email without
  claiming delivery. It mentions spam folders and delivery delays. The password
  reset introduction now describes a request rather than guaranteed sending.

## Validation

`node_modules/.bin/tsx --test --test-concurrency=1 scripts/tests/membershipScreenRefresh.test.ts scripts/tests/subscriptionLifecycle.test.ts`

Passed **24/24**, no failures or skips. The new tests execute the production
focus callback and rendered Membership component with controlled dependencies;
they exercise swallowed/rejected verification errors, denied access after an
earlier positive SDK response, access-only retry, owner changes during refresh,
late unmount results, stale plan loads, cancellation, duplicate purchase taps,
disabled billing and consent/owner lifecycle gates. These are controlled source
tests, not StoreKit or physical-device acceptance.

The six directly targeted lifecycle/false-active/email checks were also run
against an isolated temporary copy of the preserved `cbf1932` screen sources:
all six failed as expected. The canonical source was not swapped or reverted.

AST comparison against `cbf1932` confirms `handleReset` and `handleSignUp` are
unchanged. Scoped `git diff --check` passes. `npm run typecheck` completed with
exit 0 (TypeScript 5.9.3, semantic `tsconfig.typecheck.json`, no emit).

The four tracked screen diffs total **79 insertions / 23 deletions**. The new
test file is 236 lines. No existing test was edited by this change. Scope:

| File | Added | Removed |
| --- | ---: | ---: |
| `app/(tabs)/coach/index.tsx` | 24 | 6 |
| `app/(tabs)/settings/membership.tsx` | 52 | 14 |
| `app/auth/forgot-password.tsx` | 2 | 2 |
| `app/auth/sign-up.tsx` | 1 | 1 |

Read before editing: canonical AGENTS.md; Expo overview, router, data-fetching
skills; React component review guidance; official versioned Expo 57 index and
Router docs (including `useFocusEffect`), plus React Native AppState docs.
Reviewed hooks cleanup, stable focus dependencies, owner/consent gating,
single-flight user actions and accessible retry/status controls.

No payment activation, configuration/store/backend edits, dependency changes,
builds, uploads or deployments were performed by this change. Other agents'
concurrent working-tree changes are outside this handoff's implementation scope.
