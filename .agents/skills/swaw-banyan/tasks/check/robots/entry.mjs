import {helpFor} from '../../_shared/arguments.mjs';
import {parseDirectory,printCheck} from '../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log(helpFor({command:'check/robots'}));
  else printCheck('check/robots',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
