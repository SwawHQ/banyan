import {credentialStore as systemStore} from '../../_shared/credential-store.mjs';
import {parseArgs} from 'node:util';

export const credentialTarget = 'swban/cloudflare/default';
export const credentialStore = (action,record,{target = credentialTarget} = {})=>systemStore(target,action,record);

export async function inspectCredential(store = credentialStore) {
  const record = await store('check');
  return {target:credentialTarget,present:!!record,
    ...(record && /^[a-f0-9]{32}$/i.test(record.userName) ? {accountId:record.userName} : {})};
}

function nativeArguments(tool,args) {
  const strings = {config:'c',c:null,cwd:null,env:'e',e:null,'env-file':null,envFile:null,zone:'z',z:null,mode:'m',m:null,'persist-to':null,persistTo:null,profile:null};
  const booleans = new Set(['quiet','q','local','help','h','version','v','install-skills','experimental-provision','x-provision','experimental-auto-create','x-auto-create']);
  // Node treats short inline booleans as clusters; yargs treats the last flag as valued.
  let options = true;
  const normalized = args.flatMap(arg=>{
    if (arg === '--') options = false;
    const match = options && /^-([a-zA-Z]+)=(true|false)$/.exec(arg);
    return match ? [...(match[1].length > 1 ? ['-'+match[1].slice(0,-1)] : []),'--'+match[1].at(-1)+'='+match[2]] : [arg];
  });
  const {tokens} = parseArgs({args:normalized,strict:false,allowPositionals:true,tokens:true,
    options:Object.fromEntries(Object.entries(strings).map(([name,short])=>[name,{type:'string',...(short ? {short} : {})}]))});
  const commands = [];
  let help = false,version = false,profile = false;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind === 'positional') {commands.push(token.value);continue;}
    if (token.kind !== 'option') continue;
    if (token.name === 'profile') profile = true;
    const name = token.name.replace(/[A-Z]/g,letter=>'-'+letter.toLowerCase()),negative = name.startsWith('no-');
    const flag = negative ? name.slice(3) : name;
    if (!booleans.has(flag)) continue;
    let value = negative ? false : token.value ?? true;
    const next = tokens[index+1];
    if (!negative && token.value === undefined && next?.kind === 'positional' && next.index === token.index+1 && ['true','false'].includes(next.value)) value = tokens[++index].value;
    if (['help','h'].includes(flag)) help = value !== false && value !== 'false';
    if (['version','v'].includes(flag)) version = value !== false && value !== 'false';
  }
  const end = args.indexOf('--');
  // cf handles exact version flags before yargs; Wrangler handles them only without a command.
  version = tool === 'cf' ? version || args.slice(0,end < 0 ? args.length : end).some(arg=>['--version','-v'].includes(arg)) : version && !commands.length;
  return {commands,help,version,profile};
}

export async function cloudflareEnvironment(tool,args,environment,store = credentialStore) {
  const env = {...environment};
  // Windows environment names ignore case; a copied JS object does not.
  if (process.platform === 'win32') for (const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CLOUDFLARE_ACCOUNT_ID']) {
    const actual = Object.keys(env).find(name=>name.toUpperCase() === key);
    if (actual && actual !== key) { env[key] = env[actual]; delete env[actual]; }
  }
  const {commands,help,version,profile} = nativeArguments(tool,args);
  // Explicit credentials/profiles and native sign-in flows keep their own selection.
  if (env.CLOUDFLARE_API_TOKEN || (env.CLOUDFLARE_API_KEY && env.CLOUDFLARE_EMAIL) ||
      ['login','logout'].includes(commands[0]) || (commands[0] === 'auth' && commands[1] !== 'whoami') ||
      help || version || profile) return env;
  const record = await store('read');
  if (!record) return env;
  if (typeof record.secret !== 'string' || !record.secret || record.secret.length > 1024 || /[\s\x00-\x1f\x7f]/.test(record.secret))
    throw new Error('invalid_cloudflare_credential; run swban deploy/cloudflare/auth/setup');
  env.CLOUDFLARE_API_TOKEN = record.secret;
  if (!env.CLOUDFLARE_ACCOUNT_ID && /^[a-f0-9]{32}$/i.test(record.userName)) env.CLOUDFLARE_ACCOUNT_ID = record.userName;
  return env;
}
