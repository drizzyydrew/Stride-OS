import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('weekly-distance').catch(error => { console.error(error); process.exitCode = 1; });
