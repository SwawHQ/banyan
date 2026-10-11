import path from 'node:path';
import { fail } from './filesystem.mjs';
import { resolveBinding } from './bindings.mjs';
import { prepareTool, inspectBinding } from './selection.mjs';
import { execute, withPath } from './process.mjs';

export const toolBinding = name => resolveBinding(name);
export const toolExecutable = name => toolBinding(name).path;
export function runTool(name, args, {env = process.env} = {}) {
  const executable = toolExecutable(name);
  return execute(executable, args, {env:withPath([path.dirname(executable)], env)});
}
export async function ensureTool(name, args) {
  console.log(JSON.stringify(await prepareTool(name,args)));
}
export async function checkTool(name, args) {
  if (args.length) fail('check_is_read_only; no additional arguments accepted');
  console.log(JSON.stringify(await inspectBinding(name)));
}
