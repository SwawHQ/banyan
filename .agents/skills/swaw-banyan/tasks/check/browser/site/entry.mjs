import {run} from './run.mjs';
try {await run();}
catch(error){console.error(error.message);process.exitCode=1;}
