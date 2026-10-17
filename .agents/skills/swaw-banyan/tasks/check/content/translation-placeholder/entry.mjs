import {helpFor} from '../../../_shared/arguments.mjs';
import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const site = parseDirectory(process.argv.slice(2),{defaultDirectory:'.',kind:'site'});
  if (site === null) console.log(helpFor({command:'check/content/translation-placeholder'}));
  else printCheck('check/content/translation-placeholder',await inspect(site));
} catch (error) { console.error(error.message); process.exitCode = 1; }
