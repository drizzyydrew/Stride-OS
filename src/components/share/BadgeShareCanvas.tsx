import { useState, type RefObject } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import AchievementBadge from '../achievements/AchievementBadge';
import ShareBrandMark from './ShareBrandMark';
import type { ShareStudioFormat, ShareStudioVariant } from './ShareStudio';
import type { UnitSystem } from '../../store/settingsStore';
import type { EvaluatedAchievement } from '../../utils/achievementSystem';

type Props = {
  achievement: Pick<EvaluatedAchievement, 'id' | 'title' | 'state'> & Partial<Pick<EvaluatedAchievement, 'category'>>;
  units: UnitSystem;
  variant: ShareStudioVariant;
  format: ShareStudioFormat;
  canvasRef?: RefObject<View | null>;
};

export default function BadgeShareCanvas({ achievement, units, variant, format, canvasRef }: Props) {
  const [width, setWidth] = useState(360);
  const story = format === 'story';
  const height = story ? 640 : 360;
  const badgeSize = story ? 288 : 240;
  const transparent = variant === 'transparent_overlay';
  const editorial = variant === 'editorial_card';
  const state = achievement.state === 'locked' ? 'locked' : transparent ? 'transparent' : 'unlocked';

  function measure(event: LayoutChangeEvent) {
    const measured = event.nativeEvent.layout.width;
    if (measured > 0) setWidth(current => current === measured ? current : measured);
  }

  return (
    <View
      ref={canvasRef}
      collapsable={false}
      testID="badge-share-canvas"
      accessible
      accessibilityLabel={`${achievement.title}. StrideOS badge share image.`}
      onLayout={measure}
      style={[styles.canvas, { aspectRatio: story ? 9 / 16 : 1,
        backgroundColor: transparent ? 'transparent' : editorial ? '#F3F1EB' : '#0E0E0F' }]}
    >
      {/* Scale one fixed composition, never individual text or draggable layers. */}
      <View pointerEvents="none" style={[styles.composition, {
        height, marginTop: -height / 2, transform: [{ scale: width / 360 }],
      }]}>
        <View style={styles.brand}>
          <ShareBrandMark darkInk={editorial} showChevrons={false} />
        </View>
        <View style={[styles.badge, { width: badgeSize, height: badgeSize,
          marginLeft: -badgeSize / 2, marginTop: -badgeSize / 2 }]}>
          <View style={{ transform: [{ scale: badgeSize / 156 }] }}>
            <AchievementBadge id={achievement.id} category={achievement.category}
              earned={achievement.state !== 'locked'} size="large" unitSystem={units} badgeState={state} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: '100%', overflow: 'hidden' },
  composition: { position: 'absolute', width: 360, left: '50%', top: '50%', marginLeft: -180 },
  brand: { position: 'absolute', left: 24, top: 24 },
  badge: { position: 'absolute', left: '50%', top: '50%', alignItems: 'center', justifyContent: 'center' },
});
