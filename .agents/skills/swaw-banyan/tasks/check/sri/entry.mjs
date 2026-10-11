import {parseDirectory,printCheck} from '../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';

try {
  const directory = parseDirectory(process.argv.slice(2));
  if (directory === null) console.log('swban check/sri [dir]  #Check script integrity against published bytes; default: public');
  else printCheck('check/sri',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
