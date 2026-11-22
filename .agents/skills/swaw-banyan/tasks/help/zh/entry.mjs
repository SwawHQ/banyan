import {help} from '../run.mjs';

const args=process.argv.slice(2);
try { console.log(help(args,'zh')); }
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
