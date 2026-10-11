import {readBindings} from '../_toolchain/bindings.mjs';
import {runTool, ensureTool, checkTool} from '../_toolchain/operations.mjs';
import {gitEnvironment} from '../git/index.mjs';

export const ensure = args => ensureTool('gh',args);
export const check = args => checkTool('gh',args);
export const run = args => runTool('gh',args,{
  env:readBindings().tools.git ? gitEnvironment() : process.env
});
