import {parseDirectory,printCheck} from '../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/llms [dir]  #Check llms.txt documents and local links; default: public');
  else printCheck('check/llms',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
