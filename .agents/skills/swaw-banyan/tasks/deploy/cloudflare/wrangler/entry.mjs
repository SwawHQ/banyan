import {runCli} from '../_shared/runtime.mjs';

try { process.exitCode = await runCli('wrangler',process.argv.slice(2)); }
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
