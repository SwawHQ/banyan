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

export async function login(tool,{signal,environment = process.env} = {}) {
  if (!['cf','wrangler','tccli'].includes(tool)) throw new Error('invalid_login_tool');
  // Native login must not inherit an API credential that overrides OAuth.
  const env = Object.fromEntries(Object.entries(environment).filter(([key])=>
    !['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CLOUDFLARE_AUTH_USE_KEYRING'].includes(key.toUpperCase()) &&
    !(tool === 'tccli' && /^(TENCENTCLOUD_|TKE_|TCCLI_PROFILE$)/i.test(key))));
  if (tool !== 'tccli') env.CLOUDFLARE_AUTH_USE_KEYRING = 'true';
  const options = {environment:env,signal,stdio:['inherit',2,2]};
  const code = tool === 'tccli' ? await tencentCli(['auth','login','--profile','default'],options) :
    await cloudflareCli(tool,tool === 'cf' ? ['auth','login'] : ['login','--use-keyring'],options);
  if (code !== 0) throw new Error('login_failed');
}
