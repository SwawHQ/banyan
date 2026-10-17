import {helpFor} from '../../../_shared/arguments.mjs';
import {parseURL} from '../_shared/request.mjs';
import {printCheck} from '../../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const url = parseURL(process.argv.slice(2));
  if (url === null) console.log(helpFor({command:'check/http/security'}));
  else printCheck('check/http/security',await inspect(url));
} catch (error) { console.error(error.message); process.exitCode = 1; }
