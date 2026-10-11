import {parseDirectory,printCheck} from '../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/build-version [dir]  #Check page and service-worker build versions; default: public');
  else printCheck('check/build-version',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
