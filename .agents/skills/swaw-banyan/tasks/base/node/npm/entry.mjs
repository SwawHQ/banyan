import {runPackageManager} from '../packages.mjs';

try { process.exitCode=await runPackageManager('npm',process.argv.slice(2)); }
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
