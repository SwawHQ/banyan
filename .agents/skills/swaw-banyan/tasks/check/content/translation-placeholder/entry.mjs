import {parseDirectory,printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const site = parseDirectory(process.argv.slice(2),{defaultDirectory:'.',kind:'site'});
  if (site === null) console.log('swban check/content/translation-placeholder [site]  #Check declared content fields; default: current site');
  else printCheck('check/content/translation-placeholder',await inspect(site));
} catch (error) { console.error(error.message); process.exitCode = 1; }
