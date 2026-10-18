import {preparePython} from './runtime.mjs';
import {uvEnvironment} from '../environment.mjs';
import {execute} from '../../../_shared/tools/process.mjs';

try {
  const python = await preparePython();
  process.exitCode = await execute(python.path, process.argv.slice(2), {env:uvEnvironment()});
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
