import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { StrideWatchStatus } from '../../../modules/stride-watch-connectivity/src';

type Props = {
  status: StrideWatchStatus;
  mutedColor: string;
  warningColor: string;
};

function age(timestamp: number | undefined, now: number): string {
  if (!timestamp) return 'never';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

/**
 * Runtime diagnostics for phone <-> watch sync: what the phone last sent and
 * how it was delivered, what the watch acknowledged, and the last workout
 * state the watch reported. Lets a TestFlight tester see which hop failed.
 */
export default function WatchStatusDiagnostics({ status, mutedColor, warningColor }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);

  const mark = (value: boolean) => (value ? '✓' : '✗');
  const ackRejected = status.lastAckAt && status.lastAckAccepted === false;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.line, { color: mutedColor }]}>
        Paired {mark(status.isPaired)} · Watch app {mark(status.isWatchAppInstalled)} · Reachable {mark(status.isReachable)} · {status.activationState}
      </Text>
      <Text style={[styles.line, { color: mutedColor }]}>
        Sent: {status.lastCommandType ?? 'none'}
        {status.lastCommandMethod ? ` via ${status.lastCommandMethod}` : ''}
        {status.lastCommandAt ? ` · ${age(status.lastCommandAt, now)}` : ''}
      </Text>
      <Text style={[styles.line, { color: ackRejected ? warningColor : mutedColor }]}>
        Watch ack: {status.lastAckAt
          ? `${status.lastAckCommand ?? 'command'} ${status.lastAckAccepted ? '✓' : `✗ ${status.lastAckReason ?? ''}`} · ${age(status.lastAckAt, now)}`
          : 'none'}
      </Text>
      <Text style={[styles.line, { color: mutedColor }]}>
        Watch state: {status.lastWatchState ?? 'none'}
        {status.lastWatchStateAt ? ` · ${age(status.lastWatchStateAt, now)}` : ''}
      </Text>
      {status.lastError ? (
        <Text style={[styles.line, { color: warningColor }]} numberOfLines={2}>Error: {status.lastError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, gap: 1 },
  line: { fontSize: 10.5, fontWeight: '500' },
});
