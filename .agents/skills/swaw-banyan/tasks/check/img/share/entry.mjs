import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/img/share [dir]  #Check generated share images; default: public');
  else printCheck('check/img/share',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
