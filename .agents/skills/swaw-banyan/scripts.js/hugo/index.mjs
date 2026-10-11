import path from 'node:path';
import { toolExecutable, ensureTool, checkTool } from '../_toolchain/operations.mjs';
import { execute, withPath } from '../_toolchain/process.mjs';
import { goEnvironment } from '../go/index.mjs';
import {gitEnvironment} from '../git/index.mjs';

export const ensure = args => ensureTool('hugo', args);
export const check = args => checkTool('hugo', args);
export function hugoEnvironment(environment = process.env) {
  const executable = toolExecutable('hugo');
  return withPath([path.dirname(executable)], goEnvironment(gitEnvironment(environment)));
}
export function run(args, {env = process.env, cwd = process.cwd()} = {}) {
  return execute(toolExecutable('hugo'), args, {env:hugoEnvironment(env), cwd});
}
