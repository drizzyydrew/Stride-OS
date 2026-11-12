import { useState } from 'react';
import { Linking, useWindowDimensions } from 'react-native';
import { Button, Collapsible, Column, Host, Text } from '@expo/ui';
import { useColors } from '../../theme/useColors';
import { useThemeMode } from '../../store/themeStore';

export type CalibrationHelpKey = 'model' | 'vdot' | 'race_prediction' | 'tanaka_karvonen' | 'manual_karvonen' | 'threshold' | 'races' | 'heart_rate' | 'maf';
const HELP: Record<CalibrationHelpKey, { title: string; what: string; how: string; limit: string; source?: { title: string; url: string } }> = {
  model: {
    title: 'Your current model',
    what: 'Calibration estimates training paces and heart-rate zones from the information you save.',
    how: 'Add a recent race result, resting heart rate or completed threshold test, then recalculate. You can select a zone method below.',
    limit: 'Confidence reflects available inputs, not medical accuracy. A recent valid race result takes priority for VDOT, followed by threshold pace, your saved estimate and the profile baseline.',
  },
  vdot: {
    title: 'VDOT paces',
    what: 'VDOT is a performance-based fitness estimate used here to calculate training paces.',
    how: 'Save the measured distance, finish time and date of a recent completed race or time trial. Recalculate, then select VDOT Paces.',
    limit: 'This is not a laboratory measurement of oxygen uptake. Course, weather and how hard you ran affect the estimate.',
  },
  race_prediction: {
    title: 'Race predictions',
    what: 'These are estimated equivalent race times from your current VDOT, not another test.',
    how: 'Save a recent race or threshold result and recalculate before using predictions to guide a goal.',
    limit: 'Predictions assume suitable preparation for that distance. They do not account for every course, weather or endurance difference.',
  },
  tanaka_karvonen: {
    title: 'Age-based heart-rate zones',
    what: 'Tanaka estimates maximum heart rate from age; Karvonen calculates zones using the difference between resting and maximum heart rate.',
    how: 'Check your age in Profile, enter a resting heart rate below, save HR data, then select this method. No hard effort is required.',
    limit: 'Age-based maximum heart rate is a population estimate and can differ from your own. This method needs resting HR to build reserve-based zones.',
  },
  manual_karvonen: {
    title: 'Measured maximum heart rate',
    what: 'This method replaces the age estimate with an existing measured maximum heart rate and uses your resting heart rate for reserve-based zones.',
    how: 'Enter the maximum from an appropriate supervised assessment and your resting heart rate below, then select this method.',
    limit: 'A highest-seen watch value may be a sensor error or may fall short of your maximum. This screen does not provide an unsupervised maximum-effort test.',
  },
  threshold: {
    title: '30-minute threshold field test',
    what: 'This field test estimates lactate-threshold heart rate (LTHR); it is not a blood-lactate test.',
    how: 'Warm up separately. On a safe, uninterrupted route, run solo for 30 minutes at the hardest steady effort you can sustain for the whole test. Mark a lap at minute 10. Enter that final 20-minute average HR and, for this app, its average pace in minutes per mile.',
    limit: 'The first 10 test minutes are hard running, not the warm-up. Attempt only when ready for a hard effort; stop if unwell. Device data and conditions affect the estimate.',
    source: { title: 'Friel’s test protocol', url: 'https://joefrieltraining.com/determining-your-lthr/' },
  },
  races: {
    title: 'Race results and time trials',
    what: 'A completed performance at a known distance can anchor your VDOT estimate.',
    how: 'Choose the full distance and enter the finish time and actual event date. Use MM:SS or H:MM:SS for time. Recalculate after saving.',
    limit: 'Enter a complete performance rather than an interval or a predicted finish. GPS distance and moving time may differ from the event distance and elapsed time.',
  },
  heart_rate: {
    title: 'Resting and maximum heart rate',
    what: 'Resting HR and maximum HR are separate inputs. Together they support heart-rate-reserve zones.',
    how: 'Measure resting heart rate while awake and settled at rest. Enter bpm, save HR data, and select your intended method. Only enter measured HRmax when you already have a suitable measurement.',
    limit: 'A daily average is not resting HR. Medication, stress and sensor quality can affect readings. You can use the age estimate without attempting a maximum-effort test.',
  },
  maf: {
    title: 'Maximum Aerobic Function (MAF)',
    what: 'MAF compares pace at a steady, easy heart rate over repeated tests. StrideOS logs this for aerobic trends; it does not set your main training paces.',
    how: 'Warm up easily for about 15 minutes. Use the same level route and similar conditions. Keep a steady test heart rate and record test distance and minutes, excluding warm-up. Repeat under comparable conditions to compare pace.',
    limit: 'The app stores 180 minus age, with a 100 bpm floor. It does not apply Maffetone’s individual health/training adjustments. HR drift is a bpm change, not a percentage; use your observed change, not the preset example. This is not a diagnosis.',
    source: { title: 'Maffetone’s method', url: 'https://philmaffetone.com/maf-180-personalizing-exercise-heart-rate/' },
  },
};

export default function CalibrationHelp({ topic }: { topic: CalibrationHelpKey }) {
  const C = useColors();
  const mode = useThemeMode();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const help = HELP[topic];
  const textStyle = { color: C.textMuted, fontSize: 13 * fontScale, lineHeight: 19 * fontScale };
  return <Host matchContents={{ vertical: true }} colorScheme={mode} seedColor={C.primary}
    ignoreSafeArea="all" style={{ width: '100%', minHeight: 44, marginBottom: 8 }}>
    <Collapsible isOpen={open} onOpenChange={setOpen} label={`ⓘ ${help.title}`}
      labelStyle={{ color: C.primary, fontSize: 14 * fontScale, fontWeight: '600' }}>
      <Column spacing={10} style={{ paddingVertical: 12 }}>
        <Text textStyle={textStyle}>{help.what}</Text>
        <Text textStyle={textStyle}>{help.how}</Text>
        <Text textStyle={textStyle}>{help.limit}</Text>
        {help.source ? <Button variant="text" style={{ height: 44 * fontScale, width: '100%' }} onPress={() => { void Linking.openURL(help.source!.url); }}>
          <Text textStyle={{ color: C.primary, fontSize: 14 * fontScale, lineHeight: 20 * fontScale }}>{help.source.title}</Text>
        </Button> : null}
      </Column>
    </Collapsible>
  </Host>;
}
