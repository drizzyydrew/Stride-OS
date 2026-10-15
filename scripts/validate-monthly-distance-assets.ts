import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('monthly-distance').catch(error => { console.error(error); process.exitCode = 1; });
