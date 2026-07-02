import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { useThemeColors, type ThemeColors } from '../../theme/ThemeContext';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';

type CitationEntry = {
  key:      string;
  method:   string;
  full:     string;
  formula?: string;
  note:     string;
};

const CITATIONS: CitationEntry[] = [
  {
    key:     'tanaka',
    method:  'Tanaka HRmax Formula',
    full:    'Tanaka, H., Monahan, K.D., & Seals, D.R. (2001). Age-predicted maximal heart rate revisited. Journal of the American College of Cardiology, 37(1), 153–156.',
    formula: 'HRmax = 208 − (0.7 × age)',
    note:    'Meta-analysis of 351 studies (n=18,712). More accurate than 220−age for trained athletes. Default when no measured HRmax is available.',
  },
  {
    key:     'karvonen',
    method:  'Karvonen Heart-Rate Reserve (HRR)',
    full:    'Karvonen, M.J., Kentala, E., & Mustala, O. (1957). The effects of training on heart rate: A longitudinal study. Annales Medicinae Experimentalis et Biologiae Fenniae, 35(3), 307–315.',
    formula: 'Target HR = ((HRmax − HRresting) × intensity%) + HRresting',
    note:    'Individualises HR zones using resting HR. More accurate than HRmax% alone, especially for well-trained or low-resting-HR athletes.',
  },
  {
    key:     'friel_lthr',
    method:  'Joe Friel 30-Minute Threshold Field Test',
    full:    'Friel, J. (2012). The Triathlete\'s Training Bible (4th ed.). VeloPress. / Friel, J. (2015). Fast After 50. VeloPress.',
    formula: '30-min TT: avg HR (last 20 min) = LTHR · avg pace (last 20 min) = FT pace',
    note:    'Used to establish LTHR and threshold pace without a lab. First 10 min are settling/warm-up; only last 20 min used. Basis for 7-zone threshold system.',
  },
  {
    key:     'friel_zones',
    method:  'Friel 7-Zone Threshold System',
    full:    'Friel, J. (2015). Fast After 50. VeloPress. Chapter 5: Training Intensity.',
    formula: 'Zone 1: <78% FT speed / <85% LTHR · Zone 4: 95–101% / 95–99% LTHR · Zone 5c: >111% / >106% LTHR',
    note:    'Extended Friel zones adapted for runners. Pace zones use % of threshold speed (higher % = faster). HR zones use % of LTHR (Lactate Threshold HR).',
  },
  {
    key:     'vdot',
    method:  'Jack Daniels VDOT Model',
    full:    'Daniels, J. (2005). Daniels\' Running Formula (2nd ed.). Human Kinetics.',
    formula: 'VO2(v) = −4.60 + 0.182258v + 0.000104v² · %VO2max(t) = 0.8 + 0.1894393e^(−0.012778t) + 0.2989558e^(−0.1932605t)',
    note:    'VDOT = effective VO2max from race performance. Used to derive training pace zones and predict race times across distances. Primary calibration source when race PR is available.',
  },
  {
    key:     'maffetone',
    method:  'MAF / Maximum Aerobic Function (Maffetone)',
    full:    'Maffetone, P. (2010). The Big Book of Endurance Training and Racing. Skyhorse Publishing.',
    formula: 'MAF HR = 180 − age (±adjustments for health/fitness status)',
    note:    'Used in StrideOS ONLY for aerobic efficiency trending and base development tracking. Not used as primary training prescription. Higher drift = poorer aerobic base.',
  },
];

type CitationRowProps = {
  entry: CitationEntry;
};

function CitationRow({ entry }: CitationRowProps) {
  const colors = useThemeColors();
  const row    = useMemo(() => createRowStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={row.wrap}>
      <Pressable style={row.header} onPress={() => setExpanded(e => !e)}>
        <View style={row.dot} />
        <Text style={row.method}>{entry.method}</Text>
        <Text style={row.chevron}>{expanded ? '↑' : '↓'}</Text>
      </Pressable>
      {expanded && (
        <View style={row.body}>
          {entry.formula && (
            <View style={row.formula}>
              <Text style={row.formulaText}>{entry.formula}</Text>
            </View>
          )}
          <Text style={row.note}>{entry.note}</Text>
          <Text style={row.citation}>{entry.full}</Text>
        </View>
      )}
    </View>
  );
}

function createRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
  wrap:        { borderBottomWidth: 1, borderBottomColor: colors.border },
  header:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, flexShrink: 0 },
  method:      { color: colors.text, fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  chevron:     { color: colors.textDim, fontSize: FontSize.xs },
  body:        { paddingBottom: spacing.md, gap: spacing.sm },
  formula:     { backgroundColor: colors.bg, borderRadius: 8, padding: spacing.sm },
  formulaText: { color: colors.primary, fontSize: 9, fontFamily: 'monospace', lineHeight: 15 },
  note:        { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 16 },
  citation:    { color: colors.textSubtle, fontSize: 8, lineHeight: 13, fontStyle: 'italic' },
  });
}

export default function SourcesMethodsCard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Pressable style={styles.toggleRow} onPress={() => setOpen(o => !o)}>
        <Text style={styles.title}>Sources & Methods</Text>
        <Text style={styles.chevron}>{open ? '↑ Collapse' : '↓ Expand'}</Text>
      </Pressable>

      {open && (
        <View style={styles.content}>
          <Text style={styles.preamble}>
            All calculations in StrideOS are deterministic and based on peer-reviewed
            exercise science literature. No AI, cloud services, or estimates beyond
            the formulas listed here are used.
          </Text>

          {CITATIONS.map(c => (
            <CitationRow key={c.key} entry={c} />
          ))}

          <Text style={styles.footer}>
            Imperial units used throughout: pace in min/mile, distance in miles.
            Intervals may reference meters where appropriate to the exercise science literature.
          </Text>
        </View>
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:     { color: colors.text, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  chevron:   { color: colors.primary, fontSize: FontSize.xs },
  content:   { marginTop: spacing.md, gap: spacing.xs },
  preamble:  { color: colors.textMuted, fontSize: FontSize.xs, lineHeight: 16, marginBottom: spacing.sm },
  footer:    { color: colors.textSubtle, fontSize: 8, lineHeight: 13, marginTop: spacing.md, fontStyle: 'italic' },
  });
}
