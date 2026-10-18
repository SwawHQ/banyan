import {toolExecutable} from '../../_shared/tools/operations.mjs';
import {execute} from '../../_shared/tools/process.mjs';
import {gitEnvironment} from './environment.mjs';
import {prepareTools} from '../../_shared/tools/selection.mjs';

try {
  await prepareTools(['git']);
  process.exitCode=await execute(toolExecutable('git'),process.argv.slice(2),{env:gitEnvironment()});
}
catch (error) { console.error(`[swban] ${error.message}`); process.exitCode=1; }
