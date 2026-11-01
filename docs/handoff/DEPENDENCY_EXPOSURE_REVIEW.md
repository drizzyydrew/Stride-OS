# Build 104 dependency exposure review

Reviewed 2026-10-31 PDT (2026-11-01 UTC) against canonical `/Users/drew/Developer/StrideOS_App_clean_build19_v3_foundation_local`, branch `build-19-v3-foundation`, HEAD `2d77acf9ada04b223488537557e5a8b542fd4abc`. `app.json` identifies iOS build 104. This is a source/dependency review, not a release approval or a certification of the installed binary.

## Authorized Babel patch: implemented and narrowly verified

Following the owner's authorization, added root npm override `"@babel/core": "7.29.6"` and ran `npm install --ignore-scripts --no-audit --no-fund`. Installed Babel changed **7.29.0 → 7.29.6**. Relative to the immediate pre-install snapshot (which already included the parent's expo-crypto installation), **the only changed lockfile package record is `node_modules/@babel/core`**; no package records were added or removed. Existing Expo overrides were preserved. `expo-crypto` remains declared `~56.0.5`, installed/locked **56.0.5**, with its complete lock record unchanged. No glob/minimatch/uuid or other major upgrade was made.

Verification receipts:

- The lockfile contains **one Babel core copy**, at 7.29.6; its installed manifest agrees. Actual Node resolution from **75 consumer package locations** resolves that same installed copy. All **78 declared dependency/peer/optional dependency ranges** for Babel core accept 7.29.6. Resolution details are in `/tmp/strideos-babel-resolution-receipt.json`.
- Added `scripts/tests/babelSourceMapSecurity.test.ts`. It calls the **actual installed Expo Metro `build/babel-core.js` consumer export**, not a mock. Following the maintainer advisory's sourceMappingURL threat model, it creates a temporary package and a synthetic source map outside that package. Before the upgrade, both relative and absolute outside-map cases fail because their synthetic content enters the output map; the trusted adjacent-map case passes. After the upgrade, **all three tests pass**: both outside references are ignored, adjacent map composition is retained, and a real arrow-function transform still executes with the expected result. Every file in this reproduction is created by the test under its own temporary directory and cleaned afterward; no private file, account, or external exfiltration endpoint is used. [Maintainer advisory](https://github.com/babel/babel/security/advisories/GHSA-4x5r-pxfx-6jf8), [official package-root boundary implementation](https://github.com/babel/babel/blob/v7.29.6/packages/babel-core/src/transformation/read-input-source-map-file.ts).
- Focused command: `./node_modules/.bin/tsx --test scripts/tests/babelSourceMapSecurity.test.ts`: **3 passed, 0 failed** after installation.
- Fresh `npm audit --json --ignore-scripts` receipts: **18 → 17 package entries**, **low 2 → 1**, **moderate unchanged at 16**, **high/critical both 0**. The sole removed package entry is `@babel/core`; no new entry appeared. The remaining 17 entries arise from the other four underlying advisories. Audit exit 1 remains expected because those findings persist. Before/after JSON: `/tmp/strideos-babel-audit-before.json`, `/tmp/strideos-babel-audit-after.json`.

This continuation owns only package.json, package-lock.json, the focused test, and this document. Parent application/test changes and its prior crypto addition are preserved. No `npm audit fix`, `--force`, prebuild, native build, account/deployment mutation, or paid service was used. The parent will run the full suite, Expo dependency checks and export later; those broader post-patch results are **not claimed here**.

## Initial review decision and scope (before the Babel patch)

The initial read-only audit contained **18 affected package entries: 16 moderate, 2 low, 0 high, 0 critical**, arising from **five underlying advisories**. The historical inventory and exposure assessments below preserve that starting point; Babel is now resolved as recorded above. Inherited entries are not independent exploits. The affected APIs inspected here are build/configuration/development tooling. No application import of these five libraries was found in the searched application/local-module source. That supports lower direct device exposure, but it does not eliminate build-host risk or prove absence from the final iOS bundle.

The patch-level Babel action has been completed. **A remaining material finding is confirmed in Expo CLI:** its TypeScript discovery relies on a glob timeout that the installed glob does not reliably enforce. Address that tooling path separately; do not describe these dependencies as cleared merely because they are not expected to execute on the phone. The original pass added only this review document; dependency installation was authorized subsequently.

## Reproducible evidence

Commands actually run: `npm audit --json --ignore-scripts` (exit 1 because findings exist), installed/lockfile package metadata inspection, bounded source searches, and read-only public advisory/registry requests. Audit JSON is at `/tmp/strideos-build104-dependency-audit.json`; patched-version metadata at `/tmp/strideos-build104-patched-metadata.json`. These temporary files are not committed evidence. `npm explain ... --json` stalled without output and was stopped; the chains below come from the lockfile and installed manifests/source, not that incomplete command.

- Node `v24.16.0`; npm `11.13.0`.
- `package.json` SHA-256: `10db2b948a4a63917b741a92534b4d8dd3d67ba3ef71f194ec66c14722f0a50b`.
- `package-lock.json` SHA-256: `262ab0ba43ddd4dd600a8084fa86bd80562f4fd90d8813b3335c37839324dc00`.
- Audit dependency metadata: 829 production, 29 development, 47 optional, 13 peer entries, total 890 as reported by npm. These categories are **installation metadata**, not a native-runtime reachability analysis. Expo's production dependency graph includes its CLI and config tools.

### Initial root advisory inventory (Babel subsequently fixed)

| Root package and installed copies | Audit severity | Advisory / first applicable fixed version |
| --- | --- | --- |
| `@babel/core@7.29.0`, `node_modules/@babel/core` | Low | [GHSA-4x5r-pxfx-6jf8](https://github.com/babel/babel/security/advisories/GHSA-4x5r-pxfx-6jf8); Babel 7 fix `7.29.6` |
| `deepmerge@4.3.1`, `node_modules/deepmerge` | Low | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4); no patched release listed |
| `glob@13.0.6`, `node_modules/glob`; `glob@10.5.0`, `node_modules/@bacons/apple-targets/node_modules/glob` | Moderate | [GHSA-3g3m-2fjr-6pw4](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4); `14.0.2` |
| `minimatch@10.2.5`, `node_modules/minimatch`; `minimatch@9.0.9`, `node_modules/@bacons/apple-targets/node_modules/minimatch` | Moderate | [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249); `11.0.1` |
| `uuid@7.0.3`, `node_modules/uuid`; `uuid@8.3.2`, `node_modules/@bacons/xcode/node_modules/uuid` | Moderate | [GHSA-w5hq-g745-h8pq](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq); compatible-format candidate `11.1.1` |

The audit's severity is retained even where an advisory's CVSS number differs. Glob also inherits the separate minimatch finding.

### Complete affected-package graph

An arrow means a resolved dependency edge; braces list audited child findings. Unless specified, a package is hoisted under `node_modules/`.

| Audited package entry | Installed version(s) | Finding inherited through |
| --- | --- | --- |
| `@babel/core` | 7.29.0 | Own low advisory |
| `deepmerge` | 4.3.1 | Own low advisory |
| `glob` | 13.0.6; apple-targets nested 10.5.0 | Own moderate advisory; minimatch |
| `minimatch` | 10.2.5; apple-targets nested 9.0.9 | Own moderate advisory |
| `uuid` | 7.0.3; bacons/xcode nested 8.3.2 | Own moderate advisory |
| `xcode` | 3.0.1, hoisted and under prebuild-config/config | uuid 7.0.3 |
| `@bacons/xcode` | 1.0.0-alpha.32 | uuid 8.3.2 |
| `@bacons/apple-targets` | 4.0.7 | bacons/xcode; expo; glob 10.5.0 |
| `@expo/config-plugins` | 56.0.9, 56.0.16, 56.0.17 | glob 13.0.6; xcode 3.0.1 on the older copies |
| `@expo/config` | 56.0.14, 56.0.15 | config-plugins; deepmerge; glob |
| `@expo/fingerprint` | 0.19.10 | glob; minimatch 10.2.5 |
| `@expo/inline-modules` | 0.0.16 | config-plugins |
| `@expo/local-build-cache-provider` | 56.0.12 | config |
| `@expo/metro-config` | 56.0.20 | config; glob |
| `@expo/prebuild-config` | 56.0.24 | config; config-plugins |
| `@expo/cli` | 56.1.27, nested under expo | config; config-plugins; inline-modules; metro-config; prebuild-config; glob |
| `expo` | 56.0.24 | cli; config; config-plugins; fingerprint; local-build-cache-provider; metro-config |
| `expo-splash-screen` | 56.0.16 | config-plugins |

Concrete root-to-leaf chains, with actual resolution distinctions:

1. `expo@56.0.24 → @expo/metro-config@56.0.20 → @babel/core@7.29.0`. Additional Babel consumers include `react-native@0.85.3 → @react-native/codegen@0.85.3`, Metro 0.84.4/0.84.5 transform packages, and Expo `@expo/require-utils@56.1.3/56.1.7/56.1.8`; their manifests permit Babel `^7.25.2` or Metro-config's `^7.20.0`.
2. `expo@56.0.24 → node_modules/expo/node_modules/@expo/config@56.0.15 → deepmerge@4.3.1`. Also config 56.0.14 at the root and config 56.0.15 nested under metro-config and prebuild-config, all resolving the same deepmerge copy. These are all installed deepmerge consumers found in the lockfile.
3. `expo@56.0.24 → node_modules/expo/node_modules/@expo/cli@56.1.27 → glob@13.0.6 → minimatch@10.2.5`. Expo config/config-plugins, metro-config and fingerprint also use that glob. Fingerprint additionally depends directly on minimatch 10.2.5.
4. `@bacons/apple-targets@4.0.7 → nested glob@10.5.0 → nested minimatch@9.0.9`. This separate tree will survive a fix applied only to Expo CLI's glob.
5. `expo-splash-screen@56.0.16 → root @expo/config-plugins@56.0.9 → xcode@3.0.1 → uuid@7.0.3`. Config 56.0.14's nested config-plugins 56.0.16 also resolves xcode 3.0.1. Prebuild-config's nested config 56.0.15 has another nested config-plugins 56.0.9 and xcode 3.0.1, resolving the same hoisted uuid. By contrast, installed config-plugins 56.0.17 copies depend on xcode 4.0.0, which has no uuid dependency.
6. `@bacons/apple-targets@4.0.7 → @bacons/xcode@1.0.0-alpha.32 → nested uuid@8.3.2`.

The installed older config-plugin copies coexist with 56.0.17 copies. A package.json pin or one updated parent does not prove every affected node was replaced; re-audit the actual resulting lockfile.

## Exposure and compatible remediation

### Babel: low severity, real build-host boundary

The advisory concerns compiling attacker-controlled source and exposing transformed output containing a source map read from a known local path. It is not a general arbitrary-file or runtime JavaScript execution advisory. Trusted-source-only compilation is the maintainer's stated unaffected case. The installed `@babel/core/lib/transformation/normalize-file.js:67–93` reads external map comments unless `inputSourceMap` is false; Expo's Babel transformer does not explicitly set that option. Metro's transform path includes Babel for TypeScript and other inputs. A malicious dependency or untrusted source checkout is therefore relevant to a developer/CI host; a normal mobile activity/goal payload does not enter this compiler.

**Fix implemented:** targeted resolution refresh to **7.29.6**, maintaining Babel 7 and Expo 56, with focused consumer regression proof above. This is within observed consumer ranges; do not jump to Babel 8. The documented fallback `inputSourceMap: false` would alter source-map composition and potentially Sentry debugging, so the patch release is preferable. Parent production export and full source-map validation remain pending. [Maintainer advisory](https://github.com/babel/babel/security/advisories/GHSA-4x5r-pxfx-6jf8), [Babel option](https://babeljs.io/docs/options#inputsourcemap), [published fixed metadata](https://registry.npmjs.org/@babel%2fcore/7.29.6).

### Glob: moderate, confirmed CLI timeout reliance

The flaw lets filesystem traversal continue after cancellation, consuming CPU/I/O after a caller believes a timeout ended it. Installed Expo CLI `build/src/start/doctor/typescript/TypeScriptProjectPrerequisite.js:175–190` calls its glob helper with `AbortSignal.timeout(5000)`. `build/src/utils/glob.js` also aborts a stream after the first result. This establishes a relevant tooling call path; no destructive or adversarial traversal was executed. The fixed root leaf is **14.0.2**; the installed ranges are `^13.0.0` for Expo tooling and `^10.4.2` for apple-targets, so neither accepts that major automatically. [Maintainer advisory](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4).

**Proposed bounded follow-up:** test a consumer-scoped override of **Expo CLI's glob to 14.0.2**, ensuring its minimatch resolves **11.0.1 or later**, to fix the confirmed CLI path first. It is a candidate requiring tests, not an SDK-certified replacement. Verify async/stream cancellation and fixed-pattern scans in a temporary synthetic tree, then Expo config/export. Other consumers and apple-targets remain findings until separately migrated. A global override would cross more major-version boundaries and affect Watch/extension generation; do not apply it as launch housekeeping. Fixed glob still offers CommonJS and the installed Node 24 meets its engine range, but that does not establish API compatibility with every consumer. [Published metadata](https://registry.npmjs.org/glob/14.0.2).

### Minimatch: moderate, pattern-dependent build-resource exhaustion

The reported amplification requires crafted patterns and `optimizationLevel >= 2`. Both installed glob copies set optimization level 2 (`dist/commonjs/glob.js` and `ignore.js`). Direct fingerprint ignore matching defaults to `{dot: true}` without an explicit level-2 override. Fixed application/asset scan patterns inspected are not attacker-supplied app data; repository/workspace ignore patterns and dependencies are the relevant trust boundary. The installed 9.x/10.x ranges cannot take **11.0.1** automatically. Upgrade candidates must cover **both** nested copies and fingerprint's direct edge; updating glob alone leaves that direct edge behind. For now keep patterns/configuration trusted and bounded; no observed endpoint accepts remote user glob patterns. [Maintainer advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249), [optimization semantics](https://github.com/isaacs/minimatch#optimizationlevel), [fixed metadata](https://registry.npmjs.org/minimatch/11.0.1).

### UUID: moderate inventory finding; inspected v4 caller does not meet advisory conditions

The affected APIs are **v3/v5/v6 with caller-provided output buffers/offsets**, not every use of UUIDs. The inspected legacy `xcode/lib/pbxProject.js:90` calls `uuid.v4()` without a supplied buffer. No triggering v3/v5/v6 call was found in the inspected Xcode tooling. The bacons package declares uuid 8.3.2; declaration alone does not prove an executed vulnerable call. These packages generate Xcode projects on the build host; they are not the Swift Watch recording/session implementation. [Maintainer advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq).

For later inventory cleanup, prefer supported config-plugin/Xcode parent upgrades. A scoped uuid **11.1.1** override under the two legacy parents is a smaller candidate than upgrading every uuid consumer, but still crosses parent ranges `^7.0.3`/`^8.3.2` and needs project-generation comparison. That version retains CommonJS exports; uuid 12+ removes CommonJS and is not a drop-in choice for these `require()` consumers. xcode 4.0.0 already removes uuid, but overriding legacy xcode wholesale would touch native generation. [UUID compatibility notes](https://github.com/uuidjs/uuid#upgrading-from-uuid10), [11.1.1 metadata](https://registry.npmjs.org/uuid/11.1.1), [xcode 4 metadata](https://registry.npmjs.org/xcode/4.0.0).

### Deepmerge: low, no published fix listed

The advisory concerns a returned object's inherited prototype when merging a malicious object; it is not evidence that the app globally pollutes `Object.prototype`. Installed Expo config uses it for config/plugin-option merging (`build/Config.js:415,453`). Inputs are repository/config tooling, not an observed activity-history or archive RPC payload path. Keep those inputs trusted; avoid claiming an invented patched 4.x release. Replacing the merger or filtering dangerous structures would need a separate upstream/config-focused change and behavior tests, not a release-time global substitution. [Current advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [upstream report and reproduction](https://github.com/TehShrike/deepmerge/issues/273).

## Native app versus development/build surfaces

- **Native release:** package-manager presence and the names `expo`/`expo-splash-screen` do not establish that the vulnerable Node APIs ship. Expo's runtime entry is `src/Expo.ts`; splash runtime entry is `build/index.js`; config plugins have separate entry points. The inspected findings concern compiler, local filesystem scanning, config merge and Xcode-generation APIs. No source import was found in `app`, `src`, `modules`, `targets`, `plugins`, or `scripts` for the five root libraries. This is source-based evidence, not a final-artifact module inventory or a dynamic reachability proof.
- **Build/prebuild/export:** the Node tools execute here, and compromised inputs can affect build-host availability/confidentiality or generated outputs. This boundary remains relevant even if the vulnerable library is absent from the shipped bundle. `@bacons/apple-targets` and splash config plugins are configured in `app.json`; their tooling is not merely unused lockfile debris.
- **Developer server/CLI:** Expo documents LAN as the default and `npx expo start --localhost` as the loopback-only option. Prefer loopback/trusted networks, no public tunnel, trusted workspaces, and externally bounded build processes while fixes are pending. Network isolation reduces access but does not repair timeout cancellation or a malicious source dependency. These advisories do not by themselves prove an unauthenticated dev-server exploit. [Expo CLI documentation](https://docs.expo.dev/more/expo-cli/#server-url).
- **Current native artifact:** this review did not retrieve an IPA, inspect its source map/module graph, check an installed device, change the release profile, or start Metro. Production EAS profile exists separately from the development-client profile in `eas.json`. Profile intent is not proof of what a particular installed binary contains. Expo describes native apps as a native runtime plus exported static JS/assets. [Expo build model](https://docs.expo.dev/more/expo-cli/#building).

## Upgrade tradeoffs and next evidence

The audit proposes **expo-splash-screen 55.0.25** as a semver-major remediation for some inherited findings. Reject that automatic downgrade for the SDK 56 app; it is not evidence of compatible splash/startup behavior. Do not remove working apple-targets/Watch configuration to silence inventory warnings, and do not upgrade the entire Expo SDK merely because a leaf patch exists. Expo's supported package-alignment/SDK upgrade workflow is a separate tested change. [SDK 56 reference](https://docs.expo.dev/versions/v56.0.0/), [Expo upgrade guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

The authorized Babel patch has been installed, scoped-diff checked, re-audited and tested as recorded above. The parent still owns full-suite, Expo dependency and production-export checks. Any subsequent native-generation change must be validated against the accepted Watch/extensions/startup baseline and device workflow. The present result is **Babel's specific finding fixed, with known residual tooling exposure and a separately bounded glob/Minimatch migration candidate**, not blanket clearance of Build 104.
