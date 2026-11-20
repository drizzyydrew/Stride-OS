import { createElement } from 'react';
import { View, Text } from 'react-native';
import { Host, Picker } from '@expo/ui';
import { useThemeMode } from '../../store/themeStore';
import { useColors } from '../../theme/useColors';
import type { StoryIllustration } from '../../utils/shareEverydayEquivalent';

export default function StoryIllustrationPicker({ value, routeAvailable, everydayAvailable, onChange }: {
  value: StoryIllustration; routeAvailable: boolean; everydayAvailable: boolean;
  onChange: (value: StoryIllustration) => void;
}) {
  const C = useColors();
  const mode = useThemeMode();
  const options: { value: StoryIllustration; label: string }[] = [{ value: 'none', label: 'None' }];
  if (routeAvailable) options.push({ value: 'route', label: 'Route' });
  if (everydayAvailable) options.push({ value: 'everyday', label: 'Everyday equivalent' });
  const label = 'Story illustration';
  const contents = <>
    <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} style={{ width: '100%', minHeight: 44 }}>
      {process.env.EXPO_OS === 'ios' ? <IOSIllustrationPicker value={value} options={options} onChange={onChange} />
        : <Picker selectedValue={value} onValueChange={onChange} testID="story-illustration">
          {options.map(option => <Picker.Item key={option.value} value={option.value} label={option.label} />)}
        </Picker>}
    </Host>
    <Text style={{ color: C.textMuted, fontSize: 12, lineHeight: 17 }}>Choose one illustration. Route and Everyday equivalent use the same space.</Text>
  </>;
  return process.env.EXPO_OS === 'web'
    ? createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 } }, contents)
    : <View style={{ gap: 6, minWidth: 0, width: '100%' }}>{contents}</View>;
}

// Universal Picker drops its label on iOS; keep the native menu explicitly named.
function IOSIllustrationPicker({ value, options, onChange }: {
  value: StoryIllustration; options: { value: StoryIllustration; label: string }[];
  onChange: (value: StoryIllustration) => void;
}) {
  if (process.env.EXPO_OS !== 'ios') return null;
  const { Picker: IOSPicker, Text: IOSText } = require('@expo/ui/swift-ui') as typeof import('@expo/ui/swift-ui');
  const { pickerStyle, accessibilityLabel, frame, tag } = require('@expo/ui/swift-ui/modifiers') as typeof import('@expo/ui/swift-ui/modifiers');
  return <IOSPicker label="Story illustration" selection={value} onSelectionChange={onChange}
    modifiers={[pickerStyle('menu'), accessibilityLabel('Story illustration'), frame({ minHeight: 44 })]}>
    {options.map(option => <IOSText key={option.value} modifiers={[tag(option.value)]}>{option.label}</IOSText>)}
  </IOSPicker>;
}
