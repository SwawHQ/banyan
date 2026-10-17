import {runTool} from '../../_shared/toolchain/operations.mjs';
import {gitEnvironment} from '../git/environment.mjs';

try { process.exitCode=await runTool('gh',process.argv.slice(2),{env:gitEnvironment()}); }
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
