import assert from 'node:assert/strict';
import test from 'node:test';
import { STANDARD_DISTANCE_METERS, type RacePR, type StandardDistance } from '../../types/athlete';
import { decodeRacePrLedger, nextRacePrLedger, racePrBestByDistance, racePrNotificationIsCurrent, RACE_PR_BADGE_IDS, RACE_PR_DISTANCES } from '../racePrAwards';
import { accountCleanupKeys, isAccountDataKey } from '../../lib/localAccountCleanupManifest';
import { createAccountStorageBarrier } from '../../lib/localAccountCleanup';

const NOW = new Date('2026-11-05T16:00:00Z').getTime();
function pr(id = 'new', seconds = 1500, key: StandardDistance = '5k', recordedAt = NOW): RacePR {
  return { id, distanceKey: key, distanceLabel: key, distanceMeters: STANDARD_DISTANCE_METERS[key]!, timeSeconds: seconds, date: '2026-11-04', official: true, recordedAt };
}
function initialized(records: RacePR[] = []) { return nextRacePrLedger(null, records, 'owner', NOW - 1000).ledger; }

test('six exact event classes qualify, including sub-five-minute mile and 800m', () => {
  const records = RACE_PR_DISTANCES.map((key, index) => pr(key, key === '800m' ? 130 : key === '1_mile' ? 250 : 1500 + index, key));
  assert.deepEqual(Object.keys(racePrBestByDistance(records, NOW)), RACE_PR_DISTANCES);
  assert.equal(RACE_PR_BADGE_IDS['1_mile'], 'race_pr_1_mile');
});

test('custom/rounded/mismatched distances and invalid/future elapsed evidence cannot earn a class', () => {
  const invalid = [ { ...pr(), distanceKey: 'custom' as const }, { ...pr(), distanceMeters: 4999.9 },
    { ...pr(), distanceKey: 'half_marathon' as const, distanceMeters: 13.1 * 1609.344 },
    { ...pr(), date: '2027-01-01' }, { ...pr(), timeSeconds: 0 }, { ...pr(), timeSeconds: Infinity } ];
  assert.deepEqual(racePrBestByDistance(invalid, NOW), {});
});

test('initial complete historical snapshot unlocks earned badges silently', () => {
  const result = nextRacePrLedger(null, [pr('first'), pr('other', 2800, '10k')], 'owner', NOW);
  assert.deepEqual(result.notifications, []);
  assert.deepEqual(result.ledger.earnedDistances, ['5k', '10k']);
});

test('a newly logged first result creates baseline PR celebration, even when event date is historical', () => {
  const result = nextRacePrLedger(initialized(), [pr()], 'owner', NOW);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].previousTimeSeconds, undefined);
  assert.equal(result.notifications[0].timeSeconds, 1500);
});

test('only a strictly faster newly completed source repeats a distance celebration', () => {
  const baseline = pr('baseline', 1500, '5k', NOW - 2000);
  const ledger = initialized([baseline]);
  assert.equal(nextRacePrLedger(ledger, [baseline, pr('tie', 1500)], 'owner', NOW).notifications.length, 0);
  assert.equal(nextRacePrLedger(ledger, [baseline, pr('slower', 1550)], 'owner', NOW).notifications.length, 0);
  const improved = nextRacePrLedger(ledger, [baseline, pr('faster', 1440)], 'owner', NOW);
  assert.equal(improved.notifications.length, 1);
  assert.equal(improved.notifications[0].previousTimeSeconds, 1500);
  assert.equal(nextRacePrLedger(improved.ledger, [baseline, pr('faster', 1440)], 'owner', NOW).notifications.length, 0);
});

test('same-source correction updates current best without repeated celebration', () => {
  const ledger = initialized([pr('same', 1500, '5k', NOW - 2000)]);
  const result = nextRacePrLedger(ledger, [pr('same', 1440)], 'owner', NOW);
  assert.equal(result.ledger.best['5k']?.timeSeconds, 1440);
  assert.deepEqual(result.notifications, []);
});

test('deleted/re-added source and identical result under another provenance do not replay', () => {
  const old = pr('original', 1500, '5k', NOW - 2000);
  const deleted = nextRacePrLedger(initialized([old]), [], 'owner', NOW).ledger;
  assert.equal(deleted.best['5k'], undefined);
  assert.deepEqual(deleted.earnedDistances, ['5k']);
  assert.equal(nextRacePrLedger(deleted, [pr('original')], 'owner', NOW).notifications.length, 0);
  assert.equal(nextRacePrLedger(deleted, [{ ...pr('archive-copy'), source: { kind: 'goal_archive', archiveId: 'a', ownerUserId: 'owner' } }], 'owner', NOW).notifications.length, 0);
});

test('withdrawn invalid best does not create an irrevocable fastest-ever floor', () => {
  const deleted = nextRacePrLedger(initialized([pr('typo', 1, '5k', NOW - 2000)]), [], 'owner', NOW - 500).ledger;
  const result = nextRacePrLedger(deleted, [pr('legitimate', 1500)], 'owner', NOW);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.ledger.best['5k']?.timeSeconds, 1500);
});

test('late historical imports with missing, old or future creation stamps unlock quietly', () => {
  for (const recordedAt of [undefined, NOW - 2000, NOW + 1000, NaN]) {
    const result = nextRacePrLedger(initialized(), [{ ...pr(), recordedAt }], 'owner', NOW);
    assert.equal(result.notifications.length, 0);
    assert.deepEqual(result.ledger.earnedDistances, ['5k']);
  }
});

test('foreign source metadata cannot contribute to this owner ledger', () => {
  const foreign = { ...pr(), source: { kind: 'activity' as const, activityId: 'private', ownerUserId: 'other' } };
  assert.deepEqual(nextRacePrLedger(initialized(), [foreign], 'owner', NOW).ledger.earnedDistances, []);
});

test('ledger decode preserves owner namespace and rejects malformed storage without empty replacement', () => {
  const ledger = initialized([pr()]);
  assert.deepEqual(decodeRacePrLedger(JSON.stringify(ledger), 'owner'), ledger);
  assert.throws(() => decodeRacePrLedger(JSON.stringify(ledger), 'other'), /not been reset/);
  assert.throws(() => decodeRacePrLedger('{bad', 'owner'));
  assert.throws(() => decodeRacePrLedger(JSON.stringify({ ...ledger, best: { '5k': { timeSeconds: -1 } } }), 'owner'));
});

test('queued event is hidden after source withdrawal/correction, new better result, owner or athlete change', () => {
  const record = pr();
  const event = nextRacePrLedger(initialized(), [record], 'owner', NOW).notifications[0];
  assert.equal(racePrNotificationIsCurrent(event, [record], 'owner', 'athlete_default', NOW), true);
  assert.equal(racePrNotificationIsCurrent(event, [], 'owner', 'athlete_default', NOW), false);
  assert.equal(racePrNotificationIsCurrent(event, [pr('new', 1400)], 'owner', 'athlete_default', NOW), false);
  assert.equal(racePrNotificationIsCurrent(event, [record, pr('better', 1400)], 'owner', 'athlete_default', NOW), false);
  assert.equal(racePrNotificationIsCurrent(event, [record], 'other', 'athlete_default', NOW), false);
  assert.equal(racePrNotificationIsCurrent(event, [record], 'owner', 'secondary', NOW), false);
});

test('PR ledger is classified for owner cleanup and foreign ledgers stop purge', async () => {
  const key = 'race-pr-awards:owner:athlete_default';
  assert.equal(isAccountDataKey(key), true);
  assert.deepEqual(accountCleanupKeys([key, 'theme-store'], 'owner'), [key]);
  assert.throws(() => accountCleanupKeys(['race-pr-awards:other:athlete_default'], 'owner'), /Another owner/);
  const barrier = createAccountStorageBarrier(); barrier.setMode('open');
  const storage = barrier.wrap({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {} });
  barrier.setMode('purging');
  await assert.rejects(storage.setItem(key, '{}'), /fenced/);
});

test('first PR entered during initial hydration celebrates while older restored records seed quietly', () => {
  const old = pr('restored', 1550, '5k', NOW - 10_000);
  const fresh = pr('typed-while-loading', 1500, '5k', NOW - 100);
  const planned = nextRacePrLedger(null, [old, fresh], 'owner', NOW, NOW - 1000);
  assert.equal(planned.notifications.length, 1);
  assert.equal(planned.notifications[0].sourcePerformanceId, fresh.id);
  assert.equal(planned.notifications[0].previousTimeSeconds, 1550);
  assert.equal(planned.ledger.initializedAt, NOW - 1000);
  assert.equal(nextRacePrLedger(null, [old], 'owner', NOW, NOW - 1000).notifications.length, 0);
  const first = nextRacePrLedger(null, [pr('first-during-loading')], 'owner', NOW, NOW - 1000);
  assert.equal(first.notifications.length, 1);
  assert.equal(first.notifications[0].previousTimeSeconds, undefined);
});
