import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {skillRoot} from '../../../_shared/tools/manifest.mjs';
import {writeBindings} from '../../../_shared/tools/bindings.mjs';
import {execute} from '../../../_shared/tools/process.mjs';

const parent = fs.realpathSync.native(os.tmpdir());
const groups = {cf:'cli',wrangler:'wrangler'};
function write(root,name,text) {
  const file = path.join(root,name);
  fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text);
}
async function fixture(run) {
  const work = fs.mkdtempSync(path.join(parent,'swban-cloudflare-'));
  try {
    const skill = path.join(work,'skill with spaces 树'),site = path.join(work,'site');
    fs.cpSync(skillRoot,skill,{recursive:true,filter:file=>!['.tools','node_modules'].includes(path.basename(file))});
    fs.mkdirSync(site);
    const env = {...Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toLowerCase()!=='path')),PATH:'',CLOUDFLARE_API_TOKEN:'fixture-token',
      PSModulePath:path.join(process.env.SystemRoot || '', 'System32/WindowsPowerShell/v1.0/Modules')};
    const cli = (command,args=[],cold=false) => {
      const executable = cold ? path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe') : process.execPath;
      const entry = cold ? ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(skill,'bootstrap/windows.ps1')]
        : [path.join(skill,'tasks/_cli/main.mjs')];
      const result = spawnSync(executable,[...entry,command,...args],{cwd:site,env,encoding:'utf8',timeout:15000,windowsHide:true});
      assert.ifError(result.error); return result;
    };
    await run({work,skill,site,env,cli});
  } finally {
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);
    assert.ok(path.basename(work).startsWith('swban-cloudflare-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
}

test('Cloudflare metadata help, cold checks and invalid ensures never prepare tools or packages',()=>fixture(async({skill,cli})=>{
  for (const cold of process.platform === 'win32' ? [false,true] : [false]) {
    for (const group of Object.values(groups)) {
      const command = 'deploy/cloudflare/'+group;
      for (const suffix of ['', '/ensure','/check']) {
        const result = cli('help/en',[command+suffix],cold);
        assert.equal(result.status,0,result.stderr); assert.ok(result.stdout.includes('swban '+command+suffix));
      }
      for (const suffix of ['/ensure','/check']) {
        const result = cli(command+suffix,['--help'],cold);
        assert.equal(result.status,0,result.stderr); assert.ok(result.stdout.includes('swban '+command+suffix));
      }
      const missing = cli(command+'/check',[],cold);
      assert.equal(missing.status,1,missing.stdout+missing.stderr);
      assert.match(missing.stderr,cold ? /runtime_not_ready|deploy\/cloudflare\/.+\/ensure/ : /deploy\/cloudflare\/.+\/ensure/);
      for (const args of [['--unknown'],['--force','--force']]) {
        const invalid = cli(command+'/ensure',args,cold);
        assert.equal(invalid.status,1); assert.match(invalid.stderr,/invalid_ensure_arguments/);
      }
      assert.equal(fs.existsSync(path.join(skill,'tasks/deploy/cloudflare',group,'node_modules')),false);
      assert.equal(fs.existsSync(path.join(skill,'.tools')),false);
    }
    const setup = cli('deploy/cloudflare/auth/setup',['--help'],cold);
    assert.equal(setup.status,0,setup.stderr);assert.match(setup.stdout,/API Token/);
    const help = cli('help/en',['deploy/cloudflare','2'],cold);
    assert.equal(help.status,0,help.stderr);
    for (const group of Object.values(groups)) for (const suffix of ['', '/ensure','/check'])
      assert.ok(help.stdout.includes('deploy/cloudflare/'+group+suffix),help.stdout);
    const absent = cli('deploy/cloudflare/pages/publish',[],cold);
    assert.equal(absent.status,1); assert.match(absent.stderr,/unknown_command:deploy\/cloudflare\/pages\/publish/);
  }
}));

test('closing Windows authorization kills the CLI wrapper and its child process',{skip:process.platform!=='win32',timeout:15000},()=>fixture(async({work})=>{
  const marker = path.join(work,'login-processes.json'),controller = new AbortController();
  const source = `const {spawn}=require('node:child_process');
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
require('node:fs').writeFileSync(process.argv[1],JSON.stringify([process.pid,child.pid]));
setInterval(()=>{},1000);`;
  const running = execute(process.execPath,['-e',source,marker],{signal:controller.signal,stdio:'ignore'});
  try {
    for (let count=0;count<200&&!fs.existsSync(marker);count++) await setTimeout(10);
    assert.ok(fs.existsSync(marker));
    const pids = JSON.parse(fs.readFileSync(marker));
    controller.abort();assert.notEqual(await running,0);
    for (const pid of pids) {
      for (let count=0;count<200;count++) {
        try {process.kill(pid,0);} catch {break;}
        await setTimeout(10);
      }
      assert.throws(()=>process.kill(pid,0));
    }
  } finally {controller.abort();await running;}
}));

test('authorization preparation runs only the selected tool ensure and supports cancellation',()=>fixture(async({work,skill,env})=>{
  const tools={cf:'cloudflare/cli',wrangler:'cloudflare/wrangler',tccli:'tencent/cli'};
  for(const [tool,directory] of Object.entries(tools))write(skill,'tasks/deploy/'+directory+'/ensure/entry.mjs',
    `console.log(JSON.stringify({tool:${JSON.stringify(tool)},args:process.argv.slice(2)}));`);
  const entry=path.join(work,'prepare.mjs');
  write(work,'prepare.mjs',`import {prepare} from ${JSON.stringify(pathToFileURL(path.join(skill,'tasks/deploy/auth/login.mjs')).href)};
const controller=new AbortController();if(process.argv[3]==='abort')controller.abort();
try{await prepare(process.argv[2],{signal:controller.signal});}catch(error){console.error(error.message);process.exitCode=1;}`);
  for(const tool of Object.keys(tools)) {
    const result=spawnSync(process.execPath,[entry,tool],{env,encoding:'utf8',timeout:5000,windowsHide:true});
    assert.ifError(result.error);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'');
    assert.deepEqual(JSON.parse(result.stderr),{tool,args:[]});
  }
  for(const [tool,mode,message] of [['node','','invalid_login_tool'],['tccli','abort','abort']]) {
    const result=spawnSync(process.execPath,[entry,tool,mode],{env,encoding:'utf8',timeout:5000,windowsHide:true});
    assert.ifError(result.error);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,new RegExp(message,'i'));
  }
}));

const fakeCli = `const path=require('node:path');
const fs=require('node:fs');
const name=require('../package.json').name;
if(name==='cf'&&process.env.CF_DELEGATION!=='1'){
  const local=require.resolve('cf',{paths:[process.cwd()]});
  if(local!==__filename){require(local);return;}
}
const args=process.argv.slice(2);
console.log(JSON.stringify({name,args,cwd:process.cwd(),executable:process.execPath,
  path:process.env.PATH??process.env.Path,token:process.env.CLOUDFLARE_API_TOKEN,delegation:process.env.CF_DELEGATION,
  key:process.env.CLOUDFLARE_API_KEY,email:process.env.CLOUDFLARE_EMAIL,keyring:process.env.CLOUDFLARE_AUTH_USE_KEYRING,prefix:process.env.npm_config_prefix}));
console.error('fixture-stderr:'+name);
if(args[0]==='exit')process.exit(Number(args[1]));
`;
const fakeNpm = `import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),manifest=JSON.parse(fs.readFileSync('package.json'));
console.log('fixture npm install output');
fs.appendFileSync('.installs.jsonl',JSON.stringify(process.argv.slice(2))+'\\n');
for(const [name,version]of Object.entries(manifest.dependencies)){
  const directory=path.join(root,'node_modules',name);
  const bin=name==='cf'?'bin/cf':'bin/wrangler.js';
  fs.mkdirSync(path.dirname(path.join(directory,bin)),{recursive:true});
  fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name,version,type:'commonjs',main:bin,bin:{[name]:bin}}));
  fs.writeFileSync(path.join(directory,bin),${JSON.stringify(fakeCli)});
}
`;
function prepareNpm(work,skill) {
  const npm = path.join(work,'npm');
  write(npm,'package.json','{"type":"module"}'); write(npm,'npm-cli.js',fakeNpm);
  writeBindings({schema:'swaw-banyan.bindings/v1',runtime:'node',tools:{
    node:{source:'path',path:process.execPath,version:process.versions.node,npmDirectory:npm}
  }},path.join(skill,'.tools'));
}
function installations(skill,group) {
  const file = path.join(skill,'tasks/deploy/cloudflare',group,'.installs.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse) : [];
}

test('Cloudflare commands prepare pinned groups and forward native arguments, working directory, streams and exit codes',()=>fixture(async({work,skill,site,env,cli})=>{
  prepareNpm(work,skill);
  env.cloudflare_auth_use_keyring='false';env.NPM_CONFIG_PREFIX='fixture-unrelated-prefix';
  write(site,'node_modules/cf/package.json','{"name":"cf","version":"99.0.0","main":"bin/cf"}');
  write(site,'node_modules/cf/bin/cf','console.log("parent-cf-must-not-run");process.exit(88);');
  for (const [name,group] of Object.entries(groups)) {
    const command = 'deploy/cloudflare/'+group;
    const root = path.join(skill,'tasks/deploy/cloudflare',group);
    const first = cli(command,['--version']);
    assert.equal(first.status,0,first.stdout+first.stderr);
    assert.deepEqual(JSON.parse(first.stdout).args,['--version']);
    assert.match(first.stderr,/fixture npm install output/);
    const ensured = cli(command+'/ensure');
    assert.equal(ensured.status,0,ensured.stdout+ensured.stderr);
    assert.equal(JSON.parse(ensured.stdout).version,JSON.parse(fs.readFileSync(path.join(root,'package.json'))).dependencies[name]);
    assert.equal(installations(skill,group).length,1);
    assert.deepEqual(installations(skill,group)[0],['ci','--prefix='+root,'--workspaces=false','--ignore-scripts','--no-audit','--no-fund']);
    assert.equal(cli(command+'/ensure').status,0);
    assert.equal(installations(skill,group).length,1);
    for (const cold of process.platform === 'win32' ? [false,true] : [false]) {
      const help = cli(command,['--help'],cold);
      assert.equal(help.status,0,help.stdout+help.stderr);
      assert.deepEqual(JSON.parse(help.stdout).args,['--help']);
    }
    const args = ['--help','tree 树','','--scope','account:read'];
    const native = cli(command,args);
    assert.equal(native.status,0,native.stdout+native.stderr);
    const info = JSON.parse(native.stdout);
    assert.equal(info.name,name); assert.deepEqual(info.args,args);
    assert.equal(info.cwd,fs.realpathSync.native(site));
    assert.equal(fs.realpathSync.native(info.executable),fs.realpathSync.native(process.execPath));
    assert.equal(info.path.split(path.delimiter)[0],path.dirname(process.execPath));
    assert.equal(info.token,'fixture-token');
    if (name === 'cf') {assert.equal(info.delegation,'1');assert.equal(info.keyring,'true');}
    if (process.platform==='win32') assert.equal(info.prefix,root+path.sep);
    assert.equal(native.stderr.trim(),'fixture-stderr:'+name);
    const exit = cli(command,['exit','17']);
    assert.equal(exit.status,17,exit.stdout+exit.stderr);
    assert.equal(cli(command+'/check').status,0);
    assert.equal(installations(skill,group).length,1);
    const forced = cli(command+'/ensure',['--force']);
    assert.equal(forced.status,0,forced.stdout+forced.stderr);
    assert.equal(JSON.parse(forced.stdout).tool,name); assert.match(forced.stderr,/fixture npm install output/);
    assert.equal(installations(skill,group).length,2);
  }
  assert.equal(fs.existsSync(path.join(skill,'node_modules')),false);
  assert.deepEqual(fs.readdirSync(site),['node_modules']);
}));

test('page login prepares native tools, strips API credentials and requires keyring protection for both Cloudflare tools',()=>fixture(async({work,skill,site,env})=>{
  prepareNpm(work,skill);
  const entry = path.join(work,'page-login.mjs');
  write(work,'page-login.mjs',`import {login} from ${JSON.stringify(pathToFileURL(path.join(skill,'tasks/deploy/auth/login.mjs')).href)};
await login(process.argv[2]);`);
  const environment = {...env,CLOUDFLARE_API_KEY:'fixture-api-key',CLOUDFLARE_EMAIL:'fixture-email',cloudflare_api_token:'fixture-lowercase-token',
    cloudflare_auth_use_keyring:'false',NPM_CONFIG_PREFIX:'fixture-unrelated-prefix'};
  for (const [tool,args] of [['cf',['auth','login']],['wrangler',['login','--use-keyring']]]) {
    const result = spawnSync(process.execPath,[entry,tool],{cwd:site,env:environment,encoding:'utf8',timeout:15000,windowsHide:true});
    assert.ifError(result.error);assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'');
    const record = JSON.parse(result.stderr.split(/\r?\n/).find(line=>line.startsWith('{"name":')));
    assert.deepEqual(record.args,args);assert.equal(record.token,undefined);assert.equal(record.key,undefined);assert.equal(record.email,undefined);
    assert.equal(record.keyring,'true');
    if (process.platform==='win32') assert.equal(record.prefix,path.join(skill,'tasks/deploy/cloudflare',groups[tool])+path.sep);
    if (tool==='cf') assert.equal(record.delegation,'1');
    assert.equal(installations(skill,groups[tool]).length,1);
  }
  const invalid = spawnSync(process.execPath,[entry,'node'],{cwd:site,env:environment,encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/invalid_login_tool/);
}));

test('Cloudflare checks do not require Node bindings, execute package code or repair damaged entries',()=>fixture(async({work,skill,cli})=>{
  prepareNpm(work,skill);
  for (const [name,group] of Object.entries(groups)) {
    const ensured = cli('deploy/cloudflare/'+group+'/ensure');
    assert.equal(ensured.status,0,ensured.stdout+ensured.stderr);
    assert.equal(JSON.parse(ensured.stdout).tool,name); assert.match(ensured.stderr,/fixture npm install output/);
  }
  fs.rmSync(path.join(skill,'.tools'),{recursive:true,force:true});
  const {inspectCli} = await import(pathToFileURL(path.join(skill,'tasks/deploy/cloudflare/_shared/runtime.mjs')).href);
  for (const [name,group] of Object.entries(groups)) {
    const record = inspectCli(name),entry = fs.readFileSync(record.path);
    fs.writeFileSync(record.path,'throw new Error("check must not execute package code");');
    const checked = cli('deploy/cloudflare/'+group+'/check');
    assert.equal(checked.status,0,checked.stdout+checked.stderr);
    assert.equal(JSON.parse(checked.stdout).version,record.version);
    assert.equal(fs.existsSync(path.join(skill,'.tools')),false);
    fs.unlinkSync(record.path);
    const damaged = cli('deploy/cloudflare/'+group+'/check');
    assert.equal(damaged.status,1); assert.match(damaged.stderr,/deploy\/cloudflare\/.+\/ensure/);
    assert.equal(fs.existsSync(record.path),false); assert.equal(installations(skill,group).length,1);
    fs.writeFileSync(record.path,entry);
  }
}));

test('native entries load a manually added default Token while local checks and OAuth remain independent',()=>fixture(async({work,skill,env,cli})=>{
  prepareNpm(work,skill);
  delete env.CLOUDFLARE_API_TOKEN;
  write(skill,'tasks/deploy/_shared/credential.ps1',`param([string]$Action,[string]$Target)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
if ($Target -ne 'swban/cloudflare/default') {exit 2}
Add-Content -LiteralPath (Join-Path $PSScriptRoot 'fixture-calls.txt') -Value $Action
if ($Action -eq 'read') {[Console]::WriteLine('{"secret":"manual-fixture-token","userName":"${'a'.repeat(32)}"}')}
else {[Console]::WriteLine('{"userName":"${'a'.repeat(32)}"}')}
`);
  const bridge = path.join(skill,'tasks/deploy/_shared/fixture-calls.txt');
  for (const group of Object.values(groups)) {
    for (const args of [['zones','list'],group === 'cli' ? ['auth','whoami'] : ['whoami']]) {
      const result = cli('deploy/cloudflare/'+group,args);
      assert.equal(result.status,0,result.stdout+result.stderr);
      assert.equal(JSON.parse(result.stdout).token,'manual-fixture-token');
    }
  }
  assert.deepEqual(fs.readFileSync(bridge,'utf8').trim().split(/\r?\n/),['read','read','read','read']);
  fs.rmSync(path.join(skill,'.tools'),{recursive:true,force:true});
  const checked = cli('deploy/cloudflare/auth/token/check');
  assert.equal(checked.status,0,checked.stdout+checked.stderr);
  assert.deepEqual(JSON.parse(checked.stdout),{target:'swban/cloudflare/default',present:true,accountId:'a'.repeat(32)});
  assert.equal(fs.existsSync(path.join(skill,'.tools')),false);
  prepareNpm(work,skill);
  for (const [group,args] of [['cli',['auth','login']],['wrangler',['login','--use-keyring']]]) {
    const result = cli('deploy/cloudflare/'+group,args);
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.equal(JSON.parse(result.stdout).token,undefined);
  }
  assert.deepEqual(fs.readFileSync(bridge,'utf8').trim().split(/\r?\n/),['read','read','read','read','check']);
}));
