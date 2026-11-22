import {parseDirectory,printCheck} from '../../_shared/cli.mjs';
import {inspect} from './inspect.mjs';
try {
  const directory = parseDirectory(process.argv.slice(2));
  printCheck('check/llms',await inspect(directory));
} catch (error) { console.error(error.message); process.exitCode = 1; }
