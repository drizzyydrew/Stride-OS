# App Review notes for a billing off StrideOS candidate

Draft for the latest internally available candidate 111. It has not been saved
to Apple. Public version 1.0 still selects 109 at the last verified readback.
Before using these notes, accept reviewer navigation and actual deletion, add
the verified deletion steps, and match the text to the exact submitted binary.
If billing is enabled in a later candidate, replace the billing paragraph with
the accepted purchase/access instructions and reconcile privacy disclosures.

The paths below were mapped against current source, not exercised on native 111
by this documentation review. Expected outcomes are acceptance targets, not
observed passes. Confirm each label and outcome on the exact submission candidate
before copying the draft into Apple. This file does not authorize destructive
testing, a submission or release.

## Draft text for Apple

Sign-in is required. Use the dedicated credentials supplied privately in App
Review Information. If initial fitness-profile setup appears, use fictional
information. Please do not use personal health records or real-person media.

Apple Health, location, notifications, AI sharing, usage sharing and diagnostic
reporting have separate controls. Optional permissions may be declined; manual
workout logging and saved-history review remain available.

1. Sign in with the dedicated reviewer credentials. If profile setup appears,
   enter fictional fitness information. Expected outcome: the app opens the
   reviewer's training context without exposing another account's history.
2. Open Today, then Calendar. Expected outcome: Today presents the next session
   or the current training state; Calendar distinguishes scheduled and completed
   sessions where they exist. An empty reviewer history is not a recording error.
3. Open More → Activity. Use the header plus button (accessibility label
   "Log activity") to open Log Activity. Select Walking, enter a fictional test
   duration, leave optional measurements blank, and choose Save. Expected outcome:
   the saved activity detail opens and the entry appears when returning to
   More → Activity. Manual test inputs are not measured GPS or heart-rate data;
   missing optional measurements should not appear as invented recordings.
4. Open More → Strength → Presets. Expected outcome: strength preset choices
   appear. Viewing a preset is not a completed workout. Running is the tab for
   supported outdoor recording; this navigation draft does not accept locked-screen
   recording, Watch behavior, interruption recovery or offline persistence.
5. Open More → Settings → Goal archive. The destination title is Training archive.
   Expected outcome: saved blocks and their summaries appear when available;
   an account without archived blocks shows the empty-state explanation and
   View activity history. Under Settings → Choose your next goal or train freely,
   Your next goal offers Start this goal and Skip · keep training without a plan.
   Viewing these choices does not require changing the reviewer's current plan.
6. In More → Settings, scroll to AI Coach Privacy. Leave Allow sharing with
   Anthropic for AI Coach off, then open AI Coach → Insights. Expected outcome:
   on-device guidance remains available without allowing AI chat sharing. In
   AI Coach → Ask Coach, a sharing explanation is shown while sharing is off.
   Choosing to allow sharing permits messages and selected training context to
   be sent to Anthropic; responses can be wrong and usage limits apply.
7. In More → Settings, scroll to Account & Legal. Expected outcome: Privacy policy,
   Terms of use, Contact support and Manage Apple subscriptions links are present.
   The section also contains Request account deletion when no request is shown;
   actual availability and completed deletion are not accepted by this draft.
   Do not submit a deletion request with a retained reviewer identity merely to
   follow these notes. Add accepted disposable-account deletion instructions
   before submission, as described below.

Movement Lab uses selected media for supported fitness movement review.
Approximate two-dimensional measurements are not medical assessments.

This billing-off candidate has subscriptions disabled. No purchase or trial is
required. StrideOS is intended for general fitness guidance and training records,
not diagnosis, treatment or emergency care. These notes make no determination
of regulatory status in any jurisdiction.

## Source map for preparation only

These references explain the proposed paths; they are not runtime evidence and
are not intended to be pasted into Apple's notes field.

| Steps | Current source |
| --- | --- |
| 1–2 | `app/(tabs)/_layout.tsx`; `app/(tabs)/dashboard/index.tsx`; `app/(tabs)/calendar/index.tsx` — visible tabs and training surfaces; native sign-in/isolation still require acceptance |
| 3 | `app/(tabs)/more/index.tsx` — Activity; `app/(tabs)/activity/index.tsx` — Log activity; `app/(tabs)/activity/manual.tsx` — Log Activity, Save and navigation to saved detail |
| 4 | `app/(tabs)/more/index.tsx`; `app/(tabs)/strength/index.tsx` — Strength and Presets |
| 5 | `app/(tabs)/settings/index.tsx`; `app/(tabs)/settings/goal-archive.tsx`; `app/(tabs)/settings/next-goal.tsx` — exact entry labels, Training archive, empty state and next-goal choices |
| 6 | `src/components/settings/AiSharingPreferences.tsx`; `app/(tabs)/settings/index.tsx`; `app/(tabs)/coach/index.tsx` — AI Coach Privacy, sharing control, Ask Coach and Insights |
| 7 | `src/components/settings/AccountPrivacy.tsx`; `app/(tabs)/settings/index.tsx` — Account & Legal, external links and deletion request presentation |

## Required addition before submission

Add the actual accepted account-deletion navigation and reviewer-observable
outcome. Automatic deletion is currently disabled, so these draft instructions
are not a complete public submission packet. Never paste credentials, private
provider keys or deletion recovery secrets into the notes body.
Record the exact build, test identity scope, date, steps and observed outcome for
each accepted journey separately; a source-map match cannot close a native gate.
