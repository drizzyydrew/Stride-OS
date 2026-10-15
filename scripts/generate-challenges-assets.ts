import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('challenges').catch(error => { console.error(error); process.exitCode = 1; });
