import {helpFor} from '../../../_shared/arguments.mjs';
import {preparePython} from '../runtime.mjs';

const args = process.argv.slice(2);
try {
  if (args.length === 1 && ['--help','-h'].includes(args[0])) console.log(helpFor({command:'base/python/ensure'}));
  else {
    if (args.length) throw new Error('invalid_ensure_arguments');
    console.log(JSON.stringify(await preparePython()));
  }
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
