import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('strength').catch(error => { console.error(error); process.exitCode = 1; });
