import path from 'node:path';
import {toolExecutable, ensureTool, checkTool} from '../_toolchain/operations.mjs';
import {execute, withPath} from '../_toolchain/process.mjs';

export const ensure = args => ensureTool('git',args);
export const check = args => checkTool('git',args);
export function gitEnvironment(env = process.env) {
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => !/^GIT_EXEC_PATH$/i.test(key)));
  return withPath([path.dirname(toolExecutable('git'))],clean);
}
export const run = args => execute(toolExecutable('git'),args,{env:gitEnvironment()});
