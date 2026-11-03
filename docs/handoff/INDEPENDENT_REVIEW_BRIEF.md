# StrideOS independent review brief

StrideOS combines running, strength and recovery in an Expo React Native iPhone
app with a Watch companion and a separate Supabase backend. We want a focused
review of launch risks and reproducible findings. Quote review and remediation
separately; do not begin a rebuild or paid work without written approval.

## Engineering and device review

The reviewer should have shipped iOS subscription apps and relevant experience
with HealthKit, watchOS, Supabase Auth/RLS and RevenueCat. Please provide examples
of that work and identify the devices available for testing.

Review the current candidate and source supplied at engagement time. Cover:

- Email, Apple and Google sign-in, cold-start callback handling, password
  recovery, account switching and access to the correct training history.
- Per-account database and file access, privileged endpoint authentication,
  encrypted provider-token custody, deletion completion and recovery.
- Locked-screen recording, interruptions, offline saving, exactly-one save,
  restart persistence, denied permissions and Watch disconnection.
- Purchase, restore, renewal, expiration, refund/revocation and consistency
  between store events, RevenueCat access and server enforcement.
- AI consent, selected data sharing, usage limits, error handling and spending
  controls; distinguish source review from verified deployed behavior.
- Goal archive continuity, recorded versus estimated metrics and truthful store
  screenshots against the accepted binary.

Use fictional or explicitly disposable test identities and records. Keep the
existing app installation and retained personal history intact. Destructive
tests require an identified disposable target and explicit owner approval.

## Deliverables and acceptance

Provide a short executive assessment and a findings table. Each finding must
include severity, user impact, affected build/environment, reproducible steps,
expected and actual behavior, minimum necessary redacted evidence, and a
suggested correction. Identify the tests that were blocked or not performed.

Separate launch blockers from later improvements. Include one retest of agreed
fixes in the quote, or state its separate price. Acceptance means the agreed
report and retest are delivered, not a guarantee of Apple approval or absence
of defects.

## Privacy and terms review

A separate licensed privacy/technology attorney can quote a bounded review of
the published privacy policy, terms, AI disclosures, deletion/retention wording,
fitness claims, storefront privacy answers and intended launch territories.
Engineering review does not substitute for that legal review.

## Access and quote

Request the named reviewer, scope, hours or fixed fee, spending cap, delivery
date, retest terms and exclusions. Start with read-only source/test access and
the least privileges needed. Keep account ownership, banking/tax information
and credential entry with Drew. Require permission before subcontracting,
copying customer data, adding services, changing production or deleting data.

No reviewer is engaged and no budget is approved by this brief. It is ready for
the owner to share after choosing recipients and reviewing its scope.
