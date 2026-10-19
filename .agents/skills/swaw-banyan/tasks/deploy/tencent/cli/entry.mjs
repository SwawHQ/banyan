import {runCli} from './runtime.mjs';

try {process.exitCode = await runCli(process.argv.slice(2));}
catch (error) {console.error(`[swban] ${error.message}`);process.exitCode = 1;}
