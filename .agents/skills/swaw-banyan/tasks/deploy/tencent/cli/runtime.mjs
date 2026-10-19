import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {toolsRoot} from '../../../_shared/tools/manifest.mjs';
import {inside,stat,installLock} from '../../../_shared/tools/filesystem.mjs';
import {prepareTools} from '../../../_shared/tools/selection.mjs';
import {toolExecutable} from '../../../_shared/tools/operations.mjs';
import {execute} from '../../../_shared/tools/process.mjs';
import {uvEnvironment,pythonVersion} from '../../../base/uv/environment.mjs';
import {tencentEnvironment} from '../auth/credentials.mjs';

const requirement = fs.readFileSync(new URL('./requirements.txt',import.meta.url),'utf8').trim();
const version = /^tccli==(\d+(?:\.\d+)+)$/.exec(requirement)?.[1];
if (!version) throw new Error('tccli_version_must_be_pinned');
const repair = 'tccli_installation_unusable; run swban deploy/tencent/cli/ensure --force';

export function inspectCli({root = toolsRoot} = {}) {
  const home = inside(root,'python-tools/tccli');
  const executable = inside(home,'Scripts/tccli.exe');
  for (const file of [executable,inside(home,'Scripts/python.exe'),inside(home,'Lib/site-packages/tccli/main.py')])
    if (!stat(file)?.isFile()) throw new Error(repair);
  const read = name=>{
    const file = inside(home,name),info = stat(file);
    if (!info?.isFile() || info.size > 65536) throw new Error(repair);
    return fs.readFileSync(file,'utf8');
  };
  const metadata = read('Lib/site-packages/tccli-'+version+'.dist-info/METADATA');
  const config = read('pyvenv.cfg');
  const base = /^home\s*=\s*(.+?)\s*$/m.exec(config)?.[1];
  const python = /^version_info\s*=\s*(\d+\.\d+\.\d+)\s*$/m.exec(config)?.[1];
  if (!/^Name: tccli\r?$/m.test(metadata) || !metadata.split(/\r?\n/).includes('Version: '+version) ||
      !python?.startsWith(pythonVersion+'.') || !/^include-system-site-packages\s*=\s*false\s*$/mi.test(config) ||
      !base || !path.isAbsolute(base)) throw new Error(repair);
  // uv can record a managed Python version alias in pyvenv.cfg.
  let resolved;
  try {resolved = fs.realpathSync.native(base);} catch {throw new Error(repair);}
  const managed = inside(root,'python'),relative = path.relative(managed,resolved);
  if (!relative || relative === '..' || relative.startsWith('..'+path.sep) || path.isAbsolute(relative) ||
      !stat(inside(managed,relative,'python.exe'))?.isFile()) throw new Error(repair);
  return {tool:'tccli',version,path:executable};
}

function installed() {
  try {return inspectCli();}
  catch (error) {if(error.message !== repair)throw error;return null;}
}

export async function prepareCli({force = false} = {}) {
  if (!force) {const ready = installed();if(ready)return {...ready,action:'reused'};}
  await prepareTools(['uv']);
  const unlock = installLock(toolsRoot);
  try {
    if (!force) {const ready = installed();if(ready)return {...ready,action:'reused'};}
    // Reinstall also repairs damaged environments whose uv receipt still exists.
    console.error('[swban] Preparing tccli '+version);
    const code = await execute(toolExecutable('uv'),['tool','install','--quiet','--python',pythonVersion,'--reinstall','--force',requirement],
      {env:uvEnvironment(),stdio:['inherit',2,2]});
    if (code !== 0) throw new Error('tccli_installation_failed:'+code);
    return {...inspectCli(),action:'installed'};
  } finally {unlock();}
}

export async function runCli(args,{environment = process.env,signal,stdio = 'inherit'} = {}) {
  signal?.throwIfAborted();
  const cli = await prepareCli();
  signal?.throwIfAborted();
  const env = uvEnvironment(await tencentEnvironment(args,environment));
  env.VIRTUAL_ENV = path.dirname(path.dirname(cli.path));
  return execute(path.join(path.dirname(cli.path),'python.exe'),
    ['-I','-B','-X','utf8',fileURLToPath(new URL('./cli.py',import.meta.url)),...args],{env,signal,stdio});
}
