import {credentialStore as systemStore} from '../../_shared/credential-store.mjs';

export const credentialTarget = 'swban/tencent/default';
export const credentialStore = (action,record)=>systemStore(credentialTarget,action,record);

export function keyInput(value) {
  const secretId = typeof value?.secretId === 'string' ? value.secretId.trim() : '';
  const secretKey = typeof value?.secretKey === 'string' ? value.secretKey.trim() : '';
  if (!/^[a-zA-Z0-9]{16,128}$/.test(secretId) || !/^[a-zA-Z0-9]{16,128}$/.test(secretKey)) throw new Error('invalid_tencent_key');
  return {secretId,secretKey};
}

export async function tencentEnvironment(args,environment,store = credentialStore) {
  const env = {...environment};
  if (process.platform === 'win32') for (const key of Object.keys(env))
    if (/^(TENCENTCLOUD_|TKE_|TCCLI_PROFILE$)/i.test(key) && key !== key.toUpperCase()) {env[key.toUpperCase()] = env[key];delete env[key];}
  // Explicit profiles, identity providers and local commands keep tccli's native rules.
  if (!args.length || (args.length === 1 && args[0] === '--version') || ['configure','auth','sso'].includes(args[0]) ||
      args.slice(0,3).includes('help') || args.some(arg=>['--help','-h','--generate-cli-skeleton'].includes(arg) ||
      /^--(?:profile|secretId|secretKey|token|role-arn|role-session-name|use-cvm-role)(?:=|$)/.test(arg)) ||
      env.TCCLI_PROFILE || env.TENCENTCLOUD_ROLE_ARN || env.TENCENTCLOUD_ROLE_SESSION_NAME || env.TKE_ROLE_ARN) return env;
  if (env.TENCENTCLOUD_SECRET_ID || env.TENCENTCLOUD_SECRET_KEY || env.TENCENTCLOUD_TOKEN) {
    if (!env.TENCENTCLOUD_SECRET_ID || !env.TENCENTCLOUD_SECRET_KEY) throw new Error('incomplete_tencent_credentials');
    return env;
  }
  const record = await store('read');
  if (!record) return env;
  let key;
  try {key = keyInput({secretId:record.userName,secretKey:record.secret});}
  catch {throw new Error('invalid_tencent_credential; run swban deploy/tencent/auth/setup');}
  return {...env,TENCENTCLOUD_SECRET_ID:key.secretId,TENCENTCLOUD_SECRET_KEY:key.secretKey};
}
