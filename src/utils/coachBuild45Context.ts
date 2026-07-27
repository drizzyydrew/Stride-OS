import type { Activity } from '../types/activity';
import type { AwardedAchievement } from '../store/achievementStore';
import type { EquipmentItem, Shoe } from '../store/gearStore';
import type { CoachPromptSection } from './coachPromptBudget';
import { HEALTHY_ACHIEVEMENTS } from './achievements';
import { mostUsedShoe, shoeWearReminderCopy } from './gear';
import type { RecalculationDecisionSnapshot } from './training/recalculationDecisionSnapshot';
import type { TrainingOutlook } from './trainingOutlook';

export type Build45CoachContextInput = {
  trainingOutlook?: TrainingOutlook;
  decisionSnapshot?: RecalculationDecisionSnapshot;
  shoes?: readonly Shoe[];
  equipment?: readonly EquipmentItem[];
  awardedAchievements?: readonly AwardedAchievement[];
  activities?: readonly Activity[];
};

function compactLine(value: string | undefined, fallback = 'not available'): string {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

function formatEquipment(item: EquipmentItem): string {
  const linked = item.blePeripheralId ? 'Bluetooth linked' : 'manual fallback';
  return `${item.name} (${item.kind.replace(/_/g, ' ')}, ${linked})`;
}

function buildTrainingOutlookSection(outlook: TrainingOutlook): CoachPromptSection {
  const focus = outlook.focus ? ` Focus: ${outlook.focus}.` : '';
  return {
    key: 'Build 45 training outlook',
    priority: 8,
    content: [
      `Status: ${outlook.statusLabel}; load state: ${outlook.loadStateLabel}; confidence: ${outlook.confidence}.`,
      `${compactLine(outlook.message)} ${compactLine(outlook.recommendation)}${focus}`,
      `History: ${outlook.historyWeeks} week(s), ${outlook.completedActivities} completed activities.`,
    ].join('\n'),
    compact: `${outlook.statusLabel}; ${outlook.loadStateLabel}; ${compactLine(outlook.recommendation)}${focus}`,
  };
}

function buildWeeklyDecisionSection(snapshot: RecalculationDecisionSnapshot): CoachPromptSection {
  const flags = snapshot.flags.length ? snapshot.flags.slice(0, 4).join(', ') : 'none';
  return {
    key: 'Build 45 weekly decision',
    priority: 9,
    content: `Decision: ${snapshot.decision}. Phase: ${snapshot.phase}. Focus: ${snapshot.focus}. Rationale: ${compactLine(snapshot.rationale)} Flags: ${flags}. Confidence: ${snapshot.confidence}.`,
    compact: `${snapshot.decision}; ${snapshot.focus}; ${compactLine(snapshot.rationale).slice(0, 220)}.`,
  };
}

function buildGearSection(input: Required<Pick<Build45CoachContextInput, 'activities' | 'shoes' | 'equipment'>>): CoachPromptSection | null {
  const activeEquipment = input.equipment.filter(item => item.active).slice(0, 5);
  const usedShoe = mostUsedShoe(input.activities, input.shoes);
  const wearReminder = usedShoe ? shoeWearReminderCopy(usedShoe.shoe, usedShoe.miles) : null;
  if (!usedShoe && activeEquipment.length === 0) return null;

  const shoeLine = usedShoe
    ? `Most-used shoe: ${usedShoe.shoe.brand} ${usedShoe.shoe.model}, about ${Math.round(usedShoe.miles)} mi logged.${wearReminder ? ` ${wearReminder}` : ''}`
    : 'No shoe mileage summary available yet.';
  const equipmentLine = activeEquipment.length
    ? `Equipment: ${activeEquipment.map(formatEquipment).join('; ')}.`
    : 'No active equipment registered.';

  return {
    key: 'Build 45 gear context',
    priority: 10,
    content: `${shoeLine}\n${equipmentLine}\nDo not make safety claims about a shoe or device from mileage alone. Bluetooth gaps should be described honestly and manual fallback remains valid.`,
    compact: `${shoeLine} ${activeEquipment.length} active equipment item(s); manual fallback remains valid.`,
  };
}

function buildAchievementSection(awarded: readonly AwardedAchievement[]): CoachPromptSection | null {
  if (!awarded.length) return null;
  const definitions = new Map(HEALTHY_ACHIEVEMENTS.map(item => [item.id, item]));
  const recent = [...awarded]
    .sort((a, b) => b.awardedAt - a.awardedAt)
    .slice(0, 4)
    .map(item => definitions.get(item.id)?.title ?? item.id);

  return {
    key: 'Build 45 recent achievements',
    priority: 11,
    content: `Recent healthy achievements: ${recent.join(', ')}. Use these only as supportive context; do not shame rest days, missed sessions, or slower training.`,
    compact: `Recent achievements: ${recent.join(', ')}.`,
  };
}

export function buildBuild45CoachContextSections(input: Build45CoachContextInput): CoachPromptSection[] {
  const sections: Array<CoachPromptSection | null> = [
    input.trainingOutlook ? buildTrainingOutlookSection(input.trainingOutlook) : null,
    input.decisionSnapshot ? buildWeeklyDecisionSection(input.decisionSnapshot) : null,
    buildGearSection({
      activities: input.activities ?? [],
      shoes: input.shoes ?? [],
      equipment: input.equipment ?? [],
    }),
    buildAchievementSection(input.awardedAchievements ?? []),
  ];

  return sections.filter((section): section is CoachPromptSection => Boolean(section));
}
