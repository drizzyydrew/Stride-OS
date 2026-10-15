import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('run-level').catch(error => { console.error(error); process.exitCode = 1; });
