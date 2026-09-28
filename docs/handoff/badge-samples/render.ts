import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderFirstAchievementBadgeSvg as proposed } from './proposedArtwork';
const R = process.env.R!;
const S = process.env.S!;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const current = require(path.join(R, 'src/achievements/firsts/firstsArtwork')).renderFirstAchievementBadgeSvg;
const { FIRST_ACHIEVEMENT_DEFINITIONS } = require(path.join(R, 'src/achievements/firsts/firstsDefinitions'));
const ids: string[] = FIRST_ACHIEVEMENT_DEFINITIONS.map((d: { id: string }) => d.id);
console.log(ids.join(','));
for (const id of ids) {
  writeFileSync(`${S}/proposed-${id}.svg`, proposed(id as never, 'unlocked', { size: 1024 }));
  writeFileSync(`${S}/current-${id}.svg`, current(id, 'unlocked', { size: 1024 }));
}
