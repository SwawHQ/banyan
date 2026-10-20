import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {credentialStore,credentialTarget,inspectCredential,cloudflareEnvironment} from '../_shared/credentials.mjs';
import {startAuthPage} from '../../auth/page.mjs';
import {tokenInput,verifyToken} from '../auth/token/verify.mjs';
import {systemLanguage} from '../../../help/run.mjs';

const token = 'fixture-token-never-a-real-secret',accountId = 'a'.repeat(32);
test('Windows generic credentials use the GUI password format and never expose a secret in checks',{skip:process.platform !== 'win32'},async()=>{
  // A unique test target prevents reading or replacing the user's default credential.
  const options = {target:'swban/test/'+randomUUID()};
  try {
    assert.equal(await credentialStore('read',null,options),null);
    await credentialStore('write',{secret:token,userName:accountId},options);
    const check = await credentialStore('check',null,options);
    assert.deepEqual(check,{userName:accountId}); assert.ok(!JSON.stringify(check).includes(token));
    assert.deepEqual(await credentialStore('read',null,options),{secret:token,userName:accountId});
    await credentialStore('write',{secret:token+'-updated',userName:'api-token'},options);
    assert.deepEqual(await credentialStore('read',null,options),{secret:token+'-updated',userName:'api-token'});
  } finally { await credentialStore('remove',null,options); }
  assert.equal(await credentialStore('check',null,options),null);
});

test('saved credentials feed only child environments and respect explicit credentials and native authorization',async()=>{
  const original = {PATH:'fixture-path'};
  let calls = 0;
  const store = async action=>{calls++; assert.equal(action,'read'); return {secret:token,userName:accountId};};
  assert.deepEqual(await cloudflareEnvironment('cf',['zones','list'],original,store),
    {...original,CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:accountId});
  for (const args of [['--help'],['--version'],['--profile','work','zones','list'],['--profile=work'],['auth','login'],['auth','logout'],
    ['auth','create','work'],['auth','delete','work'],['auth','activate','work'],['auth','deactivate'],['auth','list'],
    ['auth','whoami','--profile','work'],['login'],['logout'],
    ['--cwd','work tree','login'],['--quiet','--mode','dev','auth','login'],['--cwd=work','logout']]) {
    const before = calls;
    assert.deepEqual(await cloudflareEnvironment('cf',args,original,store),original); assert.equal(calls,before);
  }
  const explicit = {...original,CLOUDFLARE_API_TOKEN:'explicit-token'};
  const before = calls;
  assert.deepEqual(await cloudflareEnvironment('cf',[],explicit,store),explicit); assert.equal(calls,before);
  if (process.platform === 'win32') {
    assert.deepEqual(await cloudflareEnvironment('cf',[],{cloudflare_api_token:'explicit-token'},store),{CLOUDFLARE_API_TOKEN:'explicit-token'});
    assert.equal(calls,before);
  }
  const accountOverride = await cloudflareEnvironment('cf',[],{CLOUDFLARE_ACCOUNT_ID:'b'.repeat(32)},store);
  assert.equal(accountOverride.CLOUDFLARE_ACCOUNT_ID,'b'.repeat(32));
  assert.deepEqual(original,{PATH:'fixture-path'});
  assert.deepEqual(await cloudflareEnvironment('cf',[],original,async()=>null),original);
  await assert.rejects(cloudflareEnvironment('cf',[],original,async()=>({secret:'bad\nsecret'})),/invalid_cloudflare_credential/);
  assert.deepEqual(await inspectCredential(async()=>({userName:accountId})),{target:credentialTarget,present:true,accountId});
  assert.deepEqual(await inspectCredential(async()=>null),{target:credentialTarget,present:false});
});

test('Cloudflare identity queries use the same credentials as resource commands',async()=>{
  let reads = 0;
  const store = async()=>{reads++;return {secret:token,userName:accountId};};
  for (const args of [['auth','whoami'],['whoami'],['--quiet','auth','whoami'],['auth','--quiet','whoami'],
    ['--mode','dev','auth','whoami'],['auth','--mode','dev','whoami']]) {
    const before = reads;
    assert.deepEqual(await cloudflareEnvironment('cf',args,{},store),{CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:accountId});
    assert.equal(reads,before+1);
    assert.deepEqual(await cloudflareEnvironment('cf',args,{CLOUDFLARE_API_TOKEN:'explicit-token'},store),{CLOUDFLARE_API_TOKEN:'explicit-token'});
    assert.equal(reads,before+1);
    assert.deepEqual(await cloudflareEnvironment('cf',args,{},async()=>null),{});
  }
});

test('Cloudflare native environment aliases preserve explicit credentials and account targets',async()=>{
  let reads = 0;
  const store = async()=>{reads++;return {secret:token,userName:accountId};};
  for (const tool of ['cf','wrangler']) {
    for (const environment of [
      {CF_API_TOKEN:'explicit-token'},
      {CF_API_KEY:'explicit-key',CF_EMAIL:'explicit@example.test'},
      {CLOUDFLARE_API_KEY:'explicit-key',CF_EMAIL:'explicit@example.test'},
      {CF_API_KEY:'explicit-key',CLOUDFLARE_EMAIL:'explicit@example.test'},
      {CLOUDFLARE_API_TOKEN:'standard-token',CF_API_TOKEN:'alias-token'}
    ]) {
      const before = reads,original = {...environment};
      assert.deepEqual(await cloudflareEnvironment(tool,['pages','project','list'],environment,store),original);
      assert.equal(reads,before);assert.deepEqual(environment,original);
    }
    const explicitAccount = 'b'.repeat(32);
    assert.deepEqual(await cloudflareEnvironment(tool,['pages','project','list'],{CF_ACCOUNT_ID:explicitAccount},store),
      {CF_ACCOUNT_ID:explicitAccount,CLOUDFLARE_API_TOKEN:token});
    const bothAccounts = {CLOUDFLARE_ACCOUNT_ID:explicitAccount,CF_ACCOUNT_ID:accountId};
    assert.deepEqual(await cloudflareEnvironment(tool,[],bothAccounts,store),{...bothAccounts,CLOUDFLARE_API_TOKEN:token});
    const emptyStandard = {CLOUDFLARE_API_TOKEN:'',CF_API_TOKEN:'ignored-alias'};
    assert.deepEqual(await cloudflareEnvironment(tool,[],emptyStandard,store),
      {...emptyStandard,CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:accountId});
    const emptyAccount = {CLOUDFLARE_ACCOUNT_ID:'',CF_ACCOUNT_ID:explicitAccount};
    assert.deepEqual(await cloudflareEnvironment(tool,[],emptyAccount,store),
      {...emptyAccount,CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:accountId});
    if (process.platform === 'win32') {
      const before = reads;
      assert.deepEqual(await cloudflareEnvironment(tool,[],{cf_api_token:'lowercase-token'},store),{CF_API_TOKEN:'lowercase-token'});
      assert.equal(reads,before);
      assert.deepEqual(await cloudflareEnvironment(tool,[],{cf_account_id:explicitAccount},store),
        {CF_ACCOUNT_ID:explicitAccount,CLOUDFLARE_API_TOKEN:token});
    }
  }
});

test('resource names and option values do not bypass the saved Cloudflare identity',async()=>{
  let reads = 0;
  const store = async()=>{reads++;return {secret:token,userName:accountId};};
  for (const name of ['auth','login','logout']) {
    for (const args of [['pages','project','create',name,'--production-branch','main'],
      ['--cwd',name,'pages','project','create','site'],['--mode='+name,'zones','list']]) {
      const before = reads;
      assert.equal((await cloudflareEnvironment('cf',args,{},store)).CLOUDFLARE_API_TOKEN,token);
      assert.equal(reads,before+1);
    }
  }
});

test('boolean global values preserve native sign-in and saved-token selection',async()=>{
  let reads = 0;
  const store = async()=>{reads++;return {secret:token,userName:accountId};};
  for (const [tool,flag] of [['cf','--quiet'],['cf','-q'],['cf','--q'],['cf','--local'],
    ['wrangler','--install-skills'],['wrangler','--installSkills'],['wrangler','--experimental-provision'],['wrangler','--x-provision'],
    ['wrangler','--experimental-auto-create'],['wrangler','--x-auto-create']]) for (const value of ['true','false']) {
    for (const option of [[flag,value],[flag+'='+value],[flag]]) {
      for (const args of [[...option,'auth','login'],['auth',...option,'login'],[...option,'login'],[...option,'logout']]) {
        const before = reads;
        assert.deepEqual(await cloudflareEnvironment(tool,args,{},store),{},args.join(' '));assert.equal(reads,before);
      }
      for (const args of [[...option,'auth','whoami'],['auth',...option,'whoami'],[...option,'zones','list']]) {
        const before = reads;
        assert.equal((await cloudflareEnvironment(tool,args,{},store)).CLOUDFLARE_API_TOKEN,token,args.join(' '));assert.equal(reads,before+1);
      }
    }
  }
});

test('diagnostic booleans, clusters and separators follow each native tool without changing identity',async()=>{
  let reads = 0;
  const store = async()=>{reads++;return {secret:token,userName:accountId};};
  for (const [tool,args,saved] of [
    ['cf',['--version','false','zones','list'],false],['cf',['-v','false','zones','list'],false],
    ['cf',['--version=false','zones','list'],true],['cf',['-v=false','zones','list'],true],
    ['cf',['--version=true','zones','list'],false],['cf',['--v','true','zones','list'],false],['cf',['-qv','zones','list'],false],
    ['wrangler',['--version','false','pages','project','list'],true],['wrangler',['-v','true','pages','project','list'],true],
    ['wrangler',['--version'],false],['wrangler',['--version','true'],false],
    ['cf',['zones','list','--help','false'],true],['wrangler',['pages','project','list','--help','false'],true],
    ['cf',['auth','--help=false','whoami'],true],['cf',['auth','-h=false','whoami'],true],
    ['cf',['auth','-qh','false','whoami'],true],['cf',['auth','-qh=false','whoami'],true],
    ['cf',['zones','list','--help=true','--help=false'],true],['cf',['zones','list','--help=false','--help=true'],false],
    ['cf',['auth','--no-help','whoami'],true],['cf',['auth','--no-quiet','false','login'],false],
    ['cf',['auth','--no-quiet','false','whoami'],false],
    ['cf',['zones','list','--','--help'],true],['cf',['zones','list','--','--version'],true],
    ['cf',['--m','login','auth','whoami'],true],['cf',['--m','login','auth','login'],false],
    ['cf',['zones','list','--profile','work'],false]
  ]) {
    const before = reads,env = await cloudflareEnvironment(tool,args,{},store);
    assert.equal(env.CLOUDFLARE_API_TOKEN,saved ? token : undefined,tool+' '+args.join(' '));
    assert.equal(reads,before+(saved ? 1 : 0));
  }
});

test('verification handles user and account tokens, expiry, invalid input and remote errors without echoing secrets',async()=>{
  assert.deepEqual(tokenInput({token:' '+token+' ',accountId:' '+accountId+' '}),{token,accountId});
  for (const value of [{token:''},{token:'x'.repeat(1025)},{token:'bad\nsecret'},{token,accountId:'wrong'}]) assert.throws(()=>tokenInput(value));
  const calls = [];
  const request = async(url,options)=>{
    calls.push(url); assert.equal(options.headers.Authorization,'Bearer '+token); assert.equal(options.redirect,'error');
    return {ok:true,status:200,json:async()=>({success:true,result:{status:calls.length === 1 ? 'disabled' : 'active'}})};
  };
  await verifyToken({token,accountId},request);
  assert.deepEqual(calls,['https://api.cloudflare.com/client/v4/user/tokens/verify','https://api.cloudflare.com/client/v4/accounts/'+accountId+'/tokens/verify']);
  for (const result of [{status:'expired'},{status:'active',not_before:'2999-01-01T00:00:00Z'},{status:'active',expires_on:'2000-01-01T00:00:00Z'}])
    await assert.rejects(verifyToken({token},async()=>({ok:true,status:200,json:async()=>({success:true,result})})),/^Error: cloudflare_token_verification_failed$/);
  await assert.rejects(verifyToken({token},async()=>{throw new Error(token);}),/^Error: cloudflare_token_verification_failed$/);
});

async function fixture(run,options = {}) {
  const writes = [];
  const page = await startAuthPage({store:async(platform,action,value)=>{if(action === 'write')writes.push(value);return null;},verify:async()=>{},prepare:async()=>{},check:async()=>'authorized',environment:{},...options});
  const url = new URL(page.url),origin = url.origin,session = url.hash.slice(1);
  const post = (route,value,headers = {})=>fetch(origin+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Swban-Session':session,...headers},body:JSON.stringify(route === '/save' ? {platform:'cloudflare',...value} : value)});
  try { await run({page,origin,post,writes}); } finally { page.close(); await page.completed; }
}

test('local page rejects cross-origin and oversized requests, then saves without closing setup',()=>fixture(async({page,origin,post,writes})=>{
  const response = await fetch(origin);
  const html = await response.text();
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.ok(html.includes(credentialTarget)); assert.ok(!html.includes(token));
  assert.ok(html.includes('<html lang="'+systemLanguage()+'">'));
  const data = await (await fetch(origin+'/page.json')).json();
  const copy = JSON.parse(fs.readFileSync(new URL('../../auth/page.json',import.meta.url),'utf8'));
  assert.equal(data.platform,'cloudflare');assert.equal(data.language,systemLanguage());assert.deepEqual(data.text,{en:copy.en,zh:copy.zh});assert.deepEqual(data.links,copy.links);
  assert.deepEqual(data.existing,{cloudflare:false,tencent:false});
  assert.deepEqual(data.environment.cloudflare,{token:false,accountId:null,accountSet:false,legacyKey:false,email:false});
  for (const headers of [{Origin:'https://evil.example'},{'X-Swban-Session':'wrong'},{'Content-Type':'text/plain'}])
    assert.equal((await post('/save',{token},headers)).status,403);
  const rebound = await new Promise((resolve,reject)=>{
    const request = http.get(origin,{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);});
    request.once('error',reject);
  });
  assert.equal(rebound,403);
  assert.equal((await post('/save',{token:'x'.repeat(9000)})).status,413);
  assert.equal((await post('/save',{token:'bad\nsecret'})).status,400);
  assert.equal(writes.length,0);
  const saved = await post('/save',{token,accountId});
  assert.deepEqual(await saved.json(),{saved:true});
  assert.deepEqual(writes,[{secret:token,userName:accountId}]);
  assert.equal((await (await fetch(origin+'/page.json')).json()).existing.cloudflare,true);
  await post('/cancel',{}); assert.equal(await page.completed,'cancelled');
  await assert.rejects(fetch(origin));
}));

test('verification or storage failure preserves the old credential and keeps the form available',async()=>{
  for (const failure of ['verify','store']) await fixture(async({page,origin,post,writes})=>{
    const response = await post('/save',{token});
    assert.equal(response.status,400); assert.ok(!(await response.text()).includes(token));
    assert.equal(writes.length,0); assert.equal((await fetch(origin)).status,200);
    assert.deepEqual(await (await post('/cancel',{})).json(),{cancelled:true});
    assert.equal(await page.completed,'cancelled');
  },failure === 'verify' ? {verify:async()=>{throw new Error('cloudflare_token_verification_failed');}} :
    {store:async(platform,action)=>{if(action === 'write')throw new Error(token);return {userName:'old'};}});
});

test('closing setup during verification never commits a late credential',{timeout:5000},async()=>{
  let release,started;
  const verifying = new Promise(resolve=>{started = resolve;});
  const gate = new Promise(resolve=>{release = resolve;});
  await fixture(async({page,origin,post,writes})=>{
    const saving = post('/save',{token}).catch(()=>null);
    await verifying; page.close();
    assert.equal(await page.completed,'cancelled'); release(); await saving;
    assert.equal(writes.length,0); await assert.rejects(fetch(origin));
  },{verify:async()=>{started();await gate;}});
});

test('an in-flight Windows write completes before reporting session closure',{timeout:5000},async()=>{
  let started,release;
  const writing = new Promise(resolve=>{started = resolve;});
  const gate = new Promise(resolve=>{release = resolve;});
  await fixture(async({page,post})=>{
    const saving = post('/save',{token});
    await writing;
    assert.equal((await post('/cancel',{})).status,409);
    assert.equal((await post('/save',{token})).status,409);
    assert.equal((await post('/status',{tool:'cf'})).status,409);
    assert.equal((await post('/prepare',{tool:'cf'})).status,409);
    page.close(); release();
    assert.deepEqual(await (await saving).json(),{saved:true});
    assert.equal(await page.completed,'cancelled');
  },{store:async(platform,action)=>{if(action === 'write'){started();await gate;}return null;}});
});

test('a disconnected save finishes its write before explicit session closure',{timeout:5000},async t=>{
  const started = Promise.withResolvers(),release = Promise.withResolvers(),disconnected = Promise.withResolvers();
  let writes = 0,completed = false,guard;
  const emit = http.ServerResponse.prototype.emit;
  t.mock.method(http.ServerResponse.prototype,'emit',function(event,...args) {
    if (event === 'close' && this.req.url === '/save') disconnected.resolve();
    return emit.call(this,event,...args);
  });
  await fixture(async({page,origin})=>{
    page.completed.then(()=>{completed = true;});
    const request = http.request(origin+'/save',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Swban-Session':new URL(page.url).hash.slice(1)}},response=>response.resume());
    request.on('error',started.reject);request.end(JSON.stringify({platform:'cloudflare',token}));
    try {
      await started.promise;request.destroy();await disconnected.promise;
      page.close();
      assert.equal(completed,false);assert.equal(writes,0);
      release.resolve();
      const result = await new Promise((resolve,reject)=>{
        guard = setTimeout(()=>reject(new Error('session_did_not_close')),1000);
        page.completed.then(resolve,reject);
      });
      assert.equal(result,'cancelled');assert.equal(writes,1);
      await assert.rejects(fetch(origin));
    } finally {clearTimeout(guard);release.resolve();request.destroy();page.close();}
  },{store:async(platform,action)=>{
    if (action === 'write') {started.resolve();await release.promise;writes++;}return null;
  }});
});

test('setup exposes only environment status and validates native login requests without returning CLI errors',async()=>{
  const calls = [];
  await fixture(async({page,origin,post,writes})=>{
    const response = await fetch(origin+'/page.json');
    const body = await response.text(),data = JSON.parse(body);
    for (const secret of ['fixture-env-token','fixture-api-key','private@example.test']) assert.ok(!body.includes(secret));
    assert.deepEqual(data.environment.cloudflare,{token:true,accountId,accountSet:true,legacyKey:true,email:true});
    assert.equal((await post('/login',{tool:'cf'},{Origin:'https://evil.example'})).status,403);
    for (const tool of ['node','cf --help',null]) assert.equal((await post('/login',{tool})).status,400);
    assert.equal(calls.length,0);
    assert.deepEqual(await (await post('/login',{tool:'cf'})).json(),{authorized:'cf'});
    const failed = await post('/login',{tool:'wrangler'});
    assert.equal(failed.status,400); assert.deepEqual(await failed.json(),{error:'login_failed'});
    assert.deepEqual(calls,['cf','wrangler']); assert.equal(writes.length,0);
    assert.equal((await fetch(origin)).status,200);
    await post('/cancel',{}); assert.equal(await page.completed,'cancelled');
  },{environment:{cloudflare_api_token:'fixture-env-token',CLOUDFLARE_ACCOUNT_ID:accountId,CLOUDFLARE_API_KEY:'fixture-api-key',CLOUDFLARE_EMAIL:'private@example.test'},
    login:async(tool,{signal,environment})=>{calls.push(tool);assert.ok(!signal.aborted);assert.equal(environment.cloudflare_api_token,'fixture-env-token');if(tool==='wrangler')throw new Error('private-cli-output');}});
  await fixture(async({origin})=>{
    const data = await (await fetch(origin+'/page.json')).json();
    assert.equal(data.environment.cloudflare.accountId,null);assert.equal(data.environment.cloudflare.accountSet,true);
    assert.ok(!JSON.stringify(data).includes('invalid-private-value'));
  },{environment:{CLOUDFLARE_ACCOUNT_ID:'invalid-private-value'}});
});

test('authorization page reports native environment aliases without exposing credential contents',async()=>{
  const aliases = {cf_api_token:'private-alias-token',cf_api_key:'private-alias-key',
    cf_email:'private-alias@example.test',cf_account_id:accountId};
  for (const [environment,expected] of [
    [aliases,{token:true,accountId,accountSet:true,legacyKey:true,email:true}],
    [{...aliases,CLOUDFLARE_API_TOKEN:'',CLOUDFLARE_API_KEY:'',CLOUDFLARE_EMAIL:'',CLOUDFLARE_ACCOUNT_ID:''},
      {token:false,accountId:null,accountSet:false,legacyKey:false,email:false}],
    [{...aliases,CLOUDFLARE_ACCOUNT_ID:'private-invalid-account'},
      {token:true,accountId:null,accountSet:true,legacyKey:true,email:true}]
  ]) await fixture(async({origin})=>{
    const response = await fetch(origin+'/page.json'),body = await response.text();
    assert.deepEqual(JSON.parse(body).environment.cloudflare,expected);
    for (const secret of ['private-alias-token','private-alias-key','private-alias@example.test','private-invalid-account'])
      assert.ok(!body.includes(secret));
  },{environment});
});

test('closing setup aborts an active login and rejects concurrent mutations',{timeout:5000},async()=>{
  let started,aborted;
  const running = new Promise(resolve=>{started = resolve;});
  await fixture(async({page,post,writes})=>{
    const request = post('/login',{tool:'cf'}).catch(()=>null);
    await running;
    assert.equal((await post('/login',{tool:'wrangler'})).status,409);
    assert.equal((await post('/save',{token})).status,409);
    assert.deepEqual(await (await post('/cancel',{})).json(),{cancelled:true});
    assert.equal(await page.completed,'cancelled'); await request;
    assert.equal(aborted,true);assert.equal(writes.length,0);
  },{login:async(tool,{signal})=>new Promise((resolve,reject)=>{
    started();signal.addEventListener('abort',()=>{aborted = true;reject(new Error('aborted'));},{once:true});
  })});
});

test('Token page prefers site icons over Module icons and serves only the selected favicon files',async()=>{
  const parent = fs.realpathSync.native(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent,'swban-token-icons-'));
  const moduleIcon = '<svg xmlns="http://www.w3.org/2000/svg"><text>Module</text></svg>';
  const siteIcon = Buffer.from('fixture-site-icon');
  try {
    fs.mkdirSync(path.join(root,'module/static'),{recursive:true});
    fs.writeFileSync(path.join(root,'module/static/favicon.svg'),moduleIcon);
    await fixture(async({origin})=>{
      const svg = await fetch(origin+'/favicon.svg');
      assert.equal(svg.headers.get('content-type'),'image/svg+xml');
      assert.equal(await svg.text(),moduleIcon);
      assert.equal((await fetch(origin+'/module/static/favicon.svg')).status,404);
    },{siteRoot:root});
    fs.mkdirSync(path.join(root,'static'));
    fs.writeFileSync(path.join(root,'static/favicon.ico'),siteIcon);
    fs.writeFileSync(path.join(root,'static/private.txt'),'must-not-be-served');
    await fixture(async({origin})=>{
      const html = await (await fetch(origin)).text();
      assert.match(html,/<img src="\/favicon.ico"/);
      const ico = await fetch(origin+'/favicon.ico');
      assert.equal(ico.headers.get('content-type'),'image/x-icon');
      assert.deepEqual(Buffer.from(await ico.arrayBuffer()),siteIcon);
      assert.equal((await fetch(origin+'/favicon.svg')).status,404);
      assert.equal((await fetch(origin+'/static/private.txt')).status,404);
    },{siteRoot:root});
  } finally {
    assert.equal(path.dirname(fs.realpathSync.native(root)),parent);
    assert.ok(path.basename(root).startsWith('swban-token-icons-'));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
