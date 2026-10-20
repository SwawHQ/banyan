import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
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

test('setup remains available until explicitly closed',{timeout:5000},async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const page = await startAuthPage({store:async()=>null,environment:{}});
  const origin = new URL(page.url).origin;
  try {
    t.mock.timers.tick(600000);t.mock.timers.reset();
    assert.equal((await fetch(origin)).status,200);
    page.close();assert.equal(await page.completed,'cancelled');
    await assert.rejects(fetch(origin));
  } finally {t.mock.timers.reset();page.close();await page.completed;}
});

test('setup uses browser-safe dynamic ports and retries an initial port conflict',{timeout:5000},async t=>{
  const ports=[],listen=http.Server.prototype.listen;
  t.mock.method(http.Server.prototype,'listen',function(port,host,...args){
    ports.push(port);assert.ok(port>=49152&&port<=65535);assert.equal(host,'127.0.0.1');
    if(ports.length===1){queueMicrotask(()=>this.emit('error',Object.assign(new Error('fixture_port_in_use'),{code:'EADDRINUSE'})));return this;}
    return listen.call(this,port,host,...args);
  });
  const page=await startAuthPage({store:async()=>null,environment:{}});
  try {
    assert.ok(ports.length>=2);assert.equal(Number(new URL(page.url).port),ports.at(-1));
    assert.equal((await fetch(new URL(page.url).origin)).status,200);
  } finally {page.close();await page.completed;}
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
        assert.ok(stderr.includes('[swban] Open this local URL: '+url));
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
    },login:async tool=>{logins.push(tool);},check:async()=>'authorized'});
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

test('native status requires the session, returns only allowed states and never reads the vault again',{timeout:5000},async()=>{
  const stores=[],prepared=[],checks=[],environment={CLOUDFLARE_API_TOKEN:'private-environment-token'};
  let result='authorized';
  const page=await startAuthPage({environment,store:async(platform,action)=>{stores.push([platform,action]);return null;},
    prepare:async tool=>{prepared.push(tool);},check:async(tool,options)=>{
      checks.push(tool);assert.equal(options.environment,environment);assert.equal(options.signal.aborted,false);
      if(result instanceof Error)throw result;return result;
    }});
  const url=new URL(page.url),post=(value,headers={})=>fetch(url.origin+'/status',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1),...headers},body:JSON.stringify(value)});
  try {
    for(const headers of [{Origin:'https://evil.example'},{'X-Swban-Session':'wrong'},{'Content-Type':'text/plain'}])assert.equal((await post({tool:'cf'},headers)).status,403);
    for(const tool of ['node','__proto__',null])assert.equal((await post({tool})).status,400);
    assert.equal((await post({tool:'cf',extra:'x'.repeat(9000)})).status,413);assert.deepEqual(checks,[]);assert.deepEqual(prepared,[]);
    const values=['authorized','notAuthorized','unavailable','private-account-name',{email:'private@example.test'},null,new Error('private-cli-error')];
    for(const value of values) {
      result=value;
      assert.deepEqual(await (await post({tool:'cf'})).json(),{status:['authorized','notAuthorized','unavailable'].includes(value)?value:'unavailable'});
    }
    assert.deepEqual(prepared,['cf']);assert.equal(checks.length,values.length);
    assert.deepEqual(stores,[['cloudflare','check'],['tencent','check']]);
  } finally {page.close();await page.completed;}
});

test('in-flight status requests share a check and cannot release a concurrent save lock',{timeout:5000},async t=>{
  const checking=Promise.withResolvers(),checked=Promise.withResolvers(),writing=Promise.withResolvers(),written=Promise.withResolvers();
  const duplicateAccepted=Promise.withResolvers(),emit=http.Server.prototype.emit;
  let checks=0,writes=0,requests=0;
  t.mock.method(http.Server.prototype,'emit',function(event,...args){
    const result=emit.call(this,event,...args);
    if(event==='request'&&args[0].url==='/status'&&++requests===2)duplicateAccepted.resolve();
    return result;
  });
  const page=await startAuthPage({environment:{},store:async(platform,action)=>{
    if(action==='write'){writing.resolve();await written.promise;writes++;}return null;
  },verify:async()=>{},prepare:async()=>{},login:async()=>assert.fail('unexpected_login'),check:async()=>{checks++;checking.resolve();await checked.promise;return 'authorized';}});
  const url=new URL(page.url),post=(route,value)=>fetch(url.origin+route,{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1)},body:JSON.stringify(value)});
  try {
    const first=post('/status',{tool:'cf'});await checking.promise;
    const duplicate=post('/status',{tool:'cf'});await duplicateAccepted.promise;
    const saving=post('/save',{platform:'tencent',secretId,secretKey});
    await writing.promise;assert.equal(checks,1);checked.resolve();
    for(const response of await Promise.all([first,duplicate]))assert.deepEqual(await response.json(),{status:'authorized'});
    for(const route of ['/status','/prepare','/login','/save'])assert.equal((await post(route,{tool:'cf',platform:'tencent',secretId,secretKey})).status,409);
    assert.equal((await post('/cancel',{})).status,409);assert.equal(writes,0);
    written.resolve();assert.deepEqual(await (await saving).json(),{saved:true});assert.equal(writes,1);
    assert.deepEqual(await (await post('/status',{tool:'cf'})).json(),{status:'authorized'});assert.equal(checks,2);
  } finally {checked.resolve();written.resolve();page.close();await page.completed;}
});

test('closing setup aborts native status checks without starting a new operation',{timeout:5000},async()=>{
  const started=Promise.withResolvers();let aborted=false,checks=0;
  const page=await startAuthPage({environment:{},store:async()=>null,prepare:async()=>{},check:async(tool,{signal})=>new Promise((resolve,reject)=>{
    checks++;started.resolve();signal.addEventListener('abort',()=>{aborted=true;reject(new Error('private-aborted-error'));},{once:true});
  })});
  const url=new URL(page.url),post=route=>fetch(url.origin+route,{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1)},body:JSON.stringify({tool:'wrangler'})});
  try {
    const pending=post('/status').catch(()=>null);await started.promise;
    assert.equal((await post('/cancel')).status,200);assert.equal(await page.completed,'cancelled');
    assert.equal(await pending,null);assert.equal(aborted,true);assert.equal(checks,1);
  } finally {page.close();await page.completed;}
});

test('status preparation failure is unavailable and a later request can retry',{timeout:5000},async()=>{
  let preparations=0,checks=0;
  const page=await startAuthPage({environment:{},store:async()=>null,prepare:async()=>{if(++preparations===1)throw new Error('private-download-error');},
    check:async()=>{checks++;return 'authorized';}});
  const url=new URL(page.url),post=()=>fetch(url.origin+'/status',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1)},body:JSON.stringify({tool:'cf'})});
  try {
    assert.deepEqual(await (await post()).json(),{status:'unavailable'});assert.equal(checks,0);
    assert.deepEqual(await (await post()).json(),{status:'authorized'});assert.equal(checks,1);assert.equal(preparations,2);
  } finally {page.close();await page.completed;}
});

test('successful native login requires a fresh status check before reporting authorization for every tool',{timeout:5000},async()=>{
  const logins=[],checks=[],environment={};let result='notAuthorized';
  const page=await startAuthPage({environment,store:async()=>null,login:async tool=>{logins.push(tool);},check:async(tool,options)=>{
    checks.push(tool);assert.equal(options.environment,environment);assert.equal(options.signal.aborted,false);
    if(result instanceof Error)throw result;return result;
  }});
  const url=new URL(page.url),post=tool=>fetch(url.origin+'/login',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1)},body:JSON.stringify({tool})});
  try {
    for(const tool of ['cf','wrangler','tccli'])for(const value of ['notAuthorized','unavailable','unknown',new Error('private-cli-error'),'authorized']) {
      result=value;const status=['notAuthorized','unavailable','authorized'].includes(value)?value:'unavailable';
      assert.deepEqual(await (await post(tool)).json(),status==='authorized'?{authorized:tool}:{status});
    }
    assert.equal(checks.length,15);assert.deepEqual(checks,logins);
  } finally {page.close();await page.completed;}
});

test('tccli status is checked again after page reload and in a new setup session',{timeout:5000},async()=>{
  const checks=[];let result;
  for(const statuses of [['authorized','notAuthorized'],['authorized']]) {
    const page=await startAuthPage({platform:'tencent',environment:{},store:async()=>null,prepare:async()=>{},check:async tool=>{
      assert.equal(tool,'tccli');checks.push(result);return result;
    }});
    const url=new URL(page.url);
    try {
      for(const status of statuses) {
        result=status;assert.equal((await fetch(url.origin)).status,200);
        const response=await fetch(url.origin+'/status',{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json','X-Swban-Session':url.hash.slice(1)},body:JSON.stringify({tool:'tccli'})});
        assert.deepEqual(await response.json(),{status});
      }
    } finally {page.close();await page.completed;}
  }
  assert.deepEqual(checks,['authorized','notAuthorized','authorized']);
});
