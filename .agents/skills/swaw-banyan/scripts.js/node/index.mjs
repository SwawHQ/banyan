import path from 'node:path';
import { fail } from '../_toolchain/filesystem.mjs';
import { runTool, ensureTool, checkTool, toolBinding } from '../_toolchain/operations.mjs';

export const run = args => runTool('node', args);
export const ensure = args => ensureTool('node', args);
export const check = args => checkTool('node', args);
function runPackageManager(name, args) {
  const directory = toolBinding('node').npmDirectory;
  if (!directory) fail('node_package_managers_missing; run swban node.ensure --force');
  const cli = path.join(directory, `${name}-cli.js`);
  return runTool('node', [cli, ...args]);
}
export const npm = args => runPackageManager('npm', args);
export const npx = args => runPackageManager('npx', args);
