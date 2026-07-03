# StrideOS TestFlight Readiness

Responsibility: release-readiness checklist for signed iPhone builds.

Use this checklist before sending a build to testers. Keep private keys in Supabase or EAS secrets, not in the app bundle.

## Local App Environment

Copy `.env.example` to `.env` for local development and set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_STRAVA_CLIENT_ID`

Do not add `ANTHROPIC_API_KEY`, `STRAVA_CLIENT_SECRET`, Apple private keys, or Google OAuth client secrets to `.env`.

## Supabase Auth

In Supabase Authentication settings:

- Site URL: `strideos://`
- Redirect URLs:
  - `strideos://auth/callback`
  - `strideos://strava-callback`

Enable and configure:

- Email confirmation, if required for launch.
- Apple provider for Sign in with Apple.
- Google provider for Google sign-in.

## Supabase Edge Functions

Deploy:

- `ai-coach`
- `strava-token`

Set secrets:

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` optional, defaults in code
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`

The iOS app calls the Edge Functions with Supabase auth headers. Anthropic and Strava secrets must stay server-side.

## Supabase Storage

Create a private bucket named:

- `movement-videos`

This supports AI Coach and Movement Lab video uploads. If the bucket or policies are missing, videos still save locally but cloud upload will warn and fall back.

## Apple Developer / App Store Connect

Confirm these capabilities for bundle id `com.mooremovement.strideos`:

- Sign in with Apple
- HealthKit
- Location background mode, via Expo Location config
- Push notifications/local notifications

`app.json` already declares:

- `ios.usesAppleSignIn`
- HealthKit usage descriptions
- foreground/background location usage descriptions
- `expo-location`, `expo-notifications`, `expo-apple-authentication`, and `@kingstinct/react-native-healthkit` plugins

## Strava App Settings

In the Strava developer app:

- Authorized callback domain must allow the app callback used by StrideOS.
- Mobile OAuth redirect URI used by the app: `strideos://strava-callback`
- Scope requested by the app: `activity:write`

After connecting Strava in the app, log a workout with duration and distance and verify it creates a manual Run activity in Strava.

## TestFlight Smoke Test

Run these on a signed iPhone build, not Expo Go:

- Create account, confirm email, sign in.
- Sign in with Apple.
- Sign in with Google.
- Ask AI Coach a training question and verify a real response.
- Connect Apple Health and write a completed run.
- Connect Strava and upload a completed run.
- Enable GPS, start a route, lock the screen briefly, then confirm distance and map route continue.
- Enable notifications, set a near-future reminder time, and verify notification tap opens the intended app screen.
- Upload a Movement Lab or AI Coach video and verify local playback plus cloud storage path when signed in.

## When To Update

- Update when release requirements, smoke tests, secrets, or external service setup changes.
- Keep build-specific outcomes in `CHANGELOG.md` or `CODEX_HANDOFF.md`.

## Do NOT Put Here

- App Store marketing copy.
- General architecture notes.
- Long debugging histories.
