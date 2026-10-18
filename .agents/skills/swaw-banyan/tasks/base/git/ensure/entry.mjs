import {helpFor} from '../../../_shared/arguments.mjs';
import {ensureTool} from '../../../_shared/tools/operations.mjs';

const args=process.argv.slice(2);
const spec={command:'base/git/ensure'};
try {
  if (args.length===1&&['--help','-h'].includes(args[0])) console.log(helpFor(spec));
  else await ensureTool('git',args);
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
