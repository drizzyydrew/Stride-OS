# Dependency audit: native public-launch recommendation

November 2, 2026. Read-only dependency review in canonical
`/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`, HEAD
`cbf19327a342cd12ece722647b127f9179aa6615`, with concurrent launch source edits.
Only this new document was written for this review.

## Decision

**No demonstrated native public-launch blocker from this audit. Recommend
accepting the bounded build-tool exposure for this release rather than forcing
an SDK/framework change.** This is a recommendation, not a recorded owner risk
acceptance or general security clearance. Public launch still has its separate
device, authentication, billing, deletion and backend acceptance gates.

The supplied audit contains **0 critical, 0 high, 15 moderate and 1 low** entries.
Those 16 package entries propagate **four underlying advisories**, not sixteen
independent exploitable app defects. Every audit-listed installed version below
matches its lockfile entry. Root npm production-dependency status is not proof
of inclusion in a mobile bundle: Expo carries CLI/config/build dependencies in
its production dependency graph.

The inspected app/module/backend source has no direct imports of the four
affected leaf libraries. The inspected Expo/splash/apple-targets runtime entry
points are separate from their Node config/prebuild paths. No final IPA/Metro
module graph was inspected, and no export, build, install, audit rerun or exploit
was executed. This root npm audit does not separately audit Supabase/Deno remote
dependencies or native CocoaPods.

## Findings and narrow remedies

| Advisory / installed copies | Actual reachability | Launch disposition / remedy |
| --- | --- | --- |
| **glob, moderate**: root `13.0.6`; apple-targets nested `10.5.0`. [Maintainer GHSA-3g3m-2fjr-6pw4](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4) | Async cancellation can leave traversal running. Expo CLI actually supplies `AbortSignal.timeout(5000)` and also aborts a stream after its first result. This is real tooling reachability. Inspected apple-targets calls are synchronous fixed/repository-configured scans; they do not demonstrate the async cancellation exploit. | Accept as build-host availability exposure with trusted inputs and an external process/job timeout. Published fix starts at `14.0.2`, outside both installed parent ranges. A scoped CLI-only migration is the first follow-up candidate; compatibility is unproven. |
| **minimatch, moderate**: root `10.2.5`; apple-targets nested `9.0.9`. [Maintainer advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249), [fix commit](https://github.com/isaacs/minimatch/commit/77a0f5c), [11.0.1 release](https://github.com/isaacs/minimatch/releases/tag/v11.0.1) | Crafted patterns can amplify preprocessing at optimization level 2. Both installed glob copies select level 2. Fingerprint also has a separate direct minimatch edge; its inspected helper defaults to `{ dot: true }`, while minimatch's own default optimization level is 1. No app-user pattern input was found. | Accept for trusted repository/ignore patterns. Fix `11.0.1` crosses the installed 9.x/10.x ranges. Updating one glob edge does not fix the other glob or fingerprint's direct edge. |
| **uuid, moderate**: `@bacons/xcode/node_modules/uuid@8.3.2`. [Maintainer GHSA-w5hq-g745-h8pq](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq) | Advisory concerns v3/v5/v6 API calls with caller-provided buffers/offsets. No uuid-package import or triggering call was found in installed bacons Xcode/apple-targets build code. The inspected Xcode project-ID generator uses Node crypto MD5, not this uuid package. | Inventory-only exposure in inspected paths; defer. Prefer an upstream parent release removing/updating its unused dependency. A scoped `11.1.1` substitution is an optional future candidate, outside `^8.3.2`; no reason to risk native generation merely to clear this count. |
| **deepmerge, low**: root `4.3.1`. [Current advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [upstream report](https://github.com/TehShrike/deepmerge/issues/273) | Malicious merge objects can poison the returned object's prototype. Expo config merges repository configuration and plugin options with this package; no app-data merge path was found. This does not establish global `Object.prototype` pollution. | Accept for trusted config inputs. Advisory lists no patched release; official npm `latest` is still `4.3.1`. Do not invent a fixed 4.x version or replace config-merging semantics globally. |

These are real vulnerable installed versions, not dismissed audit false positives.
The narrower conclusion is that the observed trust boundary is the developer/
build host, with no demonstrated customer-triggerable production path. Reassess
before exposing these tools to untrusted remote config, glob patterns or trees.
Do not expose Metro/Expo development tooling as the production service. Job-level
timeouts bound residual work; the vulnerable library's own abort is insufficient.

## Exact installed graph

Paths are relative to the canonical checkout; all rows were read from installed
package manifests and checked against `package-lock.json`.

| Audit node | Installed version | Inherited finding or direct advisory |
| --- | --- | --- |
| `node_modules/@bacons/apple-targets` | 4.0.7 | nested glob; bacons/xcode |
| `node_modules/@bacons/xcode` | 1.0.0-alpha.32 | nested uuid |
| `node_modules/expo/node_modules/@expo/cli` | 57.0.32 | Expo config/build chain; root glob |
| `node_modules/@expo/config` | 57.0.10 | config-plugins; root glob; deepmerge |
| `node_modules/@expo/config-plugins` | 57.0.11 | root glob |
| `node_modules/@expo/fingerprint` | 0.20.14 | root glob and direct minimatch |
| `node_modules/@expo/inline-modules` | 0.1.8 | config-plugins |
| `node_modules/@expo/local-build-cache-provider` | 57.0.9 | config |
| `node_modules/@expo/metro-config` | 57.0.13 | config; root glob |
| `node_modules/@expo/prebuild-config` | 57.0.19 | config; config-plugins |
| `node_modules/deepmerge` | 4.3.1 | own low advisory |
| `node_modules/expo` | 57.0.31 | CLI/config/fingerprint/build dependencies |
| `node_modules/expo-splash-screen` | 57.0.10 | config-plugins |
| `node_modules/glob` | 13.0.6 | own advisory; minimatch |
| `node_modules/@bacons/apple-targets/node_modules/glob` | 10.5.0 | own advisory; minimatch |
| `node_modules/minimatch` | 10.2.5 | own advisory |
| `node_modules/@bacons/apple-targets/node_modules/minimatch` | 9.0.9 | own advisory |
| `node_modules/@bacons/xcode/node_modules/uuid` | 8.3.2 | own advisory |

Actual resolved consumer edges:

- `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, and
  `@expo/fingerprint` each require `glob ^13.0.0`, resolving root 13.0.6.
- Root glob requires `minimatch ^10.2.2`, resolving root 10.2.5; fingerprint
  independently requires the same minimatch range and copy.
- Apple-targets requires `glob ^10.4.2`, resolving nested 10.5.0; that glob
  requires `minimatch ^9.0.4`, resolving its nested 9.0.9 copy.
- Expo config requires `deepmerge ^4.3.1`, resolving root 4.3.1.
- Apple-targets pins `@bacons/xcode 1.0.0-alpha.32`; that package declares
  `uuid ^8.3.2`, resolving its nested 8.3.2 copy.

Installed-source evidence:

- `node_modules/expo/node_modules/@expo/cli/build/src/start/doctor/typescript/TypeScriptProjectPrerequisite.js:179-185`:
  fixed TypeScript glob and five-second AbortSignal timeout.
- `node_modules/expo/node_modules/@expo/cli/build/src/utils/glob.js:26-38`:
  glob and stream-abort consumers.
- `node_modules/glob/dist/commonjs/glob.js:154` and
  `node_modules/@bacons/apple-targets/node_modules/glob/dist/commonjs/glob.js:153`:
  optimization level 2. Root minimatch dispatches level-2 preprocessing at
  `node_modules/minimatch/dist/commonjs/index.js:341-345`.
- `node_modules/@expo/fingerprint/build/utils/Path.js:21-35`:
  direct minimatch helper and default options.
- `node_modules/@expo/config/build/Config.js:415,453`: config/plugin-option merge.
- `node_modules/@bacons/xcode/build/api/XcodeProject.js:33-50,217-224`:
  crypto-based project IDs. No uuid import found in the installed build tree.
- `node_modules/@bacons/apple-targets/build/config-plugin.js:28-34`:
  synchronous repository target scan; `app.json:64,112` enables apple-targets
  and splash plugins. They are used tooling, not unused lockfile debris.
- `node_modules/expo/src/Expo.ts:1-24`,
  `node_modules/expo-splash-screen/build/index.js:1`, and
  `node_modules/@bacons/apple-targets/build/ExtensionStorage.js:1-24`:
  inspected runtime entries, distinct from the vulnerable tool chains.

## Concrete follow-up for approval, not applied

First candidate: keep Expo **57.0.31** and all native packages unchanged; extend
the existing `@expo/cli` scoped override with `glob: "14.0.2"` while preserving
its existing `zod: "4.6.7"` override. Require that new glob's minimatch resolve
**11.0.1**, since its declared `^11.0.0` alone permits the vulnerable 11.0.0.
This addresses the confirmed CLI cancellation path only. Other audit entries
remain; no zero-audit claim is appropriate.

[glob 14.0.2 metadata](https://registry.npmjs.org/glob/14.0.2) and
[minimatch 11.0.1 metadata](https://registry.npmjs.org/minimatch/11.0.1) publish
CommonJS exports and Node `18 || 20 || >=22` support; the inspected host is
Node 24.16.0. That establishes format/engine plausibility, **not consumer/API
compatibility**. Glob also changes path-scurry from 2.x to 3.x. All fixed glob/
minimatch/uuid targets here are outside the current consumer ranges; there is
no demonstrated semver-compatible leaf fix to apply automatically.

After approval: validate cancellation and stream behavior in bounded synthetic
trees, representative matching/ignore results, Expo config and source-map export;
then re-audit installed paths. A later apple-targets/fingerprint migration needs
its own scoped review and generated Watch/extension comparison. A uuid 11.1.1
candidate retains CommonJS per [published metadata](https://registry.npmjs.org/uuid/11.1.1),
but replacing its parent or pruning a transitive dependency needs separate proof.

Reject `npm audit fix --force`, Expo 58/framework jumps, and the report's proposed
Expo **53.0.11** or splash **55.0.25** downgrades. Those suggestions are graph
resolution proposals, not compatibility evidence for the current SDK 57 app.
Preserve the existing Babel 7.29.6 and other dependency safeguards. No package
or lock changes, dependency install, native regeneration or backend deployment
was performed in this review.

## Evidence identity

- Supplied audit: `/tmp/strideos-launch-audit-20261102.json`, SHA-256
  `3c2ba9efeae85d446a25c621311b456ed7865120544c78b3a5403e4625a5e840`.
- `package.json` SHA-256:
  `18891aaf87becfd5f02a01837d553b3f860c06ad51b25cf7f560f1a627050421`.
- `package-lock.json` SHA-256:
  `58be0b5a33149d6d70bd8fab9399146b52fef219320768b986e9f8587242a1bc`.
- Existing `DEPENDENCY_EXPOSURE_REVIEW.md` was historical SDK 56 context only;
  this document re-read the current SDK 57 graph and upstream advisories.
