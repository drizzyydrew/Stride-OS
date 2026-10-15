import { generateApprovedBadges } from './lib/generateApprovedBadges';

generateApprovedBadges('run-level').catch(error => { console.error(error); process.exitCode = 1; });
