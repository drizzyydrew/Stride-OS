import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('streak').catch(error => { console.error(error); process.exitCode = 1; });
