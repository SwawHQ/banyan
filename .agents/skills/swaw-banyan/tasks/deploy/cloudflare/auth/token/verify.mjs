export function tokenInput(value) {
  const token = typeof value?.token === 'string' ? value.token.trim() : '';
  const accountId = typeof value?.accountId === 'string' ? value.accountId.trim() : '';
  if (!token || token.length > 1024 || /[\s\x00-\x1f\x7f]/.test(token)) throw new Error('invalid_cloudflare_token');
  if (accountId && !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('invalid_cloudflare_account_id');
  return {token,accountId};
}

export async function verifyToken(value,request = fetch) {
  const {token,accountId} = tokenInput(value);
  const endpoints = ['/user/tokens/verify',...(accountId ? ['/accounts/'+accountId+'/tokens/verify'] : [])];
  try {
    for (const endpoint of endpoints) {
      const response = await request('https://api.cloudflare.com/client/v4'+endpoint,
        {headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(12000)});
      const data = await response.json();
      if (response.ok && data.success === true && data.result?.status === 'active' &&
          (!data.result.expires_on || Date.parse(data.result.expires_on) > Date.now()) &&
          (!data.result.not_before || Date.parse(data.result.not_before) <= Date.now())) return;
      if (response.status >= 500 || response.status === 429) break;
    }
  } catch { /* Remote errors must not echo the submitted secret. */ }
  throw new Error('cloudflare_token_verification_failed');
}
