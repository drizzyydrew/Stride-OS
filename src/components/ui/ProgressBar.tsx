import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { radiusTokens } from '../../theme/tokens';

type Props = {
  progress:    number;   // 0–1
  color:       string;
  height?:     number;
  trackColor?: string;
  style?:      ViewStyle;
};

export default function ProgressBar({ progress, color, height = 6, trackColor, style }: Props) {
  const fill = `${Math.min(1, Math.max(0, progress)) * 100}%` as `${number}%`;
  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor ?? colors.border, borderRadius: radiusTokens.pill },
        style,
      ]}
    >
      <View style={{ width: fill, height, backgroundColor: color, borderRadius: radiusTokens.pill }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
});
