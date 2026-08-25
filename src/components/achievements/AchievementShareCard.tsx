import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { getElevationAchievementArtwork } from '../../constants/elevationAchievementAssets';
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

function MountainAchievementShareCard({ achievement, variant, detail }: Props) {
  const artwork = getElevationAchievementArtwork(achievement.id);
  const title = achievement.title.toUpperCase();
  const copy = (detail ?? achievement.description).toUpperCase();

  if (variant === 'photo_overlay') {
    return (
      <View style={[styles.card, styles.mountainOverlay]} collapsable={false}>
        <View style={styles.mountainOverlayPanel}>
          <View style={styles.mountainBrandRow}>
            <Text style={styles.mountainBrand}>STRIDEOS</Text>
            <Text style={styles.mountainChevrons}>{'>>>>>'}</Text>
          </View>
          <Text style={styles.mountainOverlayTitle}>{title}</Text>
          <Text style={styles.mountainOverlayValue}>{copy}</Text>
        </View>
      </View>
    );
  }

  if (variant === 'story_poster') {
    return (
      <View style={[styles.card, styles.mountainMinimal]} collapsable={false}>
        <View style={styles.mountainBrandRow}>
          <Text style={styles.brandLight}>STRIDEOS</Text>
          <Text style={styles.mountainChevrons}>{'>>>>>'}</Text>
        </View>
        <View style={styles.mountainLineMark}>
          <View style={styles.mountainLinePeak} />
          <View style={styles.mountainLinePeakSmall} />
        </View>
        <View>
          <Text style={styles.mountainMinimalTitle}>{title}</Text>
          <Text style={styles.mountainMinimalValue}>{copy}</Text>
        </View>
        <Text style={styles.posterChevrons}>CUMULATIVE ELEVATION</Text>
      </View>
    );
  }

  if (!artwork) return null;
  return (
    <ImageBackground source={artwork} style={[styles.card, styles.mountainPhoto]} imageStyle={styles.mountainPhotoImage} collapsable={false}>
      <View style={styles.mountainPhotoShade} />
      <View style={styles.mountainPhotoTop}>
        <Text style={styles.brandLight}>STRIDEOS</Text>
        <Text style={styles.mountainChevrons}>{'>>>>>'}</Text>
      </View>
      <View>
        <Text style={styles.mountainPhotoTitle}>{title}</Text>
        <Text style={styles.mountainPhotoValue}>{copy}</Text>
      </View>
    </ImageBackground>
  );
}

function StreakAchievementShareCard({ achievement, variant, detail }: Props) {
  const title = achievement.title.toUpperCase();
  const milestone = (detail ?? achievement.title).toUpperCase();

  if (variant === 'photo_overlay') {
    return (
      <View style={[styles.card, styles.streakOverlay]} collapsable={false}>
        <View style={styles.streakOverlayPanel}>
          <View style={styles.streakBrandRow}>
            <Text style={styles.streakBrand}>STRIDEOS</Text>
            <Text style={styles.streakChevrons}>{'>>>>>'}</Text>
          </View>
          <View style={styles.streakOverlayBody}>
            <AchievementBadge id={achievement.id} category="streak" size="medium" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.streakOverlayTitle}>{title}</Text>
              <Text style={styles.streakOverlayCopy}>CONSISTENCY BUILT OVER TIME</Text>
              <Text style={styles.streakOverlayValue}>{milestone}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const poster = variant === 'story_poster';
  return (
    <View style={[styles.card, poster ? styles.streakPoster : styles.streakSquare]} collapsable={false}>
      <View style={styles.streakBrandRow}>
        <Text style={styles.brandLight}>STRIDEOS</Text>
        <Text style={styles.streakChevrons}>{'>>>>>'}</Text>
      </View>
      <View style={styles.streakShareBadge}>
        <AchievementBadge id={achievement.id} category="streak" size="large" />
      </View>
      <View>
        <Text style={poster ? styles.streakPosterTitle : styles.streakSquareTitle}>{title}</Text>
        <Text style={styles.streakShareCopy}>CONSISTENCY BUILT OVER TIME</Text>
        <Text style={styles.streakShareValue}>{milestone}</Text>
      </View>
      <Text style={styles.posterChevrons}>ADHERENCE OVER EXCESS</Text>
    </View>
  );
}

export default function AchievementShareCard({ achievement, variant, detail }: Props) {
  if (achievement.category === 'cumulative_elevation') {
    return <MountainAchievementShareCard achievement={achievement} variant={variant} detail={detail} />;
  }
  if (achievement.category === 'streak') {
    return <StreakAchievementShareCard achievement={achievement} variant={variant} detail={detail} />;
  }

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
  mountainPhoto: {
    borderRadius: 28,
    minHeight: 540,
    padding: 24,
    justifyContent: 'space-between',
  },
  mountainPhotoImage: {
    borderRadius: 28,
  },
  mountainPhotoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  mountainPhotoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mountainPhotoTitle: {
    color: '#F3F1EB',
    fontSize: 50,
    lineHeight: 53,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  mountainPhotoValue: {
    color: '#DCC9B1',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 10,
  },
  mountainMinimal: {
    borderRadius: 30,
    padding: 28,
    minHeight: 620,
    backgroundColor: '#0E0E0F',
    justifyContent: 'space-between',
  },
  mountainLineMark: {
    width: '100%',
    height: 150,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220, 201, 177, 0.42)',
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
  },
  mountainLinePeak: {
    width: 150,
    height: 150,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#DCC9B1',
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    left: 72,
    bottom: -74,
  },
  mountainLinePeakSmall: {
    width: 92,
    height: 92,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#A8B9A1',
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    right: 70,
    bottom: -45,
  },
  mountainMinimalTitle: {
    color: '#F3F1EB',
    fontSize: 54,
    lineHeight: 58,
    fontFamily: 'CormorantGaramond_700Bold',
  },
  mountainMinimalValue: {
    color: '#DCC9B1',
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 12,
  },
  mountainOverlay: {
    minHeight: 360,
    padding: 18,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'flex-end',
  },
  mountainOverlayPanel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(14, 14, 15, 0.78)',
  },
  mountainBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mountainBrand: {
    color: '#F3F1EB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  mountainChevrons: {
    color: '#DCC9B1',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  mountainOverlayTitle: {
    color: '#F3F1EB',
    fontSize: 34,
    lineHeight: 37,
    fontFamily: 'CormorantGaramond_700Bold',
    marginTop: 18,
  },
  mountainOverlayValue: {
    color: '#DCC9B1',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 7,
  },
  streakSquare: {
    borderRadius: 28,
    padding: 24,
    minHeight: 520,
    backgroundColor: '#0B0B0B',
    justifyContent: 'space-between',
  },
  streakPoster: {
    borderRadius: 30,
    padding: 28,
    minHeight: 620,
    backgroundColor: '#0B0B0B',
    justifyContent: 'space-between',
  },
  streakBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  streakBrand: {
    color: '#F3F1EB',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  streakChevrons: {
    color: '#DCC9B1',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  streakShareBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
  },
  streakSquareTitle: {
    color: '#F3F1EB',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '900',
  },
  streakPosterTitle: {
    color: '#F3F1EB',
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
  },
  streakShareCopy: {
    color: '#DCC9B1',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 12,
  },
  streakShareValue: {
    color: '#FFFDF3',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 6,
  },
  streakOverlay: {
    minHeight: 360,
    padding: 18,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    justifyContent: 'flex-end',
  },
  streakOverlayPanel: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(7, 7, 7, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(220, 201, 177, 0.48)',
  },
  streakOverlayBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
  },
  streakOverlayTitle: {
    color: '#F3F1EB',
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '900',
  },
  streakOverlayCopy: {
    color: '#DCC9B1',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginTop: 4,
  },
  streakOverlayValue: {
    color: '#FFFDF3',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
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
