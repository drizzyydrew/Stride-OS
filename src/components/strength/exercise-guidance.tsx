import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host } from '@expo/ui';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';

export type ExerciseGuidanceContent = {
  how: string; cues: string; feel: string; stop: string; easier: string;
};
const SECTIONS: { key: keyof ExerciseGuidanceContent; label: string }[] = [
  { key: 'how', label: 'How to perform' },
  { key: 'cues', label: 'Coaching cues' },
  { key: 'feel', label: 'What it should feel like' },
  { key: 'stop', label: 'When to stop or modify' },
  { key: 'easier', label: 'Easier alternatives' },
];

/** Each section starts closed and opens independently. React Native owns the
 * paragraph width, avoiding intrinsic-width native disclosure overflow. */
export default function ExerciseGuidance({ content }: { content: ExerciseGuidanceContent }) {
  const C = useColors(), mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState<Partial<Record<keyof ExerciseGuidanceContent, boolean>>>({});
  return <View style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
    {SECTIONS.map(({ key, label }) => <View key={key} style={{ minWidth: 0, width: '100%' }}>
      <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all"
        style={{ width: '100%', minHeight: 44 }}>
        <Collapsible label={label} isOpen={!!open[key]}
          onOpenChange={value => setOpen(previous => ({ ...previous, [key]: value }))}
          labelStyle={{ color: C.textMuted, fontSize: 12 * fontScale, fontWeight: '600' }} />
      </Host>
      {open[key] ? <Text selectable style={{ color: C.textMuted, fontSize: 12, lineHeight: 19,
        width: '100%', flexShrink: 1, paddingHorizontal: 4, paddingBottom: 10 }}>{content[key]}</Text> : null}
    </View>)}
  </View>;
}
