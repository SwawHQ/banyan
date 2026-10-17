import path from 'node:path';
import {toolExecutable,toolBinding} from '../../_shared/toolchain/operations.mjs';
import {withPath} from '../../_shared/toolchain/process.mjs';

export function goEnvironment(env=process.env) {
  const executable=toolExecutable('go');
  const clean=Object.fromEntries(Object.entries(env).filter(([key])=>!/^(GOROOT|GOTOOLCHAIN)$/i.test(key)));
  return withPath([path.dirname(executable)],{...clean,GOROOT:toolBinding('go').root,GOTOOLCHAIN:'local'});
}
