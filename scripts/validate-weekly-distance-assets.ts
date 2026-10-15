import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('weekly-distance').catch(error => { console.error(error); process.exitCode = 1; });
