import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('recovery').catch(error => { console.error(error); process.exitCode = 1; });
