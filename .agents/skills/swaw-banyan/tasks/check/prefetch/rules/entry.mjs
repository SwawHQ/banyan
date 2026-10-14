import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/prefetch/rules [dir]  #Check inline speculation rules and readiness gates; default: public');
  else printCheck('check/prefetch/rules',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
