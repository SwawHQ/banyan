import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/img/responsive [dir]  #Check responsive image delivery with resolved Hugo config; default: public');
  else printCheck('check/img/responsive',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
