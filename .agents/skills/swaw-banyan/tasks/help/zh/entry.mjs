import {help} from '../run.mjs';

const args=process.argv.slice(2);
if (args.length===1&&['--help','-h'].includes(args[0])) args[0]='help/zh';
try { console.log(help(args,'zh')); }
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
