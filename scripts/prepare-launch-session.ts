/** Read-only preparation checks. Never approves a public launch. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyRevenueCatServerBoundary } from './verify-revenuecat-server';

const BUILD = '111';
const BUILD_ID = 'be1f0cb0-dc73-4089-839a-4e23d1af4a86';
const SOURCE_COMMIT = 'dc318bf8e9c296efc3ef63351bb2d7dca8b3faa2';
export const PUBLIC_PAGES = ['', 'support.html', 'privacy.html', 'terms.html']
  .map(path => `https://drizzyydrew.github.io/Stride-OS/${path}`);
export const HUMAN_GATES = ['signup_confirmation_and_recovery_edges', 'deployed_ai_spending_enforcement',
  'native_phone_watch_acceptance', 'real_provider_account_deletion',
  'sandbox_purchase_lifecycle', 'current_native_screenshots', 'public_name_clearance', 'final_submission_decision'];

type Check = { name: string; passed: boolean; httpStatus?: number | null };
type Dependencies = {
  read?: (relativePath: string) => string;
  fetch?: typeof fetch;
  now?: () => Date;
};

export async function prepareLaunchSession(live = false, deps: Dependencies = {}) {
  const read = deps.read ?? (name => readFileSync(resolve(__dirname, '..', name), 'utf8'));
  const checks: Check[] = [];
  // These are stored receipts, not a fresh Apple/account/device acceptance.
  try {
    const app = JSON.parse(read('app.json')).expo;
    const eas = JSON.parse(read('eas.json'));
    const archive = JSON.parse(read('docs/handoff/BUILD111_ARTIFACT_VERIFICATION.json'));
    const apple = JSON.parse(read('docs/handoff/BUILD111_APPLE_ACCEPTANCE.json')).build;
    const expected = ['com.mooremovement.strideos', 'com.mooremovement.strideos.watch',
      'com.mooremovement.strideos.liveactivity'].sort();
    checks.push({ name: 'canonical_internal_candidate_111_billing_off', passed:
      app.ios.buildNumber === BUILD && eas.build.production.env.EXPO_PUBLIC_STRIDEOS_BILLING_ENABLED === 'false' });
    checks.push({ name: 'stored_archive_receipt_matches_111', passed:
      archive.buildId === BUILD_ID && archive.sourceCommit === SOURCE_COMMIT
      && archive.buildNumber === BUILD && archive.profile === 'production'
      && archive.billingOffByProductionProfile === true
      && archive.compiled1024Icons?.some((icon: { PixelWidth: number; PixelHeight: number; Opaque: boolean; Idiom: string }) =>
        icon.PixelWidth === 1024 && icon.PixelHeight === 1024 && icon.Opaque === true && icon.Idiom === 'phone') === true
      && archive.privacyManifestsParsed === 21 && archive.noCredentialFilenamesInArchive === true
      && archive.targets?.length === 3
      && JSON.stringify(archive.targets.map((t: { bundleId: string }) => t.bundleId).sort()) === JSON.stringify(expected)
      && archive.targets.every((t: { build: string; strictSignatureVerified: boolean }) =>
        t.build === BUILD && t.strictSignatureVerified === true) });
    checks.push({ name: 'stored_apple_receipt_matches_internal_111', passed:
      apple.buildNumber === BUILD && apple.easBuildId === BUILD_ID
      && apple.processingState === 'VALID' && apple.internalState === 'IN_BETA_TESTING' && apple.expired === false });
  } catch {
    // No raw paths, exception text, receipt bodies, account information or keys.
    checks.push({ name: 'local_candidate_receipts_available_and_valid', passed: false });
  }
  if (live) {
    const boundary = await verifyRevenueCatServerBoundary({ fetch: deps.fetch, now: deps.now });
    checks.push(...boundary.checks.map(c => ({ name: c.name, passed: c.passed, httpStatus: c.httpStatus })));
    for (const url of PUBLIC_PAGES) {
      try {
        const response = await (deps.fetch ?? fetch)(url, { method: 'GET', credentials: 'omit',
          redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
        await response.body?.cancel();
        checks.push({ name: `public_page_${url.split('/').pop() || 'home'}`, passed: response.status === 200,
          httpStatus: response.status });
      } catch {
        checks.push({ name: `public_page_${url.split('/').pop() || 'home'}`, passed: false, httpStatus: null });
      }
    }
  }
  return { scope: 'read_only_session_preparation', checkedAt: (deps.now ?? (() => new Date()))().toISOString(),
    internalCandidate: BUILD, candidateSourceCommit: SOURCE_COMMIT,
    publicDraftEvidence: 'See CURRENT_LAUNCH_STATUS.md; this tool does not read the live App Store draft.',
    storedAppleEvidenceOnly: true, livePublicChecksRun: live,
    checks, preparationChecksPassed: checks.every(c => c.passed),
    humanGates: HUMAN_GATES.map(name => ({ name, status: 'NOT_ACCEPTED_BY_THIS_TOOL' })),
    publicLaunchReady: false, purchaseLifecycleVerified: false, providerDeletionVerified: false,
    emailSent: false, aiRequestMade: false, settingsChanged: false };
}

export async function runPreparationCli(args: readonly string[], deps: Dependencies & {
  write?: (line: string) => void;
} = {}) {
  const write = deps.write ?? (line => process.stdout.write(`${line}\n`));
  if (args.length > 1 || args.some(arg => !['--live', '--help'].includes(arg))) {
    write('Usage: tsx scripts/prepare-launch-session.ts [--live|--help]'); return 2;
  }
  if (args[0] === '--help') {
    write('Default: stored internal-candidate-111 receipts only, no network or credentials.');
    write('--live: fixed-host public GET/OPTIONS checks only; no emails, purchases, AI or deletion.');
    write('Successful preparation checks never accept human gates or approve a public launch.');
    return 0;
  }
  const result = await prepareLaunchSession(args[0] === '--live', deps);
  write(JSON.stringify(result, null, 2));
  return result.preparationChecksPassed ? 0 : 1;
}

if (typeof require !== 'undefined' && require.main === module) {
  void runPreparationCli(process.argv.slice(2)).then(code => { process.exitCode = code; })
    .catch(() => { process.stderr.write('Preparation check unavailable; no private diagnostics printed.\n'); process.exitCode = 1; });
}
