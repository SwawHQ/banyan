import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/html/metadata [dir]  #Check page metadata, canonical URLs and article date rows; default: public');
  else printCheck('check/html/metadata',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
