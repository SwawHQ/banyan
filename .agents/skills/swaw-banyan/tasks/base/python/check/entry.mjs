import {helpFor} from '../../../_shared/arguments.mjs';
import {inspectPython} from '../runtime.mjs';

const args = process.argv.slice(2);
try {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) console.log(helpFor({command:'base/python/check'}));
  else {
    if (args.length) throw new Error('check_is_read_only; no additional arguments accepted');
    console.log(JSON.stringify({...await inspectPython(), action:'checked'}));
  }
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
