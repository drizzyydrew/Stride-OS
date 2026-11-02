import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// Offline source/inventory tests. Actual disposable PostgreSQL behavior lives
// in launchSecuritySql.test.ts; no deployed connection or network is used.
const audit = readFileSync('scripts/auditLaunchSecurity.sql', 'utf8');
const handoff = readFileSync('docs/handoff/LAUNCH_SECURITY_20261102.md', 'utf8');
const migrationName = '20261102083331_launch_owner_policy_hardening.sql';
const maintenanceName = '20261102100131_launch_legacy_maintenance_privileges.sql';
const sourceHead = 'cbf1932';

// Historical catalog issues, not user records. Main owns this capture; its
// policy/trigger evidence must stay historical rather than becoming a live
// expectation updater. All other runtime properties come from source.
const capture = JSON.parse(readFileSync('docs/handoff/LAUNCH_SECURITY_CATALOG_20261102.json', 'utf8'));
const issues = capture.phases.catalog.issues as Array<{
  check_id: string; target: string; observed: { command?: string; using?: string | null;
    check?: string | null; body_md5?: string };
}>;

test('legacy service denial matches current source consumers rather than invented CRUD needs', () => {
  function files(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
      ? files(join(directory, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []);
  }
  for (const file of ['src', 'app', 'supabase/functions'].flatMap(files)) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /\.from\(\s*['"](?:movement_videos|analysis_requests)['"]\s*\)/,
      `new legacy consumer requires a deliberate audit contract review: ${file}`);
  }
  assert.match(audit, /role_name='service_role' and kind='legacy_owner' then case when not allowed and not grantable then 'PASS' else 'FAIL' end/);
  assert.ok(audit.indexOf("role_name='service_role' and kind='legacy_owner'")
    < audit.indexOf("when role_name='service_role' then"));
});

test('all migration-backed function hashes, modes and RPC signatures replay the pinned baseline', () => {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', sourceHead, 'supabase/migrations'], { encoding: 'utf8' }).trim().split('\n');
  const extensions = ['20261102081943_apple_grant_custody.sql', migrationName, maintenanceName];
  type Contract = { hash: string; definer: string; names: string; result: string; defaults: number };
  const expected = new Map<string, Contract>();
  const pattern = /create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\((.*?)\)\s*returns\s+(\w+)(.*?)\bas\s*\$\$(.*?)\$\$/gis;
  const move = /alter function\s+([\w.]+)\(([^)]*)\)\s+set schema\s+(\w+)\s*;/gi;
  const rename = /alter function\s+([\w.]+)\(([^)]*)\)\s+rename to\s+(\w+)\s*;/gi;
  for (const path of [...paths, ...extensions.map(name => `supabase/migrations/${name}`)]) {
    const source = extensions.some(name => path.endsWith(name)) ? readFileSync(path, 'utf8')
      : execFileSync('git', ['show', `${sourceHead}:${path}`], { encoding: 'utf8' });
    const events = [
      ...[...source.matchAll(pattern)].map(match => ({kind:'create', match})),
      ...[...source.matchAll(move)].map(match => ({kind:'move', match})),
      ...[...source.matchAll(rename)].map(match => ({kind:'rename', match})),
    ].sort((a,b) => a.match.index! - b.match.index!);
    for (const {kind,match} of events) {
      if (kind !== 'create') {
        const types = match[2].replace(/\s/g,'');
        const oldSignature = `${match[1]}(${types})`;
        const [schema,name] = match[1].split('.');
        const newSignature = `${kind==='move' ? match[3] : schema}.${kind==='rename' ? match[3] : name}(${types})`;
        assert.ok(expected.has(oldSignature),oldSignature);
        expected.set(newSignature,expected.get(oldSignature)!); expected.delete(oldSignature);
        continue;
      }
      const args = match[2].split(',').map(arg => arg.trim()).filter(Boolean).map(arg => arg.split(/\s+/));
      expected.set(`${match[1]}(${args.map(arg => arg[1]).join(',')})`, {
        hash: createHash('md5').update(match[5]).digest('hex'),
        definer: String(/\bsecurity\s+definer\b/i.test(match[4])),
        names: args.map(arg => arg[0]).join(','), result: match[3],
        defaults: args.filter(arg => arg.includes('default')).length,
      });
    }
  }
  assert.equal(expected.size, 47);
  const bodies = new Map([...audit.matchAll(/\('([^']+)','([a-f0-9]{32})',(true|false),'[^']+'\)/g)]
    .map(match => [match[1], { hash: match[2], definer: match[3] }]));
  const argumentsBySignature = new Map([...audit.matchAll(/\('([^']+)','([^']*)','(boolean|jsonb|uuid|text|integer|void|trigger|event_trigger)',(\d+)\)/g)]
    .map(match => [match[1], { names: match[2], result: match[3], defaults: Number(match[4]) }]));
  assert.equal(bodies.size, 49);
  assert.equal(argumentsBySignature.size, 49);
  for (const [signature, contract] of expected) {
    assert.deepEqual(bodies.get(signature), { hash: contract.hash, definer: contract.definer }, signature);
    assert.deepEqual(argumentsBySignature.get(signature), {
      names: contract.names, result: contract.result, defaults: contract.defaults,
    }, signature);
  }
  for (const name of extensions) {
    const hash = createHash('sha256').update(readFileSync(`supabase/migrations/${name}`)).digest('hex');
    assert.ok(audit.includes(`'${name}','${hash}'`),`reviewed whole migration changed: ${name}`);
  }
  assert.equal(expected.get('public.start_stride_deletion(uuid,text,jsonb)')!.hash,'690c1a331fe6c8115e850d6c5fb9da2b');
  assert.equal(expected.get('stride_apple_private.read_deletion_tokens_before_grants(uuid,uuid)')!.hash,'650426b1470f92e7fe77c8fdcd5f6b93');
});

test('main-reviewed trigger bodies are explicit exceptions; later drift still fails all contract checks', () => {
  const approved = {
    'public.handle_new_user()': 'fc0e692c32cd0f78ccc2f2a239cea040',
    'public.rls_auto_enable()': '99be20677b456ea8d3be47bdd44fb369',
  };
  for (const [signature, hash] of Object.entries(approved)) {
    assert.ok(audit.includes(`('${signature}','${hash}',true,'service')`));
    assert.equal(issues.find(issue => issue.target === signature)?.observed.body_md5, hash);
  }
  const contract = audit.slice(audit.indexOf("select 'function_contract'"), audit.indexOf("select 'function_execute'"));
  assert.match(contract, /md5\(prosrc\)=body_md5 and prosecdef=definer/);
  assert.ok(contract.includes("then 'search_path=pg_catalog' else 'search_path=' end"));
  assert.ok(contract.includes('roles.oid=proowner'));
  assert.match(contract, /then 'PASS' else 'FAIL' end/);
  assert.ok(handoff.includes('pg_event_trigger_ddl_commands'));
  assert.ok(handoff.includes('INSERT public.profiles(id,email)'));
});

test('audit remains one combined read-only SELECT without app-RPC/customer/secret reads', () => {
  const uncommented = audit.replace(/--[^\n]*/g, '');
  const unquoted = uncommented.replace(/'(?:''|[^'])*'/g, "''");
  const statements = unquoted.split(';').map(part => part.trim()).filter(Boolean);
  assert.deepEqual(statements.map(part => part.split(/\s+/)[0].toLowerCase()), ['begin', 'set', 'set', 'set', 'with', 'rollback']);
  assert.match(statements[0], /read only/i);
  assert.doesNotMatch(unquoted, /\b(?:insert|update|delete|create|alter|drop|grant|revoke|truncate|execute|perform|call|copy)\b/i);
  assert.doesNotMatch(unquoted, /\b(?:from|join)\s+(?:auth\.(?:users|identities)|storage\.objects|vault\.(?:secrets|decrypted_secrets)|public\.(?:profiles|activity_logs|stride_account_deletion_requests))\b/i);
  assert.doesNotMatch(unquoted, /\bgateway_apikey\b/i);
  assert.doesNotMatch(unquoted, /\bpublic\.[a-z_]+\s*\(/i);
  assert.ok(audit.includes("'audit','strideos-launch-security-v5'"));
  assert.ok(audit.includes("'phases',jsonb_object_agg(phase,result)"));
  assert.ok(audit.includes(`'pending_migration','${maintenanceName}'`));
  assert.doesNotMatch(audit,/APPLE_INFLIGHT_REVIEW_PENDING|apple_revision_review/);
});

// These are the actual-diff-approved bytes, not values discovered from a live DB.
test('approval identity pins source files and all public Apple RPC audiences', () => {
  for (const [path, hash] of Object.entries({
    'supabase/migrations/20261102081943_apple_grant_custody.sql':'747d3e324a7856eb113f372c37f3469d359d8a6a6dc02a802c64a27372cbc1b3',
    'supabase/functions/_shared/deletionRuntime.ts':'9dc2ee56a854cd167cefc2678ca8a29d3737adffdabb93ea6204a30688b3c76b',
    'src/utils/deletionFulfillment.ts':'19b5319a6c93c8096838f60f13cda549ab37ac6862d227856e014fe937a26131',
  })) {
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), hash, `approved source drift: ${path}`);
    assert.ok(audit.includes(hash));
  }
  const source = readFileSync('supabase/migrations/20261102081943_apple_grant_custody.sql','utf8');
  const signatures = [...source.matchAll(/create (?:or replace )?function (public\.\w+)\(([^)]*)\)/g)]
    .map(m => `${m[1]}(${m[2].split(',').map(arg => arg.trim().split(/\s+/)[1]).join(',')})`);
  assert.equal(signatures.length,10);
  const publicContracts = new Map([...audit.matchAll(/\('([^']+)','[a-f0-9]{32}',true,'([^']+)'\)/g)]
    .map(m => [m[1], m[2]]));
  for (const signature of signatures) assert.equal(publicContracts.get(signature),'service',signature);
});
