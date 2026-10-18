import path from 'node:path';
import {definition, toolsRoot, skillRoot} from '../_shared/tools/manifest.mjs';
import {prepareRuntime} from '../_shared/tools/selection.mjs';
import {execute} from '../_shared/tools/process.mjs';

try {
  const [archivePath, command, ...args] = process.argv.slice(2);
  if (!archivePath || !path.isAbsolute(archivePath) || path.resolve(process.execPath) === path.join(toolsRoot, 'node', definition('node').executable)) throw new Error('temporary_node_required');
  if (command === 'base/node/ensure') {
    const result = await prepareRuntime(args,{archivePath});
    const {runtime, ...tool} = result;
    console.log(JSON.stringify({tool:runtime,...tool}));
  } else {
    const runtime = await prepareRuntime([],{archivePath});
    process.exitCode = await execute(runtime.path,[path.join(skillRoot,'tasks/_cli/main.mjs'),command,...args]);
  }
} catch (error) {
  console.error(`[swban] ${error.message}`); process.exitCode = 1;
}
