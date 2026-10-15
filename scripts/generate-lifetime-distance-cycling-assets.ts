import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('lifetime-cycling').catch(error => { console.error(error); process.exitCode = 1; });
