import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('challenges').catch(error => { console.error(error); process.exitCode = 1; });
