import {run} from './run.mjs';

try { process.exitCode=await run(process.argv.slice(2)); }
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
