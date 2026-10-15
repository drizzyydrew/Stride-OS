import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('monthly-distance').catch(error => { console.error(error); process.exitCode = 1; });
