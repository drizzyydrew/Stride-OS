import { StyleSheet, Text, View } from 'react-native';

import type { AchievementDefinition } from '../../utils/achievements';
import AchievementBadge from './AchievementBadge';

export type AchievementShareVariant = 'badge_square' | 'story_poster' | 'photo_overlay';

type Props = {
  achievement: AchievementDefinition;
  variant: AchievementShareVariant;
  detail?: string;
};

const VARIANT_COPY: Record<AchievementShareVariant, string> = {
  badge_square: 'Badge',
  story_poster: 'Poster',
  photo_overlay: 'Overlay',
};

export const ACHIEVEMENT_SHARE_VARIANTS: Array<{ id: AchievementShareVariant; label: string; description: string }> = [
  { id: 'badge_square', label: 'Badge', description: 'Square achievement art' },
  { id: 'story_poster', label: 'Poster', description: 'Tall story-ready card' },
  { id: 'photo_overlay', label: 'Overlay', description: 'Transparent-friendly stat layer' },
];

export default function AchievementShareCard({ achievement, variant, detail }: Props) {
  if (variant === 'story_poster') {
    return (
      <View style={[styles.card, styles.poster]} collapsable={false}>
        <View style={styles.posterTop}>
          <Text style={styles.brandLight}>STRIDEOS</Text>
          <Text style={styles.posterKicker}>ACHIEVEMENT</Text>
        </View>
        <View style={styles.badgeHero}>
          <AchievementBadge id={achievement.id} category={achievement.category} size="large" />
        </View>
        <View>
          <Text style={styles.posterTitle}>{achievement.title}</Text>
          <Text style={styles.posterCopy}>{detail ?? achievement.description}</Text>
        </View>
        <Text style={styles.posterChevrons}>{'>>>>>  RUN THE PATH  >>>>>'}</Text>
      </View>
    );
  }

  if (variant === 'photo_overlay') {
    return (
      <View style={[styles.card, styles.overlay]} collapsable={false}>
        <View style={styles.overlayPill}>
          <Text style={styles.overlayBrand}>STRIDEOS</Text>
          <Text style={styles.overlayLabel}>{VARIANT_COPY[variant].toUpperCase()}</Text>
        </View>
        <View style={styles.overlayRow}>
          <AchievementBadge id={achievement.id} category={achievement.category} size="medium" />
          <View style={styles.overlayCopyWrap}>
            <Text style={styles.overlayTitle}>{achievement.title}</Text>
            <Text style={styles.overlayCopy}>{detail ?? achievement.description}</Text>
          </View>
        </View>
        <Text style={styles.overlayChevrons}>{'>>>>>'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.square]} collapsable={false}>
      <Text style={styles.brandDark}>STRIDEOS</Text>
      <View style={styles.squareBadge}>
        <AchievementBadge id={achievement.id} category={achievement.category} size="large" />
      </View>
      <View>
        <Text style={styles.squareKicker}>NEW ACHIEVEMENT</Text>
        <Text style={styles.squareTitle}>{achievement.title}</Text>
        <Text style={styles.squareCopy}>{detail ?? achievement.description}</Text>
      </View>
      <View style={styles.chevronRail}>
        <View style={styles.chevronMark} />
        <View style={styles.chevronMark} />
        <View style={styles.chevronMark} />
        <View style={styles.chevronMark} />
        <View style={styles.chevronMark} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 430,
    overflow: 'hidden',
  },
  square: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#F3F1EB',
    justifyContent: 'space-between',
  },
  poster: {
    borderRadius: 30,
    padding: 26,
    minHeight: 620,
    backgroundColor: '#0E0E0F',
    justifyContent: 'space-between',
  },
  overlay: {
    minHeight: 360,
    padding: 18,
    backgroundColor: 'rgba(14, 14, 15, 0.02)',
    justifyContent: 'flex-end',
  },
  posterTop: {
    gap: 8,
  },
  brandDark: {
    color: '#2D4256',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandLight: {
    color: '#F3F1EB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  posterKicker: {
    color: '#DCC9B1',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  badgeHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
  },
  squareBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareKicker: {
    color: '#6F816E',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  squareTitle: {
    color: '#0E0E0F',
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '900',
  },
  squareCopy: {
    color: '#3E423C',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: 10,
  },
  posterTitle: {
    color: '#F3F1EB',
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '900',
  },
  posterCopy: {
    color: '#DCC9B1',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    marginTop: 12,
  },
  posterChevrons: {
    color: '#A8B9A1',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  overlayPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: 'rgba(14, 14, 15, 0.72)',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  overlayBrand: {
    color: '#F3F1EB',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  overlayLabel: {
    color: '#DCC9B1',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  overlayRow: {
    borderRadius: 24,
    padding: 14,
    backgroundColor: 'rgba(14, 14, 15, 0.76)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  overlayCopyWrap: {
    flex: 1,
    minWidth: 0,
  },
  overlayTitle: {
    color: '#F3F1EB',
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '900',
  },
  overlayCopy: {
    color: '#DCC9B1',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  overlayChevrons: {
    color: 'rgba(243, 241, 235, 0.85)',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  chevronRail: {
    flexDirection: 'row',
    gap: 7,
    alignSelf: 'flex-start',
  },
  chevronMark: {
    width: 22,
    height: 10,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: '#E08A5C',
    transform: [{ rotate: '45deg' }],
  },
});
