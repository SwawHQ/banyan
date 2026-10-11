import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/prefetch/payload [dir]  #Check page prefetch data and runtime pairing; default: public');
  else printCheck('check/prefetch/payload',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
