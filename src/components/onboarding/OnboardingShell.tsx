import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { colors }  from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { FontSize, FontWeight } from '../../theme/tokens';
import { ONBOARDING_TOTAL_STEPS } from '../../store/onboardingStore';

type Props = {
  step:        number;      // 0 = welcome (no progress bar shown), 1–9 = data steps
  title:       string;
  subtitle?:   string;
  children:    ReactNode;
  onNext:      () => void;
  onBack?:     () => void;  // undefined = hide back button (welcome screen)
  nextLabel?:  string;
  nextEnabled?: boolean;
  showSkip?:   boolean;
  onSkip?:     () => void;
};

export default function OnboardingShell({
  step,
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel = 'Continue',
  nextEnabled = true,
  showSkip = false,
  onSkip,
}: Props) {
  const DATA_STEPS = ONBOARDING_TOTAL_STEPS - 1;   // 9 data steps
  const showProgress = step > 0;
  const progress = step / DATA_STEPS;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.backBtn} hitSlop={12}>
              <Text style={styles.backText}>←</Text>
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}

          <Text style={styles.appName}>STRIDEOS</Text>

          {showSkip && onSkip ? (
            <Pressable onPress={onSkip} style={styles.skipBtn} hitSlop={12}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
        </View>

        {/* ── Progress bar ─────────────────────────────────────────── */}
        {showProgress && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.stepLabel}>{step} / {DATA_STEPS}</Text>
          </View>
        )}

        {/* ── Scrollable content ───────────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>

        {/* ── Next button ──────────────────────────────────────────── */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.nextBtn, !nextEnabled && styles.nextBtnDisabled]}
            onPress={nextEnabled ? onNext : undefined}
          >
            <Text style={[styles.nextText, !nextEnabled && styles.nextTextDisabled]}>
              {nextLabel}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  kav: {
    flex: 1,
  },
  topBar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
  },
  backBtn: {
    width:  40,
    height: 40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  backText: {
    color:      colors.text,
    fontSize:   22,
    fontWeight: FontWeight.bold,
  },
  backPlaceholder: {
    width: 40,
  },
  appName: {
    color:         colors.primary,
    fontSize:      11,
    fontWeight:    FontWeight.black,
    letterSpacing: 2,
  },
  skipBtn: {
    width:          40,
    alignItems:     'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    color:    colors.textDim,
    fontSize: FontSize.sm,
  },
  progressWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: spacing.xl,
    gap:            spacing.sm,
    marginBottom:   spacing.sm,
  },
  progressTrack: {
    flex:            1,
    height:          3,
    backgroundColor: colors.border,
    borderRadius:    2,
    overflow:        'hidden',
  },
  progressFill: {
    height:          3,
    backgroundColor: colors.primary,
    borderRadius:    2,
  },
  stepLabel: {
    color:    colors.textSubtle,
    fontSize: 10,
    width:    36,
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.xl,
  },
  title: {
    color:        colors.text,
    fontSize:     28,
    fontWeight:   FontWeight.black,
    lineHeight:   34,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color:        colors.textMuted,
    fontSize:     FontSize.base,
    lineHeight:   22,
    marginBottom: spacing.xl,
  },
  body: {
    gap: spacing.xl,
  },
  footer: {
    padding:         spacing.xl,
    paddingBottom:   spacing.lg,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
  },
  nextBtn: {
    backgroundColor: colors.primary,
    borderRadius:    12,
    paddingVertical: spacing.lg,
    alignItems:      'center',
  },
  nextBtnDisabled: {
    backgroundColor: colors.border,
  },
  nextText: {
    color:      colors.text,
    fontSize:   FontSize.base,
    fontWeight: FontWeight.bold,
  },
  nextTextDisabled: {
    color: colors.textSubtle,
  },
});
