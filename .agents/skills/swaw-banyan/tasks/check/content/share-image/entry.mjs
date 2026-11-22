import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const site = parseDirectory(process.argv.slice(2),{defaultDirectory:'.',kind:'site'});
  printCheck('check/content/share-image',await inspect(site));
} catch (error) { console.error(error.message); process.exitCode = 1; }
