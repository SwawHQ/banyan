import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/img/icons [dir]  #Check image icon files and dimensions; default: public');
  else printCheck('check/img/icons',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
