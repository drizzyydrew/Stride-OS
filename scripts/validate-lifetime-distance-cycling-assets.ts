import { validateApprovedBadges } from './lib/validateApprovedBadges';

validateApprovedBadges('lifetime-cycling').catch(error => { console.error(error); process.exitCode = 1; });
