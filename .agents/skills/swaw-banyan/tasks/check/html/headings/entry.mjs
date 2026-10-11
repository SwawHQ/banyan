import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/html/headings [dir]  #Check heading counts on indexable pages; default: public');
  else printCheck('check/html/headings',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
