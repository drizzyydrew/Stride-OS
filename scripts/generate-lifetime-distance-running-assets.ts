import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('lifetime-running').catch(error => { console.error(error); process.exitCode = 1; });
