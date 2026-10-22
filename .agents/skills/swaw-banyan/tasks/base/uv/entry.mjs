import {prepareTools} from '../../_shared/tools/selection.mjs';
import {toolExecutable} from '../../_shared/tools/operations.mjs';
import {execute} from '../../_shared/tools/process.mjs';
import {uvEnvironment} from './environment.mjs';
import {preparePython} from './python/runtime.mjs';
import {pythonCommandIndex} from './arguments.mjs';

try {
  const args = process.argv.slice(2);
  await prepareTools(['uv']);
  const executable = toolExecutable('uv'), env = uvEnvironment();
  const command = await pythonCommandIndex(executable,args,env);
  if (command >= 0) env.UV_PYTHON = (await preparePython()).path;
  const forwarded = args.slice();
  if (args[command] === 'run') forwarded.splice(command+1,0,'--no-project');
  process.exitCode = await execute(executable,forwarded,{env});
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
