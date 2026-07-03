import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue, StyleProp, TextStyle } from 'react-native';

import { useTheme } from '../../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export default function Icon({
  name,
  size = 20,
  color,
  style,
  accessibilityLabel,
}: IconProps) {
  const theme = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? theme.colors.icon}
      style={style}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
