import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectCli} from '../cloudflare/_shared/runtime.mjs';
import {inspectCli as inspectTencentCli} from '../tencent/cli/runtime.mjs';
import {uvEnvironment} from '../../base/uv/environment.mjs';
import {toolExecutable} from '../../_shared/tools/operations.mjs';
import {probe,withPath} from '../../_shared/tools/process.mjs';
import {loginEnvironment,tencentProfile} from './login.mjs';
import {workingDirectory} from '../_shared/working-directory.mjs';

export async function check(tool,{signal,environment = process.env} = {}) {
  const env = loginEnvironment(tool,environment);
  try {
    signal?.throwIfAborted();
    if (tool === 'tccli') {
      const cli = inspectTencentCli(),python = path.join(path.dirname(cli.path),'python.exe');
      const nativeEnv = uvEnvironment(env);
      nativeEnv.VIRTUAL_ENV = path.dirname(path.dirname(cli.path));
      const args = ['-I','-B','-X','utf8',fileURLToPath(new URL('../tencent/cli/cli.py',import.meta.url)),
        'sts','GetCallerIdentity','--profile',tencentProfile(env),'--region','ap-guangzhou','--endpoint','sts.tencentcloudapi.com',
        '--output','json','--filter','@','--timeout','12'];
      // Verify native credentials through the public API; do not inspect their stored format.
      const result = await probe(python,args,{env:nativeEnv,cwd:workingDirectory(tool),signal,timeout:30000});
      const data = JSON.parse(result.text);
      return result.ok && typeof data.AccountId === 'string' && data.AccountId &&
        typeof data.UserId === 'string' && data.UserId && !data.Error ? 'authorized' : 'unavailable';
    }
    const cli = inspectCli(tool),node = toolExecutable('node');
    env.CI = 'true';
    env.CF_DELEGATION = '1';
    if (process.platform === 'win32') {
      for (const key of Object.keys(env)) if (key.toLowerCase() === 'npm_config_prefix') delete env[key];
      env.npm_config_prefix = path.resolve(path.dirname(cli.path),'../../..');
    }
    const args = tool === 'cf' ? ['auth','whoami','--profile','default'] : ['whoami','--json'];
    // Bypass Banyan's API Token injection; never return the CLI's identity data.
    const result = await probe(node,[cli.path,...args],
      {env:withPath([path.dirname(node)],env),cwd:workingDirectory(tool),signal,timeout:30000});
    const data = JSON.parse(result.text);
    if (tool === 'cf') {
      if (data.authenticated === false) return 'notAuthorized';
      if (result.ok && data.authenticated === true && data.tokenValid === true &&
          typeof data.authSource === 'string' && data.authSource.startsWith('OAuth token from ')) return 'authorized';
    } else {
      if (data.loggedIn === false) return 'notAuthorized';
      if (result.ok && data.loggedIn === true && data.authType === 'OAuth Token') return 'authorized';
    }
  } catch {}
  return 'unavailable';
}
