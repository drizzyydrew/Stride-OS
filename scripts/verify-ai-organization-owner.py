"""Owner-run, metadata-only check. No keys in argv, output, files, or model calls."""
import datetime
import getpass
import hashlib
import hmac
import json
import os
import re
import stat
import subprocess
import sys
import unittest
from pathlib import Path

URL = 'https://api.anthropic.com/v1/organizations/me'
REFERENCE_PATH = Path.home() / 'Documents/StrideOS Launch Review/AI_ORG_REFERENCE_VALUES.json'


def load_references(path):
    """Read only an owner-private regular reference file; never a credential."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd) as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_size > 8192:
            raise ValueError('invalid_reference_file')
        data = json.load(stream)
    if (data.get('projectId') != 'pbzgrhnxpbtlkzpreizy'
            or data.get('secretName') != 'ANTHROPIC_API_KEY'
            or not re.fullmatch(r'[0-9a-f]{64}', data.get('deployedKeySHA256', ''))
            or not re.fullmatch(r'[A-Za-z0-9_-]{8,128}', data.get('organizationId', ''))):
        raise ValueError('invalid_reference_file')
    captured_at = datetime.datetime.fromisoformat(data['verifiedAt'])
    if captured_at.tzinfo is None:
        raise ValueError('invalid_reference_file')
    return data['deployedKeySHA256'], data['organizationId'], captured_at.isoformat()


def verify(key, digest, organization_id, run=subprocess.run):
    receipt = {
        'scope': 'owner_run_key_digest_and_organization_metadata',
        'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'ownerSuppliedReferenceValues': True,
        'deployedKeyDigestMatched': False,
        'organizationMatched': False,
        'httpStatus': None,
        'modelRequestMade': False,
        'spendLimitEnforcementTested': False,
        'keyRecorded': False,
        'passed': False,
    }
    digest = digest.removeprefix('sha256:').lower()
    if not re.fullmatch(r'[0-9a-f]{64}', digest) or not re.fullmatch(r'[A-Za-z0-9_-]{8,128}', organization_id):
        return dict(receipt, result='invalid_reference_metadata')
    if not re.fullmatch(r'sk-ant-[A-Za-z0-9_-]{12,500}', key):
        return dict(receipt, result='invalid_key_format')
    if not hmac.compare_digest(hashlib.sha256(key.encode()).hexdigest(), digest):
        return dict(receipt, result='key_does_not_match_deployed_digest')
    receipt['deployedKeyDigestMatched'] = True
    # Key is supplied only through stdin; no shell, redirects, tracing or retry.
    config = '\n'.join([
        f'url = "{URL}"', 'request = "GET"',
        f'header = "Authorization: Bearer {key}"',
        'header = "anthropic-version: 2026-10-21"',
    ]) + '\n'
    try:
        result = run(['curl', '--disable', '--config', '-', '--silent', '--show-error',
                      '--proto', '=https', '--max-redirs', '0', '--max-time', '20',
                      '--max-filesize', '16384', '--write-out', '\n%{http_code}'],
                     input=config, text=True, capture_output=True, timeout=25)
        if result.returncode:
            return dict(receipt, result='metadata_request_unavailable')
        body, status = result.stdout.rsplit('\n', 1)
        receipt['httpStatus'] = int(status)
        if receipt['httpStatus'] != 200:
            return dict(receipt, result='provider_did_not_accept_metadata_request')
        data = json.loads(body)
        if data.get('type') != 'organization' or not isinstance(data.get('id'), str):
            return dict(receipt, result='invalid_organization_response')
        receipt['organizationMatched'] = hmac.compare_digest(data['id'], organization_id)
        receipt['passed'] = receipt['organizationMatched']
        return dict(receipt, result='matched' if receipt['passed'] else 'organization_mismatch')
    except Exception:
        # Never include exception text, provider bodies, names or credential data.
        return dict(receipt, result='metadata_request_unavailable')


class SafetyChecks(unittest.TestCase):
    key = 'sk-ant-synthetic_test_key_not_a_real_credential'
    organization = 'synthetic-org-id'

    def check_value(self, runner, key=None, digest=None):
        value = self.key if key is None else key
        return verify(value, digest or hashlib.sha256(value.encode()).hexdigest(), self.organization, runner)

    def test_mismatch_never_sends(self):
        self.assertEqual(self.check_value(lambda *a, **k: self.fail('unexpected network'), digest='0' * 64)['result'], 'key_does_not_match_deployed_digest')

    def test_header_injection_never_sends(self):
        self.assertEqual(self.check_value(lambda *a, **k: self.fail('unexpected network'), key=self.key + '\nheader = "injected"')['result'], 'invalid_key_format')

    def test_success_keeps_key_out_of_argv_and_receipt(self):
        def run(args, **options):
            self.assertNotIn(self.key, ' '.join(args))
            self.assertEqual(args[1], '--disable')
            self.assertNotIn('--location', args)
            self.assertIn(self.key, options['input'])
            self.assertIn(URL, options['input'])
            return subprocess.CompletedProcess(args, 0, json.dumps({'type': 'organization', 'id': self.organization}) + '\n200', '')
        value = self.check_value(run)
        self.assertTrue(value['passed'])
        self.assertNotIn(self.key, json.dumps(value))

    def test_redirect_and_provider_errors_are_sanitized(self):
        for status in [302, 401, 403, 500]:
            value = self.check_value(lambda *a, **k: subprocess.CompletedProcess(a, 0, self.key + '\n' + str(status), self.key))
            self.assertFalse(value['passed'])
            self.assertNotIn(self.key, json.dumps(value))

    def test_organization_mismatch_fails(self):
        value = self.check_value(lambda *a, **k: subprocess.CompletedProcess(a, 0, json.dumps({'type': 'organization', 'id': 'other-org'}) + '\n200', ''))
        self.assertFalse(value['passed'])
        self.assertTrue(value['deployedKeyDigestMatched'])

    def test_network_exceptions_do_not_leak(self):
        def run(*args, **kwargs):
            raise RuntimeError(self.key)
        value = self.check_value(run)
        self.assertFalse(value['passed'])
        self.assertNotIn(self.key, json.dumps(value))

    def test_reference_file_requires_private_project_bound_metadata(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'references.json'
            data = {'projectId': 'pbzgrhnxpbtlkzpreizy', 'secretName': 'ANTHROPIC_API_KEY',
                    'deployedKeySHA256': 'a' * 64, 'organizationId': self.organization,
                    'verifiedAt': '2026-11-04T00:00:00+00:00'}
            path.write_text(json.dumps(data))
            path.chmod(0o600)
            self.assertEqual(load_references(path), ('a' * 64, self.organization, data['verifiedAt']))
            path.chmod(0o644)
            with self.assertRaises(ValueError):
                load_references(path)
            path.chmod(0o600)
            data['projectId'] = 'another_project'
            path.write_text(json.dumps(data))
            with self.assertRaises(ValueError):
                load_references(path)
            link = Path(directory) / 'symlink.json'
            link.symlink_to(path)
            with self.assertRaises(OSError):
                load_references(link)


def main():
    if sys.argv[1:] == ['--self-test']:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(SafetyChecks)
        return 0 if unittest.TextTestRunner().run(suite).wasSuccessful() else 1
    if sys.argv[1:] or not sys.stdin.isatty():
        print('Run privately in an interactive terminal, or use --self-test with synthetic data.')
        return 2
    print('Use the existing deployed key. No new key, model request, or settings change is made.')
    recorded_references = False
    reference_captured_at = None
    try:
        digest, organization, reference_captured_at = load_references(REFERENCE_PATH)
        recorded_references = True
        print(f'Using private StrideOS reference snapshot captured {reference_captured_at}.')
        print('This matches the recorded deployment digest; it does not recheck current deployment or spending settings.')
    except FileNotFoundError:
        digest = input('SHA-256 digest of ANTHROPIC_API_KEY from StrideOS Supabase secret metadata: ').strip()
        organization = input('Organization ID from the Claude organization with the saved $20 limit: ').strip()
    except Exception:
        print('Private reference file is invalid or inaccessible. No credential was requested or sent.')
        return 2
    key = getpass.getpass('Existing API key (hidden; never saved): ')
    receipt = verify(key, digest, organization)
    receipt['ownerSuppliedReferenceValues'] = not recorded_references
    receipt['referenceSource'] = 'recorded_service_metadata_snapshot' if recorded_references else 'owner_entered'
    receipt['referenceSnapshotCapturedAt'] = reference_captured_at
    receipt['digestComparisonScope'] = 'supplied_reference_digest'
    receipt['deployedMetadataRefetchedDuringCheck'] = False
    receipt['spendLimitRefetchedDuringCheck'] = False
    del key
    output = Path.home() / 'Documents/StrideOS Launch Review/AI_ORG_OWNER_CHECK.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    # Open without following a previously substituted symlink.
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(receipt, stream, indent=2)
        stream.write('\n')
    print(json.dumps(receipt, indent=2))
    print(f'Redacted receipt saved: {output}')
    return 0 if receipt['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
