import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Button from '../components/ui/Button';
import { useThemeColors, type ThemeColors } from '../theme/ThemeContext';
import { spacing } from '../theme/spacing';
import { FontSize, FontWeight } from '../theme/tokens';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon:        IoniconsName;
  title:       string;
  description: string;
  action?:     { label: string; onPress: () => void };
};

export default function EmptyState({ icon, title, description, action }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={36} color={colors.textDim} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          style={{ marginTop: spacing.xl, alignSelf: 'center', paddingHorizontal: spacing.xxl }}
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems:        'center',
      paddingVertical:   spacing.xxl,
      paddingHorizontal: spacing.xl,
    },
    iconWrap: {
      width:           72,
      height:          72,
      borderRadius:    36,
      backgroundColor: colors.card,
      alignItems:      'center',
      justifyContent:  'center',
      marginBottom:    spacing.xl,
    },
    title: {
      color:        colors.text,
      fontSize:     FontSize.md,
      fontWeight:   FontWeight.bold,
      marginBottom: spacing.sm,
      textAlign:    'center',
    },
    description: {
      color:      colors.textMuted,
      fontSize:   FontSize.sm,
      textAlign:  'center',
      lineHeight: 20,
    },
  });
}
