import {createHash,createHmac} from 'node:crypto';
import {keyInput} from './credentials.mjs';

export async function verifyKey(value,request = fetch,now = Date.now()) {
  const {secretId,secretKey} = keyInput(value);
  const timestamp = Math.floor(now/1000),date = new Date(timestamp*1000).toISOString().slice(0,10);
  const host = 'sts.tencentcloudapi.com',type = 'application/json; charset=utf-8',body = '{}';
  const hash = value=>createHash('sha256').update(value).digest('hex');
  const hmac = (key,value)=>createHmac('sha256',key).update(value).digest();
  const scope = date+'/sts/tc3_request';
  const canonical = 'POST\n/\n\ncontent-type:'+type+'\nhost:'+host+'\n\ncontent-type;host\n'+hash(body);
  const signing = hmac(hmac(hmac('TC3'+secretKey,date),'sts'),'tc3_request');
  const signature = hmac(signing,'TC3-HMAC-SHA256\n'+timestamp+'\n'+scope+'\n'+hash(canonical)).toString('hex');
  try {
    const response = await request('https://'+host+'/',{method:'POST',body,redirect:'error',signal:AbortSignal.timeout(12000),headers:{
      'Content-Type':type,'X-TC-Action':'GetCallerIdentity','X-TC-Version':'2018-08-13','X-TC-Region':'ap-guangzhou','X-TC-Timestamp':String(timestamp),
      Authorization:'TC3-HMAC-SHA256 Credential='+secretId+'/'+scope+', SignedHeaders=content-type;host, Signature='+signature}});
    const data = await response.json();
    if (response.ok && data.Response?.AccountId && data.Response?.UserId && !data.Response.Error) return;
  } catch { /* Remote errors must not echo the submitted key. */ }
  throw new Error('tencent_key_verification_failed');
}
