# Build 103 Release

October 23, 2026. Canonical checkout: `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`.

The user authorized finishing PostHog/Sentry configuration, pushing the approved activity Work update, building, and submitting to TestFlight. No public App Store release, new paid plan, native crash collection, session replay, or broader Health/GPS changes are authorized by this release.

## Configuration And Publication

- Sentry organization `strideos-0k`, project `react-native`, project ID `4512306931695616`; the authenticated project settings matched the previously supplied public DSN.
- PostHog US Cloud project `683951`; public ingestion uses `https://us.i.posthog.com`.
- All six required variables are present in the production EAS project environment. `SENTRY_AUTH_TOKEN` was initially saved as Sensitive and changed to Secret without retrieving or replacing its value. The production build profile explicitly selects the production environment.
- The generated host `ios/sentry.properties` contains the intended organization/project; no private credential is committed or placed in app extras.
- The existing public privacy-policy hosting branch is `claude/stride-os-visibility-sxl7xl`, not the app release branch. Only `docs/privacy.html` was updated there after matching its previous blob to the reviewed baseline. Publication commit: `bda8c09e55ab9a2c47ed27f41391aa5ec61a512b`.
- GitHub Pages reported that commit built. An uncached HTTP read of `https://drizzyydrew.github.io/Stride-OS/privacy.html` returned 200 with the October 23, 2026 date and both optional processors disclosed.
- Sentry server-side/default scrubbing is enabled, minidump attachments inherit Disabled, source-map downloads inherit Admin access, and no repository is connected. Preventing storage of IP addresses was not enabled in the inspected project; the policy does not claim anonymity or absence of infrastructure IP handling. No vendor retention settings were changed.

## Release Preparation

- Remote EAS history confirmed zero Build 103 records before the local version bump.
- Aligned the seven reported SDK 56 patch dependencies with `expo install --fix`; retained React Native 0.85.3 and Expo SDK 56. Added the requested `expo-asset` plugin entry manually because automatic writes to dynamic config were unavailable.
- Updated the existing build-tool dependency `shell-quote` within its compatible range to 1.12.0. The critical advisory was removed; npm still reports 26 other dependency advisories. No broad audit-force upgrade was performed.
- Semantic typecheck and live `expo:check` passed. Clean iOS prebuild passed; host Info.plist and generated Watch/Live Activity build settings use 103. The generated host is `ios/StrideOS.xcodeproj`, with the established bundle IDs and app group retained.
- The generated native directory remains ignored and excluded from EAS archives; the cloud build regenerates it from source/config. The host PBX project counter is template value 1, while its actual Info.plist explicitly contains build 103; verify the archived plist rather than treating that template counter as the binary version.
- No source changes to GPS, HealthKit, Watch, Live Activity, authentication, or training stores were made during release preparation.

## Evidence And Limitations

- Sanitized synthetic configuration requests returned HTTP 200 from both ingestion endpoints. PostHog event UUID: `97c1f23b-7e46-4cce-ac53-822722022e0f`. Sentry event ID: `1b013522f9e84e61a1e0ae75c966fe2c`, release `strideos-configuration-check`. These were explicit synthetic requests using the app sanitizers, not device SDK or symbolication proof.
- First full default-concurrency test run: 1193/1194 passed. The unchanged production Swift deadline probe hit its existing 30-second subprocess timeout under load. No test timeout or protected implementation was changed. Log: `/tmp/strideos-build103-tests.log`.
- The first serial rerun also timed out on that same unchanged probe (1193/1194). A standalone `swift --version` stalled before executing app code. Disk inspection found only about 245 MB free. Standard `npm cache clean --force` removed downloaded package-cache contents, leaving installed dependencies, source, personal files, prior release artifacts and `_npx` runtimes intact; free space increased to about 7 GB.
- After cleanup, the exact unchanged Swift test file passed 5/5 within its original timeout (`/tmp/strideos-build103-swift-after-cleanup.log`). The complete final serial suite then passed **1194/1194**, zero failures/skips, in 622.4 seconds, including the production Swift deadline probe in 20.6 seconds (`/tmp/strideos-build103-tests-final.log`). No implementation or test timeout was changed to obtain these results.
- Fresh browser checks passed 12/12 for Privacy & Diagnostics and 25/25 for Work presentation, across the fixture's dark/light widths. No page errors or external requests in the consent fixture. Logs: `/tmp/strideos-build103-browser-observability.log`, `/tmp/strideos-build103-browser-power.log`. These are actual component fixtures, not physical-device validation.
- Earlier independently reviewed source and browser evidence is in `observability-review/README.md` and `power-review/README.md`. Current release review uses a single-assistant multi-lens check because independent reviewer tools are unavailable; no new independent-agent consensus is claimed.
- Browser automation became unreliable during vendor dashboard navigation. HTTP acceptance is not a claim that vendor processing, Hermes symbolication, native device layout, or installed-device opt-in/revocation was verified.
- Existing App Store Connect credentials were successfully read through the supported CLI: Build 102 is `VALID` / `IN_BETA_TESTING`. This does not establish availability of the pending Build 103.
- Native archive, source-map upload, exact artifact identity, submission, Apple processing and tester availability remain separate pending gates. No build or submission is claimed by this preparation record.
