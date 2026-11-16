import path from 'node:path';
import {toolExecutable} from '../../_shared/tools/operations.mjs';
import {withPath} from '../../_shared/tools/process.mjs';
import {readBindings} from '../../_shared/tools/bindings.mjs';

export function gitEnvironment(env=process.env) {
  const binding=readBindings().tools.git;
  if (!binding) return env;
  const clean=Object.fromEntries(Object.entries(env).filter(([key])=>!/^GIT_EXEC_PATH$/i.test(key)));
  if(binding.source==='managed'&&process.platform!=='win32') {
    const root=path.dirname(path.dirname(toolExecutable('git')));
    clean.GIT_EXEC_PATH=path.join(root,'libexec/git-core');
    clean.GIT_TEMPLATE_DIR=path.join(root,'share/git-core/templates');
  }
  return withPath([path.dirname(toolExecutable('git'))],clean);
}
