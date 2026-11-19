import { useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Collapsible, Host, RNHostView, Switch } from '@expo/ui';
import { GoalPicker } from '../goals/GoalLifecycleCard';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';
import type { StrengthLevel } from '../../types/training';
import type { EquipmentOption } from '../../types/strength';
import { STRENGTH_EQUIPMENT_OPTIONS, strengthEquipmentSelection, strengthSessionMinutes, toggleStrengthEquipment } from '../../utils/strengthSessionFit';

export type StrengthSessionFitValue = {
  strengthLevel: StrengthLevel;
  strengthSessionMinutes?: number;
  strengthEquipment?: EquipmentOption[];
};

export default function StrengthSessionFit({ value, onChange, showExperience = false, description, disabled = false }: {
  value: StrengthSessionFitValue;
  onChange: (patch: Partial<StrengthSessionFitValue>) => void | Promise<void>;
  showExperience?: boolean;
  description?: string;
  disabled?: boolean;
}) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const equipment = strengthEquipmentSelection(value.strengthEquipment);
  const minutes = strengthSessionMinutes(value.strengthSessionMinutes);
  const choices = [...new Set([20, 30, 45, 60, 90, ...(minutes ? [minutes] : [])])].sort((a, b) => a - b);
  async function change(patch: Partial<StrengthSessionFitValue>) {
    if (busy.current || disabled) return;
    busy.current = true; setSaving(true); setError('');
    try { await onChange(patch); }
    catch { if (mounted.current) setError('Could not save this choice. Please try again.'); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  }
  const copy = { color: C.textMuted, fontSize: 13, lineHeight: 20 };
  return <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary}
    ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
    <Collapsible label="Strength session fit" labelStyle={{ color: C.text, fontSize: 15 * fontScale, fontWeight: '600' }} isOpen={open} onOpenChange={setOpen}>
      {open ? <RNHostView matchContents={{ vertical: true }}><View style={{ width: '100%', minWidth: 0, gap: 12, paddingVertical: 12 }}>
        <Text style={copy}>{description ?? 'Optional: choose the time and equipment you can use for strength sessions.'}</Text>
        {showExperience ? <GoalPicker<StrengthLevel> label="Lifting experience" value={value.strengthLevel}
          disabled={saving || disabled} onChange={next => { void change({ strengthLevel: next }); }}
          options={[{ value: 'none', label: 'No lifting background' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} /> : null}
        <GoalPicker label="Time per strength session" value={minutes?.toString() ?? 'unknown'} disabled={saving || disabled}
          onChange={next => { void change({ strengthSessionMinutes: next === 'unknown' ? undefined : Number(next) }); }}
          options={[{ value: 'unknown', label: 'Not set' }, ...choices.map(choice => ({ value: String(choice), label: `${choice} minutes` }))]} />
        <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
          <Switch label="Tailor to my equipment" value={equipment !== undefined} disabled={saving || disabled}
            onValueChange={next => { void change({ strengthEquipment: next ? ['bodyweight'] : undefined }); }} />
        </Host>
        <Text style={copy}>{equipment
          ? 'Bodyweight is included. Select only equipment you can use.'
          : 'Equipment is not set. Standard templates may need weights or a resistance band.'}</Text>
        {equipment ? STRENGTH_EQUIPMENT_OPTIONS.map(option => <Host key={option.value} matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary} ignoreSafeArea="all" style={{ width: '100%', minHeight: 44 }}>
          <Switch label={option.label} value={equipment.includes(option.value)} disabled={saving || disabled}
            onValueChange={next => { void change({ strengthEquipment: toggleStrengthEquipment(value.strengthEquipment, option.value, next) }); }} />
        </Host>) : null}
        {error ? <Text accessibilityRole="alert" style={[copy, { color: C.critical }]}>{error}</Text> : null}
      </View></RNHostView> : null}
    </Collapsible>
  </Host>;
}
