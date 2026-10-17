import {toolExecutable} from '../../_shared/toolchain/operations.mjs';
import {execute} from '../../_shared/toolchain/process.mjs';
import {goEnvironment} from './environment.mjs';
import {gitEnvironment} from '../git/environment.mjs';
import {prepareTools} from '../../_shared/toolchain/selection.mjs';

try {
  await prepareTools(['git','go']);
  process.exitCode=await execute(toolExecutable('go'),process.argv.slice(2),{env:goEnvironment(gitEnvironment())});
}
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
