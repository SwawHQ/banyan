import path from 'node:path';
import {definition, toolsRoot, skillRoot} from './_toolchain/manifest.mjs';
import {prepareRuntime, prepareTool} from './_toolchain/selection.mjs';
import {execute} from './_toolchain/process.mjs';

try {
  const [archivePath, command, ...args] = process.argv.slice(2);
  if (!archivePath || !path.isAbsolute(archivePath) || path.resolve(process.execPath) === path.join(toolsRoot, 'bun', definition('bun').executable)) throw new Error('temporary_bun_required');
  if (command === 'ensure') console.log(JSON.stringify(await prepareRuntime(args,{archivePath})));
  else if (command === 'bun.ensure' || command === 'node.ensure') {
    const result = await prepareTool(command.split('.')[0],args,{archivePath});
    await prepareRuntime([],{archivePath});
    console.log(JSON.stringify(result));
  } else {
    const runtime = await prepareRuntime([],{archivePath});
    process.exitCode = await execute(runtime.path,[path.join(skillRoot,'scripts.js/swban.mjs'),command,...args]);
  }
} catch (error) {
  console.error(`[swban] ${error.message}`); process.exitCode = 1;
}
