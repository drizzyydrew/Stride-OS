import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '../../theme/useColors';
import { isGpsSignalWeak } from '../../utils/gpsSignal';

/**
 * Tells the athlete that recording continues when GPS accuracy drops (lost
 * Wi-Fi/cell assistance, tree cover, canyons). Time keeps counting from the
 * clock; distance for the gap is added when a good fix returns.
 */
export default function GpsSignalChip(props: {
  active: boolean;
  paused: boolean;
  lastGoodFixAt: number | null | undefined;
  startedAt: number | null | undefined;
}) {
  const C = useColors();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!props.active || props.paused) return undefined;
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, [props.active, props.paused]);

  if (!isGpsSignalWeak({ ...props, now })) return null;

  return (
    <View style={[styles.chip, { backgroundColor: C.cardAlt, borderColor: C.warning }]} accessibilityRole="text">
      <Ionicons name="navigate-circle-outline" size={14} color={C.warning} />
      <Text style={[styles.text, { color: C.warning }]}>Weak GPS · still recording</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  text: { fontSize: 12, fontWeight: '600' },
});
