# StrideOS App Store Preparation

Responsibility: truthful public metadata and the outstanding App Review submission fields. This document is not proof that App Store Connect has been updated or that Apple has approved the app.

## Listing Draft

Name: StrideOS

Subtitle: Run, Lift, Recover

Promotional text: Bring running, strength, and recovery into one training routine. Record workouts, review your progress, and find your next session.

Keywords: running,training,strength,workout,GPS,walking,hiking,calendar,recovery,pace,fitness

### Description

StrideOS brings running, strength, and recovery into one connected training routine.

YOUR NEXT SESSION
Plan your week, review your scheduled sessions, and adjust your training around your goals and availability.

RECORD YOUR WORKOUTS
Record supported outdoor activities with GPS, log strength sessions, and review saved workouts in your calendar and activity history. GPS and connected-device coverage can affect recorded measurements.

UNDERSTAND YOUR PROGRESS
Review pace, heart rate when available, distance splits, training history, and activity-specific Work metrics. Estimates are labeled and are not clinical measurements. Missing source data is shown as unavailable rather than invented.

MOVEMENT LAB
Use saved clips and images to review supported movement-analysis results. Camera-derived angles are approximate two-dimensional estimates and are not a medical assessment. Local media is not automatically a cloud backup.

OPTIONAL AI COACH
With your explicit permission, send messages and selected training context to Anthropic's Claude through StrideOS for fitness guidance. AI responses can be wrong and are subject to usage limits and service availability. On-device Insights do not require AI sharing.

YOUR DATA, YOUR CHOICES
Apple Health, location access, AI sharing, basic usage sharing, and diagnostic reporting have separate controls. Optional usage and diagnostics are off by default. StrideOS does not use HealthKit data for advertising.

StrideOS provides fitness information, not diagnosis, treatment, emergency care, or a guarantee of injury prevention. Seek a qualified clinician's advice for medical concerns.

Privacy: https://drizzyydrew.github.io/Stride-OS/privacy.html
Terms: https://drizzyydrew.github.io/Stride-OS/terms.html
Support: https://drizzyydrew.github.io/Stride-OS/support.html

## App Store Connect Checklist

- Primary category: Health & Fitness. Secondary category: Sports, if appropriate.
- Complete the current age-rating questionnaire accurately, including relevant health/fitness, AI, and user-content questions. Do not blindly answer No or assume the old 4+ rating. The minimum-age policy and distribution territories require owner/legal review.
- Enter the published privacy, support, and terms URLs. Check every link over HTTPS after publication.
- Update privacy labels from observed behavior: account/contact information, backed-up fitness data, routes, uploaded media, AI sharing, optional analytics/diagnostics, and any enabled purchases. Consent does not automatically exempt a data type from disclosure. Use Apple's definitions rather than guessing labels here.
- Verify privacy manifests, required-reason APIs, usage strings, entitlements, and iOS/watchOS SDK eligibility in the exact archived build.
- Provide screenshots from the actual release candidate using the size slots currently required by App Store Connect. Do not advertise unconfigured integrations, paid features that are not enabled, or clinical accuracy.
- Provide a dedicated reviewer account and instructions for sign-in, optional permissions, core recording, AI consent, and deletion initiation. Never include private API keys. Keep production backends available for review.
- Complete export-compliance answers, availability, rights, contact information, and release settings. Use manual public release for the first submission.
- If paid: complete Apple's agreements, banking/tax setup, products, subscription group, pricing, renewal disclosures, review screenshots, and sandbox purchase/restore/refund/expiration tests. No subscription claim belongs in the live listing until the paid feature gates and entitlement verification are tested.

## Release Boundary

TestFlight upload and processing do not constitute public App Review approval. No public launch is authorized by this file. The launch-readiness record tracks unresolved operational, device, legal, and billing gates.
