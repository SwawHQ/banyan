import {toolExecutable} from '../../_shared/tools/operations.mjs';
import {execute} from '../../_shared/tools/process.mjs';
import {goEnvironment} from './environment.mjs';
import {gitEnvironment} from '../git/environment.mjs';
import {prepareTools} from '../../_shared/tools/selection.mjs';

try {
  await prepareTools(['git','go']);
  process.exitCode=await execute(toolExecutable('go'),process.argv.slice(2),{env:goEnvironment(gitEnvironment())});
}
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
