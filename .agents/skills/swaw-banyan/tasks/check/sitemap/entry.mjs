import {parseDirectory,printCheck} from '../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/sitemap [dir]  #Check sitemap and page indexing agreement; default: public');
  else printCheck('check/sitemap',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
