import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('strength').catch(error => { console.error(error); process.exitCode = 1; });
