import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight, Radius } from '../../theme/tokens';
import type { AthleteProfile } from '../../types/athlete';

type Props = {
  profile: AthleteProfile;
};

const SEX_LABEL: Record<string, string> = {
  male:               'Male',
  female:             'Female',
  non_binary:         'Non-binary',
  prefer_not_to_say:  '—',
};

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const colors = useThemeColors();
  const sc     = useMemo(() => createScStyles(colors), [colors]);
  return (
    <View style={sc.wrap}>
      <Text style={sc.value}>{value}</Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}

function createScStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  value: {
    color:      colors.text,
    fontSize:   FontSize.lg,
    fontWeight: FontWeight.black,
  },
  sub: {
    color:    colors.textDim,
    fontSize: 9,
    marginTop: -2,
  },
  label: {
    color:         colors.textMuted,
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  });
}

export default function ProfileOverviewCard({ profile }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const heightFt = profile.heightCm > 0
    ? `${Math.floor(profile.heightCm / 30.48)}'${Math.round((profile.heightCm % 30.48) / 2.54)}"`
    : '—';
  const weightLbs = profile.weightKg > 0
    ? `${Math.round(profile.weightKg * 2.205)} lb`
    : '—';

  return (
    <Card>
      {/* Name + training age */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>ATHLETE PROFILE</Text>
          <Text style={styles.name}>{profile.name || 'Athlete'}</Text>
        </View>
        <View style={styles.ageWrap}>
          <Text style={styles.ageBig}>{profile.age || '—'}</Text>
          <Text style={styles.ageLabel}>yrs</Text>
        </View>
      </View>

      {/* Core stats */}
      <View style={styles.statsRow}>
        <StatCell
          label="Sex"
          value={SEX_LABEL[profile.sex] ?? '—'}
        />
        <View style={styles.divider} />
        <StatCell
          label="Height"
          value={heightFt}
        />
        <View style={styles.divider} />
        <StatCell
          label="Weight"
          value={weightLbs}
        />
        <View style={styles.divider} />
        <StatCell
          label="Exp."
          value={profile.trainingAgeYears > 0 ? `${profile.trainingAgeYears}y` : '<1y'}
          sub={profile.trainingAgeYears >= 1 ? 'running' : ''}
        />
      </View>

      {/* Sensitivity tuning badges */}
      <View style={styles.sensitivityRow}>
        <SensitivityBadge
          label="Fatigue Sensitivity"
          value={profile.fatigueSensitivity}
        />
        <SensitivityBadge
          label="Recovery Speed"
          value={profile.recoveryResponsiveness}
        />
      </View>

      {/* Flags */}
      {profile.returningFromInjury && (
        <View style={styles.injuryFlag}>
          <Text style={styles.injuryFlagText}>
            ⚠ Returning from injury — load is managed conservatively
          </Text>
        </View>
      )}
    </Card>
  );
}

function SensitivityBadge({ label, value }: { label: string; value: number }) {
  const colors = useThemeColors();
  const sb     = useMemo(() => createSbStyles(colors), [colors]);
  const text  = value < 0.8 ? 'LOW' : value > 1.2 ? 'HIGH' : 'BASELINE';
  const color = value > 1.2 ? colors.warning : value < 0.8 ? colors.primary : colors.positive;
  const bg    = value > 1.2 ? colors.warningDim : value < 0.8 ? colors.primaryDim : colors.positiveDim;

  return (
    <View style={[sb.wrap, { backgroundColor: bg }]}>
      <Text style={[sb.text, { color }]}>{label}: {text}</Text>
    </View>
  );
}

function createSbStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
  },
  text: {
    fontSize:      9,
    fontWeight:    FontWeight.black,
    letterSpacing: 0.4,
  },
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.lg,
  },
  sectionLabel: {
    color:         colors.textMuted,
    fontSize:      11,
    fontWeight:    FontWeight.medium,
    letterSpacing: 0.6,
    marginBottom:  4,
  },
  name: {
    color:      colors.text,
    fontSize:   22,
    fontWeight: FontWeight.black,
  },
  ageWrap: {
    alignItems: 'flex-end',
    gap:        2,
  },
  ageBig: {
    color:      colors.text,
    fontSize:   32,
    fontWeight: FontWeight.black,
    lineHeight: 34,
  },
  ageLabel: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  statsRow: {
    flexDirection:  'row',
    alignItems:     'center',
    marginBottom:   spacing.md,
  },
  divider: {
    width:           1,
    height:          32,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
  },
  sensitivityRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    flexWrap:      'wrap',
  },
  injuryFlag: {
    marginTop:       spacing.sm,
    backgroundColor: colors.warningDim,
    borderRadius:    Radius.sm,
    padding:         spacing.sm,
  },
  injuryFlagText: {
    color:    colors.warning,
    fontSize: FontSize.sm,
  },
  });
}
