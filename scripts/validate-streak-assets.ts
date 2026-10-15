import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('streak').catch(error => { console.error(error); process.exitCode = 1; });
