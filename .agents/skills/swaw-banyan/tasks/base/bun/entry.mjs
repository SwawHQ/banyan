import {runTool} from '../../_shared/tools/operations.mjs';

try { process.exitCode=await runTool('bun',process.argv.slice(2)); }
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
