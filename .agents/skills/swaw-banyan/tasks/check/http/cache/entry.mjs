import {parseURL} from '../../../_shared/http.mjs';
import {printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const url = parseURL(process.argv.slice(2));
  if (url === null) console.log('swban check/http/cache <url>  #Check actual HTTP response');
  else printCheck('check/http/cache',await inspect(url));
} catch (error) { console.error(error.message); process.exitCode = 1; }
