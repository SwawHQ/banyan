import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {dependencyState,ensureDependencies} from '../../../_shared/dependencies.mjs';
import {inside} from '../../../_shared/tools/filesystem.mjs';
import {prepareTools} from '../../../_shared/tools/selection.mjs';
import {toolExecutable} from '../../../_shared/tools/operations.mjs';
import {execute,withPath} from '../../../_shared/tools/process.mjs';
import {cloudflareEnvironment} from './credentials.mjs';

const directories = {cf:'cli',wrangler:'wrangler'};
function cliRoot(name) {
  if (!Object.hasOwn(directories,name)) throw new Error('unknown_cloudflare_cli:'+name);
  return fileURLToPath(new URL('../'+directories[name]+'/',import.meta.url));
}

export function inspectCli(name) {
  const root = cliRoot(name), repair = 'run swban deploy/cloudflare/'+directories[name]+'/ensure --force';
  const status = dependencyState(root);
  if (status.state !== 'ready') throw new Error(name+'_packages_'+status.state+'; '+repair);
  const entry = inside(root,'node_modules',name,name === 'cf' ? 'bin/cf' : 'bin/wrangler.js');
  if (!fs.statSync(entry,{throwIfNoEntry:false})?.isFile()) throw new Error(name+'_entry_missing; '+repair);
  const version = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).dependencies[name];
  return {tool:name,version,path:entry};
}

export async function prepareCli(name,{force = false} = {}) {
  await ensureDependencies(cliRoot(name),{force});
  return inspectCli(name);
}

export async function runCli(name,args,{environment = process.env,signal,stdio = 'inherit'} = {}) {
  signal?.throwIfAborted();
  const cli = await prepareCli(name);
  await prepareTools(['node']);
  signal?.throwIfAborted();
  const node = toolExecutable('node');
  const env = await cloudflareEnvironment(name,args,withPath([path.dirname(node)],environment));
  // Keep cf on the Skill's pinned version when the caller has another cf package.
  if (name === 'cf') {
    env.CF_DELEGATION = '1';
    // Require encrypted OAuth storage; an unavailable keyring must not write plaintext.
    for (const key of Object.keys(env)) if (key.toUpperCase() === 'CLOUDFLARE_AUTH_USE_KEYRING') delete env[key];
    env.CLOUDFLARE_AUTH_USE_KEYRING = 'true';
  }
  // Both tools find their Windows keyring binding with `npm root -g`.
  if (process.platform === 'win32') {
    for (const key of Object.keys(env)) if (key.toLowerCase() === 'npm_config_prefix') delete env[key];
    env.npm_config_prefix = cliRoot(name);
  }
  return execute(node,[cli.path,...args],{env,signal,stdio});
}
