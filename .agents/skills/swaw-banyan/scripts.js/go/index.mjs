import path from 'node:path';
import { toolExecutable, toolBinding, ensureTool, checkTool } from '../_toolchain/operations.mjs';
import { execute, withPath } from '../_toolchain/process.mjs';
import {gitEnvironment} from '../git/index.mjs';

export const ensure = args => ensureTool('go', args);
export const check = args => checkTool('go', args);
export function goEnvironment(env = process.env) {
  const executable = toolExecutable('go');
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => !/^(GOROOT|GOTOOLCHAIN)$/i.test(key)));
  return withPath([path.dirname(executable)], {...clean, GOROOT:toolBinding('go').root, GOTOOLCHAIN:'local'});
}
export const run = args => execute(toolExecutable('go'), args, {env:goEnvironment(gitEnvironment())});
