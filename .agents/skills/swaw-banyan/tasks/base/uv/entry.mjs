import {prepareTools} from '../../_shared/tools/selection.mjs';
import {toolExecutable} from '../../_shared/tools/operations.mjs';
import {execute} from '../../_shared/tools/process.mjs';
import {uvEnvironment} from './environment.mjs';
import {preparePython} from './python/runtime.mjs';

try {
  const args = process.argv.slice(2);
  if (args[0]?.startsWith('-') && !(args.length === 1 && ['--help','-h','--version','-V'].includes(args[0])))
    throw new Error('uv_command_required_before_options; use swban base/uv <command> [options]');
  await prepareTools(['uv']);
  const env = uvEnvironment();
  if (['pip','run'].includes(args[0])) env.UV_PYTHON = (await preparePython()).path;
  const forwarded = args[0] === 'run' ? ['run', '--no-project', ...args.slice(1)] : args;
  process.exitCode = await execute(toolExecutable('uv'), forwarded, {env});
} catch (error) { console.error(`[swban] ${error.message}`); process.exitCode = 1; }
