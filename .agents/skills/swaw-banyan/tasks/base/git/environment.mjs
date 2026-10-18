import path from 'node:path';
import {toolExecutable} from '../../_shared/tools/operations.mjs';
import {withPath} from '../../_shared/tools/process.mjs';
import {readBindings} from '../../_shared/tools/bindings.mjs';

export function gitEnvironment(env=process.env) {
  if (!readBindings().tools.git) return env;
  const clean=Object.fromEntries(Object.entries(env).filter(([key])=>!/^GIT_EXEC_PATH$/i.test(key)));
  return withPath([path.dirname(toolExecutable('git'))],clean);
}
