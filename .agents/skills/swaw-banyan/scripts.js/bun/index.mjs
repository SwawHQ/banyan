import { runTool, ensureTool, checkTool } from '../_toolchain/operations.mjs';

export const run = args => runTool('bun', args);
export const check = args => checkTool('bun', args);
export const ensure = args => ensureTool('bun', args);
