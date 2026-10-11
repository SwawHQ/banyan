import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/html/scripts [dir]  #Check script references and loading boundaries; default: public');
  else printCheck('check/html/scripts',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
