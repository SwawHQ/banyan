import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {startAuthPage} from '../page.mjs';
import {tencentEnvironment,keyInput} from '../../tencent/auth/credentials.mjs';
import {verifyKey} from '../../tencent/auth/verify.mjs';
import {skillRoot} from '../../../_shared/tools/manifest.mjs';

const secretId = 'AKID'+'a'.repeat(32),secretKey = 'b'.repeat(32);

test('Tencent credentials preserve explicit identities and never mix partial environment credentials with the vault',async()=>{
  const original = {PATH:'fixture-path'},calls = [];
  const store = async action=>{calls.push(action);return {userName:secretId,secret:secretKey};};
  assert.deepEqual(await tencentEnvironment(['teo','DescribeZones'],original,store),{...original,TENCENTCLOUD_SECRET_ID:secretId,TENCENTCLOUD_SECRET_KEY:secretKey});
  assert.equal((await tencentEnvironment(['teo','DescribeZones','--version','2022-09-01'],original,store)).TENCENTCLOUD_SECRET_KEY,secretKey);
  for (const value of ['auth','configure','help']) assert.equal((await tencentEnvironment(['teo','DescribeZones','--Filters.0.Values.0',value],original,store)).TENCENTCLOUD_SECRET_KEY,secretKey);
  for (const args of [['help'],['teo','help'],['--version'],['auth','login'],['auth','logout'],['configure','list'],['--profile','work'],['--profile=work'],['--secretId','explicit'],['--token=explicit'],['--role-arn','explicit'],['--use-cvm-role','true']]) {
    const before = calls.length;assert.deepEqual(await tencentEnvironment(args,original,store),original);assert.equal(calls.length,before);
  }
  for (const env of [{TCCLI_PROFILE:'work'},{TENCENTCLOUD_ROLE_ARN:'role'},{TKE_ROLE_ARN:'role'},
    {TENCENTCLOUD_SECRET_ID:'explicit-id',TENCENTCLOUD_SECRET_KEY:'explicit-key',TENCENTCLOUD_TOKEN:'explicit-token'}]) {
    const before = calls.length;assert.deepEqual(await tencentEnvironment(['teo','DescribeZones'],env,store),env);assert.equal(calls.length,before);
  }
  for (const env of [{TENCENTCLOUD_SECRET_ID:'partial'},{TENCENTCLOUD_SECRET_KEY:'partial'},{TENCENTCLOUD_TOKEN:'partial'}])
    await assert.rejects(tencentEnvironment(['teo','DescribeZones'],env,store),/^Error: incomplete_tencent_credentials$/);
  if (process.platform === 'win32') assert.deepEqual(await tencentEnvironment(['teo','DescribeZones'],{tencentcloud_secret_id:'id',tencentcloud_secret_key:'key'},store),
    {TENCENTCLOUD_SECRET_ID:'id',TENCENTCLOUD_SECRET_KEY:'key'});
  assert.deepEqual(await tencentEnvironment(['teo','DescribeZones'],original,async()=>null),original);
  await assert.rejects(tencentEnvironment(['teo','DescribeZones'],original,async()=>({userName:secretId,secret:'bad\nsecret'})),/invalid_tencent_credential/);
  assert.deepEqual(original,{PATH:'fixture-path'});
});

test('Tencent identity verification signs only the fixed STS request and sanitizes failures',async()=>{
  assert.deepEqual(keyInput({secretId:' '+secretId+' ',secretKey:' '+secretKey+' '}),{secretId,secretKey});
  for (const value of [{secretId,secretKey:''},{secretId:'bad\nvalue',secretKey},{secretId,secretKey:'x'.repeat(129)}]) assert.throws(()=>keyInput(value),/invalid_tencent_key/);
  await verifyKey({secretId,secretKey},async(url,options)=>{
    assert.equal(url,'https://sts.tencentcloudapi.com/');assert.equal(options.method,'POST');assert.equal(options.body,'{}');assert.equal(options.redirect,'error');
    assert.equal(options.headers['X-TC-Action'],'GetCallerIdentity');assert.equal(options.headers['X-TC-Timestamp'],'1551113065');
    assert.equal(options.headers.Authorization,'TC3-HMAC-SHA256 Credential='+secretId+'/2019-02-25/sts/tc3_request, SignedHeaders=content-type;host, Signature=4cc0fab72bc87ae9f3666a11d95767f2e95c78ac0c95a3c10c63bd64a9d3125e');
    assert.ok(!JSON.stringify(options).includes(secretKey));
    return {ok:true,json:async()=>({Response:{AccountId:'12345',UserId:'67890'}})};
  },1551113065000);
  for (const request of [async()=>{throw new Error(secretKey);},async()=>({ok:true,json:async()=>({Response:{Error:{Message:secretKey}}})})])
    await assert.rejects(verifyKey({secretId,secretKey},request),/^Error: tencent_key_verification_failed$/);
});

test('one setup session isolates platform writes, redacts Tencent variables and validates platform names',async()=>{
  const writes = [],verified = [],records = {cloudflare:{userName:'api-token'}};
  const page = await startAuthPage({platform:'tencent',store:async(platform,action,value)=>{
    if(action==='write'){writes.push({platform,...value});records[platform] = value;}return records[platform]||null;
  },verify:async(platform,value)=>{verified.push({platform,...value});},environment:{TENCENTCLOUD_SECRET_ID:secretId,TENCENTCLOUD_SECRET_KEY:secretKey,TENCENTCLOUD_TOKEN:'private-sts-token',TCCLI_PROFILE:'private-profile'}});
  const url = new URL(page.url),origin = url.origin;
  const post = (route,value)=>fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1)},body:JSON.stringify(value)});
  try {
    const data = await (await fetch(origin+'/page.json')).json();
    assert.equal(data.platform,'tencent');assert.deepEqual(data.existing,{cloudflare:true,tencent:false});
    for (const secret of [secretId,secretKey,'private-sts-token','private-profile']) assert.ok(!JSON.stringify(data).includes(secret));
    assert.equal(data.environment.tencent.TENCENTCLOUD_SECRET_KEY,true);
    for (const platform of [undefined,'node','__proto__','constructor',null]) assert.equal((await post('/save',{platform,secretId,secretKey})).status,400);
    assert.equal(writes.length,0);
    assert.deepEqual(await (await post('/save',{platform:'tencent',secretId,secretKey})).json(),{saved:true});
    assert.deepEqual(writes,[{platform:'tencent',userName:secretId,secret:secretKey}]);assert.deepEqual(records.cloudflare,{userName:'api-token'});
    await post('/save',{platform:'cloudflare',token:'fixture-cloudflare-token'});
    assert.deepEqual(records.tencent,{userName:secretId,secret:secretKey});assert.equal(writes[1].platform,'cloudflare');
    assert.deepEqual(verified.map(v=>v.platform),['tencent','cloudflare']);
  } finally {page.close();await page.completed;}
  await assert.rejects(startAuthPage({platform:'__proto__',store:async()=>null}),/invalid_auth_platform/);
});

test('unified and per-platform commands open the shared page with the requested tab',{timeout:30000},async()=>{
  const parent = fs.realpathSync.native(os.tmpdir()),work = fs.mkdtempSync(path.join(parent,'swban-auth-entry-'));
  try {
    const skill = path.join(work,'skill');
    fs.cpSync(skillRoot,skill,{recursive:true,filter:file=>!['.tools','node_modules'].includes(path.basename(file))});
    // Replace only the credential bridge in the copied Skill; never read real credentials.
    fs.writeFileSync(path.join(skill,'tasks/deploy/_shared/credential.ps1'),"param([string]$Action,[string]$Target)\n[Console]::WriteLine('null')\n");
    for (const [command,platform] of [['auth','cloudflare'],['cloudflare/auth','cloudflare'],['tencent/auth','tencent']]) {
      const child = spawn(process.execPath,[path.join(skill,'tasks/deploy',command,'setup/entry.mjs'),'--no-browser'],{cwd:work,windowsHide:true,stdio:['ignore','pipe','pipe']});
      const exited = once(child,'close');
      let stderr = '',stdout = '';
      child.stdout.on('data',chunk=>{stdout += chunk;});
      const address = new Promise((resolve,reject)=>{
        child.stderr.on('data',chunk=>{stderr += chunk;const match = /http:\/\/127\.0\.0\.1:\d+\/#\w{64}/.exec(stderr);if(match)resolve(match[0]);});
        child.once('error',reject);child.once('close',()=>reject(new Error(stderr)));
      });
      try {
        const url = new URL(await address),origin = url.origin;
        assert.equal((await (await fetch(origin+'/page.json')).json()).platform,platform);
        const response = await fetch(origin+'/cancel',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1)},body:'{}'});
        assert.equal(response.status,200);assert.equal((await exited)[0],0,stderr);assert.deepEqual(JSON.parse(stdout),{action:'cancelled'});
      } finally {if(child.exitCode===null)child.kill();await exited;}
    }
  } finally {
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);assert.ok(path.basename(work).startsWith('swban-auth-entry-'));fs.rmSync(work,{recursive:true,force:true});
  }
});

test('tool preparation is authenticated, serial, deduplicated and retryable without blocking credential saves',{timeout:5000},async()=>{
  const calls=[],logins=[],writes=[],gate=Promise.withResolvers(),started=Promise.withResolvers();
  const page=await startAuthPage({store:async(platform,action,value)=>{if(action==='write')writes.push(value);return null;},verify:async()=>{},
    prepare:async(tool,{signal})=>{
      assert.equal(signal.aborted,false);calls.push(tool);
      if(tool==='cf'){started.resolve();await gate.promise;}
      if(tool==='wrangler'&&calls.filter(value=>value===tool).length===1)throw new Error('private-download-error');
    },login:async tool=>{logins.push(tool);}});
  const url=new URL(page.url),post=(route,value,headers={})=>fetch(url.origin+route,{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1),...headers},body:JSON.stringify(value)});
  try {
    assert.equal((await post('/prepare',{tool:'cf'},{Origin:'https://evil.example'})).status,403);
    assert.equal((await post('/prepare',{tool:'cf'},{'X-Swban-Session':'wrong'})).status,403);
    for(const tool of ['node','__proto__',null])assert.equal((await post('/prepare',{tool})).status,400);
    assert.equal((await post('/prepare',{tool:'cf',extra:'x'.repeat(9000)})).status,413);assert.deepEqual(calls,[]);
    const first=post('/prepare',{tool:'cf'});await started.promise;
    const duplicate=post('/prepare',{tool:'cf'}),second=post('/prepare',{tool:'wrangler'});
    assert.deepEqual(await (await post('/save',{platform:'tencent',secretId,secretKey})).json(),{saved:true});
    assert.equal(writes.length,1);assert.deepEqual(calls,['cf']);assert.deepEqual(logins,[]);
    gate.resolve();
    for(const response of await Promise.all([first,duplicate]))assert.deepEqual(await response.json(),{prepared:'cf'});
    assert.deepEqual(await (await second).json(),{error:'tool_preparation_failed'});assert.deepEqual(calls,['cf','wrangler']);
    for(let attempt=0;attempt<2;attempt++)assert.deepEqual(await (await post('/prepare',{tool:'wrangler'})).json(),{prepared:'wrangler'});
    assert.deepEqual(calls,['cf','wrangler','wrangler']);assert.deepEqual(logins,[]);
    assert.deepEqual(await (await post('/login',{tool:'cf'})).json(),{authorized:'cf'});assert.deepEqual(logins,['cf']);
  } finally {gate.resolve();page.close();await page.completed;}
});

test('closing setup aborts preparation and never starts a queued installer',{timeout:5000},async()=>{
  const calls=[],started=Promise.withResolvers();let aborted=false;
  const page=await startAuthPage({store:async()=>null,prepare:async(tool,{signal})=>new Promise((resolve,reject)=>{
    calls.push(tool);started.resolve();signal.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));},{once:true});
  })});
  const url=new URL(page.url),post=(route,tool)=>fetch(url.origin+route,{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1)},body:JSON.stringify({tool})});
  try {
    const first=post('/prepare','tccli').catch(()=>null);await started.promise;
    const queued=post('/prepare','cf').catch(()=>null);
    assert.equal((await post('/cancel')).status,200);assert.equal(await page.completed,'cancelled');
    await Promise.all([first,queued]);assert.equal(aborted,true);assert.deepEqual(calls,['tccli']);
  } finally {page.close();await page.completed;}
});
