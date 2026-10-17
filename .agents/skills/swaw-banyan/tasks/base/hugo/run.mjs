import path from 'node:path';
import { toolExecutable } from '../../_shared/toolchain/operations.mjs';
import { execute, withPath } from '../../_shared/toolchain/process.mjs';
import { goEnvironment } from '../go/environment.mjs';
import {gitEnvironment} from '../git/environment.mjs';
import {prepareTools} from '../../_shared/toolchain/selection.mjs';

export const prepareHugo = () => prepareTools(['git','go','hugo']);

export function hugoEnvironment(environment = process.env) {
  const executable = toolExecutable('hugo');
  return withPath([path.dirname(executable)], goEnvironment(gitEnvironment(environment)));
}
export async function run(args, {env = process.env, cwd = process.cwd()} = {}) {
  await prepareHugo();
  return execute(toolExecutable('hugo'), args, {env:hugoEnvironment(env), cwd});
}
