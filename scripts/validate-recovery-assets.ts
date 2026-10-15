import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('recovery').catch(error => { console.error(error); process.exitCode = 1; });
