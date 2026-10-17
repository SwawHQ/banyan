import path from 'node:path';
import {fail} from '../../_shared/toolchain/filesystem.mjs';
import {runTool,toolBinding} from '../../_shared/toolchain/operations.mjs';
import {prepareTools} from '../../_shared/toolchain/selection.mjs';

export async function runPackageManager(name,args) {
  await prepareTools(['node']);
  const directory=toolBinding('node').npmDirectory;
  if (!directory) fail('node_package_managers_missing; run swban base/node/ensure --force');
  return runTool('node',[path.join(directory,`${name}-cli.js`),...args]);
}
