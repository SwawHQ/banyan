import path from 'node:path';
import {definition, toolsRoot, skillRoot} from '../_shared/toolchain/manifest.mjs';
import {prepareRuntime, prepareTool} from '../_shared/toolchain/selection.mjs';
import {execute} from '../_shared/toolchain/process.mjs';

try {
  const [archivePath, command, ...args] = process.argv.slice(2);
  if (!archivePath || !path.isAbsolute(archivePath) || path.resolve(process.execPath) === path.join(toolsRoot, 'bun', definition('bun').executable)) throw new Error('temporary_bun_required');
  if (command === 'base/bun/ensure' || command === 'base/node/ensure') {
    const result = await prepareTool(command.split('/')[1],args,{archivePath});
    await prepareRuntime([],{archivePath});
    console.log(JSON.stringify(result));
  } else {
    const runtime = await prepareRuntime([],{archivePath});
    process.exitCode = await execute(runtime.path,[path.join(skillRoot,'tasks/_cli/main.mjs'),command,...args]);
  }
} catch (error) {
  console.error(`[swban] ${error.message}`); process.exitCode = 1;
}
