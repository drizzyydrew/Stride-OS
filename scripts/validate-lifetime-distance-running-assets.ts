import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('lifetime-running').catch(error => { console.error(error); process.exitCode = 1; });
