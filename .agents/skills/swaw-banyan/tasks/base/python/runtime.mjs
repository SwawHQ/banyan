import fs from 'node:fs';
import path from 'node:path';
import {toolsRoot} from '../../_shared/tools/manifest.mjs';
import {plainPath, stat, fail, installLock} from '../../_shared/tools/filesystem.mjs';
import {probe, execute} from '../../_shared/tools/process.mjs';
import {prepareTools} from '../../_shared/tools/selection.mjs';
import {toolExecutable} from '../../_shared/tools/operations.mjs';
import {pythonHome, pythonExecutable, pythonVersion, uvEnvironment} from '../uv/environment.mjs';

export async function inspectPython({root = toolsRoot, env = process.env} = {}) {
  const executable = plainPath(pythonExecutable(root));
  const repair = 'python_environment_unusable; run swban base/python/ensure';
  if (!stat(executable)?.isFile()) fail(repair);
  const result = await probe(executable, ['-I', '-c',
    'import json,sys; print(json.dumps([sys.version.split()[0],sys.prefix,sys.base_prefix]))'], {env:uvEnvironment(env, root)});
  if (!result.ok) fail(repair);
  let info;
  try { info = JSON.parse(result.text); } catch { fail(repair); }
  if (!Array.isArray(info) || info.length !== 3 || info.some(value => typeof value !== 'string') ||
      !info[0].startsWith(pythonVersion + '.') || !path.isAbsolute(info[1]) || !path.isAbsolute(info[2])) fail(repair);
  const base = path.relative(fs.realpathSync.native(path.join(root, 'python')), fs.realpathSync.native(plainPath(info[2])));
  if (fs.realpathSync.native(info[1]) !== fs.realpathSync.native(pythonHome(root)) || !base || base === '..' ||
      base.startsWith('..' + path.sep) || path.isAbsolute(base)) fail(repair);
  return {tool:'python', version:info[0], path:executable};
}

export async function preparePython() {
  const home = plainPath(pythonHome());
  if (stat(home)) return {...await inspectPython(), action:'reused'};
  await prepareTools(['uv']);
  const unlock = installLock(toolsRoot);
  try {
    let action = 'reused';
    if (!stat(home)) {
      const code = await execute(toolExecutable('uv'), ['venv', '--python', pythonVersion, '--no-project', home],
        {env:uvEnvironment()});
      if (code) fail('python_environment_setup_failed:' + code);
      action = 'installed';
    }
    return {...await inspectPython(), action};
  } finally { unlock(); }
}
