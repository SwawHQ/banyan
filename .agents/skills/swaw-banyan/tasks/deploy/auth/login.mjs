import {runCli as cloudflareCli} from '../cloudflare/_shared/runtime.mjs';
import {runCli as tencentCli} from '../tencent/cli/runtime.mjs';
import {fileURLToPath} from 'node:url';
import {execute} from '../../_shared/tools/process.mjs';

const installers = {cf:'cloudflare/cli',wrangler:'cloudflare/wrangler',tccli:'tencent/cli'};

export async function prepare(tool,{signal} = {}) {
  if (!Object.hasOwn(installers,tool)) throw new Error('invalid_login_tool');
  // A separate process lets Close stop downloads and installer children together.
  const entry = fileURLToPath(new URL('../'+installers[tool]+'/ensure/entry.mjs',import.meta.url));
  if (await execute(process.execPath,[entry],{signal,stdio:['ignore',2,2]}) !== 0) throw new Error('tool_preparation_failed');
}

export function loginEnvironment(tool,environment = process.env) {
  if (!['cf','wrangler','tccli'].includes(tool)) throw new Error('invalid_login_tool');
  // Native login must not inherit an API credential that overrides OAuth.
  return Object.fromEntries(Object.entries(environment).filter(([key])=>
    !['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CF_API_TOKEN','CF_API_KEY','CF_EMAIL'].includes(key.toUpperCase()) &&
    !(tool === 'tccli' && /^(TENCENTCLOUD_|TKE_)/i.test(key))));
}

export function tencentProfile(environment) {
  return Object.entries(environment).find(([key])=>key.toUpperCase() === 'TCCLI_PROFILE')?.[1] || 'default';
}

export async function login(tool,{signal,environment = process.env} = {}) {
  const env = loginEnvironment(tool,environment);
  const options = {environment:env,signal,stdio:['inherit',2,2]};
  const code = await (tool === 'tccli' ? tencentCli(['auth','login','--profile',tencentProfile(env)],options) :
    cloudflareCli(tool,tool === 'cf' ? ['auth','login'] : ['login'],options));
  if (code !== 0) throw new Error('login_failed');
}
