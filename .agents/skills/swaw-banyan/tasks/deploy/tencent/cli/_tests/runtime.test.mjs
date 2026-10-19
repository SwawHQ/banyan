import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess,{spawnSync} from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {pathToFileURL} from 'node:url';
import https from 'node:https';
import {X509Certificate} from 'node:crypto';
import {skillRoot,definition} from '../../../../_shared/tools/manifest.mjs';
import {writeBindings} from '../../../../_shared/tools/bindings.mjs';
import {inspectCli} from '../runtime.mjs';

const version = fs.readFileSync(new URL('../requirements.txt',import.meta.url),'utf8').trim().split('==')[1];
function write(root,name,text) {
  const file = path.join(root,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);
}
function installation(root) {
  const home = path.join(root,'python-tools/tccli'),base = path.join(root,'python/cpython-3.13');
  write(base,'python.exe','managed Python fixture');
  write(home,'Scripts/python.exe','tool Python fixture');write(home,'Scripts/tccli.exe','CLI fixture');
  write(home,'Lib/site-packages/tccli/main.py','raise RuntimeError("checks must not execute package code")');
  write(home,'Lib/site-packages/tccli-'+version+'.dist-info/METADATA','Name: tccli\nVersion: '+version+'\n');
  write(home,'pyvenv.cfg','home = '+base+'\nversion_info = 3.13.12\ninclude-system-site-packages = false\n');
  return {home,base,executable:path.join(home,'Scripts/tccli.exe')};
}
async function fixture(run) {
  const parent = fs.realpathSync.native(os.tmpdir()),work = fs.mkdtempSync(path.join(parent,'swban-tencent-'));
  try {
    const skill = path.join(work,'skill 树'),site = path.join(work,'site'),root = path.join(skill,'.tools');
    fs.cpSync(skillRoot,skill,{recursive:true,filter:file=>!['.tools','node_modules'].includes(path.basename(file))});fs.mkdirSync(site);
    const env = {...process.env,PATH:'',PSModulePath:path.join(process.env.SystemRoot || '', 'System32/WindowsPowerShell/v1.0/Modules')};
    const cli = (command,args=[],cold=false)=>{
      const executable = cold ? path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe') : process.execPath;
      const entry = cold ? ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(skill,'bootstrap/windows.ps1')]
        : [path.join(skill,'tasks/_cli/main.mjs')];
      const result = spawnSync(executable,[...entry,command,...args],{cwd:site,env,encoding:'utf8',timeout:15000,windowsHide:true});
      assert.ifError(result.error);return result;
    };
    await run({work,skill,site,root,cli});
  } finally {
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);assert.ok(path.basename(work).startsWith('swban-tencent-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
}

test('Tencent metadata help, cold checks and invalid ensures never prepare tools',()=>fixture(async({root,cli})=>{
  for (const cold of process.platform==='win32' ? [false,true] : [false]) {
    for (const suffix of ['', '/ensure','/check']) {
      const command = 'deploy/tencent/cli'+suffix;
      const help = cli('help/en',[command],cold);
      assert.equal(help.status,0,help.stderr);assert.ok(help.stdout.includes('swban '+command));
      if (suffix) assert.equal(cli(command,['--help'],cold).status,0);
    }
    const missing = cli('deploy/tencent/cli/check',[],cold);
    assert.equal(missing.status,1);assert.match(missing.stderr,cold ? /runtime_not_ready|tccli_installation_unusable/ : /tccli_installation_unusable/);
    for (const args of [['--unknown'],['--force','--force']]) {
      const invalid = cli('deploy/tencent/cli/ensure',args,cold);
      assert.equal(invalid.status,1);assert.match(invalid.stderr,/invalid_ensure_arguments/);
    }
    const listed = cli('help/en',['deploy/tencent','2'],cold);
    assert.equal(listed.status,0,listed.stderr);
    for (const suffix of ['', '/check','/ensure']) assert.ok(listed.stdout.includes('deploy/tencent/cli'+suffix));
    assert.equal(fs.existsSync(root),false);
  }
}));

const toolPython = path.join(skillRoot,'.tools/python-tools/tccli/Scripts/python.exe');
test('Tencent key checks report absence as failure without preparing tools or reading secrets',()=>fixture(async({skill,root,cli})=>{
  const bridge = path.join(skill,'tasks/deploy/_shared/credential.ps1');
  for (const record of [null,{userName:'fixture-secret-id'}]) {
    fs.writeFileSync(bridge,`param([string]$Action,[string]$Target)
if ($Action -ne 'check' -or $Target -ne 'swban/tencent/default') {exit 2}
[Console]::WriteLine('${JSON.stringify(record)}')
`);
    const result = cli('deploy/tencent/auth/key/check');
    assert.equal(result.status,record?0:1,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),{target:'swban/tencent/default',present:!!record});
    assert.equal(result.stderr,'');
  }
  fs.writeFileSync(bridge,'exit 2');
  const failed = cli('deploy/tencent/auth/key/check');
  assert.equal(failed.status,1);assert.match(failed.stderr,/credential_store_failed/);assert.equal(failed.stdout,'');
  const help = cli('deploy/tencent/auth/key/check',['--help']);
  assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/swban deploy\/tencent\/auth\/key\/check/);
  const invalid = cli('deploy/tencent/auth/key/check',['--unexpected']);
  assert.equal(invalid.status,1);assert.match(invalid.stderr,/unexpected_arguments/);
  assert.equal(fs.existsSync(root),false);
}));

test('tccli OAuth acquisition and refresh reject untrusted TLS and accept an explicit CA',
  {skip:process.platform !== 'win32' || !fs.existsSync(toolPython)},async()=>{
  const parent = fs.realpathSync.native(os.tmpdir()),work = fs.mkdtempSync(path.join(parent,'swban-tencent-tls-'));
  const certificate = spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile','-NonInteractive','-Command',`
$ErrorActionPreference='Stop'
$rsa=[System.Security.Cryptography.RSA]::Create(2048)
$request=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost',$rsa,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$san=[System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddIpAddress([System.Net.IPAddress]::Loopback)
$request.CertificateExtensions.Add($san.Build())
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true))
$cert=$request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1),[DateTimeOffset]::UtcNow.AddHours(1))
@{pfx=[Convert]::ToBase64String($cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx));cert=[Convert]::ToBase64String($cert.RawData)}|ConvertTo-Json -Compress
$cert.Dispose();$rsa.Dispose()`],{encoding:'utf8',timeout:10000,windowsHide:true});
  let server;
  try {
    assert.ifError(certificate.error);assert.equal(certificate.status,0,certificate.stderr);
    const pair = JSON.parse(certificate.stdout),ca = path.join(work,'ca.pem');
    fs.writeFileSync(ca,new X509Certificate(Buffer.from(pair.cert,'base64')).toString());
    let requests = 0;
    server = https.createServer({pfx:Buffer.from(pair.pfx,'base64')},(req,res)=>{
      requests++;req.resume();res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({SecretId:'fixture-id',SecretKey:'fixture-key',Token:'fixture-token',AccessToken:'fixture-access',ExpiresAt:9999999999}));
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const script = `import runpy, sys
import requests
from tccli import main, oauth
launcher, oauth._API_ENDPOINT, expected = sys.argv[1:]
def exercise():
    for function, args in [(oauth.get_temp_cred, ('fixture-access', 'cn')), (oauth.refresh_user_token, ('fixture-refresh', 'fixture-id', 'cn'))]:
        try:
            function(*args)
        except requests.exceptions.SSLError:
            assert expected == 'reject'
        else:
            assert expected == 'accept', 'OAuth accepted an untrusted certificate'
    return 17
main.main = exercise
runpy.run_path(launcher, run_name='__main__')`;
    for (const trusted of [false,true]) {
      const env = Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|REQUESTS_CA_BUNDLE|CURL_CA_BUNDLE)$/i.test(key)));
      Object.assign(env,{USERPROFILE:work,HOME:work,NO_PROXY:'127.0.0.1'});
      if (trusted) env.REQUESTS_CA_BUNDLE = ca;
      const result = await new Promise((resolve,reject)=>{
        const child = childProcess.spawn(toolPython,['-I','-B','-X','utf8','-c',script,
          path.join(skillRoot,'tasks/deploy/tencent/cli/cli.py'),'https://127.0.0.1:'+server.address().port,trusted?'accept':'reject'],
          {env,encoding:'utf8',timeout:10000,windowsHide:true,stdio:['ignore','pipe','pipe']});
        let output = '';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
        child.once('error',reject);child.once('close',code=>resolve({code,output}));
      });
      assert.equal(result.code,17,result.output);assert.equal(requests,trusted?2:0);
    }
  } finally {
    if (server) await new Promise(resolve=>server.close(resolve));
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);
    fs.rmSync(work,{recursive:true,force:true});
  }
});

test('Tencent checks inspect local metadata and Python ownership without executing or repairing files',()=>fixture(async({root,cli})=>{
  const {home,base,executable} = installation(root);
  write(root,'bindings.json','invalid bindings must not be read by checks');
  assert.deepEqual(inspectCli({root}),{tool:'tccli',version,path:executable});
  const checked = cli('deploy/tencent/cli/check');
  assert.equal(checked.status,0,checked.stderr);assert.equal(JSON.parse(checked.stdout).version,version);
  assert.equal(fs.existsSync(path.join(root,'.cache')),false);
  const metadata = path.join(home,'Lib/site-packages/tccli-'+version+'.dist-info/METADATA');
  const config = path.join(home,'pyvenv.cfg'),metadataText = fs.readFileSync(metadata),configText = fs.readFileSync(config);
  const alias = path.join(root,'python/cpython-3.13-alias');
  fs.symlinkSync(base,alias,'junction');
  fs.writeFileSync(config,configText.toString().replace(base,alias));
  assert.equal(inspectCli({root}).version,version);
  const escaped = path.join(root,'python/outside');
  fs.symlinkSync(path.dirname(root),escaped,'junction');
  fs.writeFileSync(config,configText.toString().replace(base,escaped));
  assert.throws(()=>inspectCli({root}),/tccli_installation_unusable/);
  fs.writeFileSync(config,configText);
  for (const [file,text] of [[metadata,'Name: tccli\nVersion: 0.0.0\n'],[config,'home = '+base+'\nversion_info = 3.9.1\n'],
    [config,'home = '+path.dirname(root)+'\nversion_info = 3.13.12\ninclude-system-site-packages = false\n']]) {
    fs.writeFileSync(file,text);assert.throws(()=>inspectCli({root}),/tccli_installation_unusable/);
    assert.equal(cli('deploy/tencent/cli/check').status,1);assert.equal(fs.readFileSync(file,'utf8'),text);
    fs.writeFileSync(metadata,metadataText);fs.writeFileSync(config,configText);
  }
  fs.unlinkSync(executable);assert.throws(()=>inspectCli({root}),/tccli_installation_unusable/);
  assert.equal(fs.existsSync(executable),false);assert.equal(fs.existsSync(path.join(root,'.cache')),false);
}));

test('Tencent preparation reuses isolation, repairs damage and forwards native arguments and exit codes',async t=>fixture(async({work,skill,site,root})=>{
  const uv = path.join(work,'uv.exe'),native = path.join(root,'python-tools/tccli/Scripts/tccli.exe');
  const python = path.join(path.dirname(native),'python.exe'),launcher = path.join(skill,'tasks/deploy/tencent/cli/cli.py');
  write(work,'uv.exe','uv fixture');
  const uvVersion = definition('uv').version;
  writeBindings({schema:'swaw-banyan.bindings/v1',tools:{uv:{source:'path',path:uv,version:uvVersion}}},root);
  const originalSpawn = childProcess.spawn,originalCwd = process.cwd(),calls = [];
  const variables = {TENCENTCLOUD_SECRET_ID:'fixture-id',TENCENTCLOUD_SECRET_KEY:'fixture-key',UV_CONFIG_FILE:path.join(site,'uv.toml'),PYTHONPATH:site};
  const saved = Object.fromEntries(Object.keys(variables).map(key=>[key,process.env[key]]));
  let installs = 0,failInstall = false;
  const mocked = t.mock.method(childProcess,'spawn',(file,args,options)=>{
    if (file === uv) {
      if (args[0] === '--version') return originalSpawn(process.execPath,['-e',`console.log('uv ${uvVersion}')`],options);
      installs++;assert.deepEqual(args,['tool','install','--quiet','--python','3.13','--reinstall','--force','tccli=='+version]);
      assert.equal(options.env.UV_NO_CONFIG,'1');assert.equal(options.env.UV_CONFIG_FILE,undefined);
      assert.ok(options.env.UV_TOOL_DIR.startsWith(root+path.sep));
      assert.deepEqual(options.stdio,['inherit',2,2]);
      if (!failInstall) installation(root);
      return originalSpawn(process.execPath,['-e','process.exit('+ (failInstall ? 23 : 0)+')'],options);
    }
    if (file === python) {
      assert.deepEqual(args.slice(0,5),['-I','-B','-X','utf8',launcher]);
      args = args.slice(5);
      calls.push({args,options});return originalSpawn(process.execPath,['-e','process.exit('+(args[0]==='exit'?17:0)+')'],options);
    }
    return originalSpawn(file,args,options);
  });
  syncBuiltinESMExports();
  try {
    Object.assign(process.env,variables);process.chdir(site);
    const {prepareCli,runCli} = await import(pathToFileURL(path.join(skill,'tasks/deploy/tencent/cli/runtime.mjs')).href);
    assert.equal((await prepareCli()).action,'installed');assert.equal(installs,1);
    assert.deepEqual((await Promise.all([prepareCli(),prepareCli()])).map(value=>value.action),['reused','reused']);assert.equal(installs,1);
    const args = ['teo','DescribeZones','--cli-input-json','file://input 树.json',''];
    assert.equal(await runCli(args),0);assert.deepEqual(calls[0].args,args);
    assert.equal(calls[0].options.cwd,fs.realpathSync.native(site));assert.equal(calls[0].options.stdio,'inherit');
    assert.equal(calls[0].options.env.TENCENTCLOUD_SECRET_ID,'fixture-id');assert.equal(calls[0].options.env.PYTHONPATH,undefined);
    assert.equal(calls[0].options.env.VIRTUAL_ENV,path.dirname(path.dirname(native)));
    assert.equal(await runCli(['exit']),17);
    const {login} = await import(pathToFileURL(path.join(skill,'tasks/deploy/auth/login.mjs')).href);
    const signal = new AbortController().signal;
    await login('tccli',{signal,environment:{...process.env,TCCLI_PROFILE:'other',TENCENTCLOUD_TOKEN:'fixture-sts',TENCENTCLOUD_ROLE_ARN:'fixture-role',CLOUDFLARE_API_TOKEN:'fixture-cf'}});
    const authorized = calls.at(-1);
    assert.deepEqual(authorized.args,['auth','login','--profile','default']);assert.deepEqual(authorized.options.stdio,['inherit',2,2]);
    for (const key of ['TENCENTCLOUD_SECRET_ID','TENCENTCLOUD_SECRET_KEY','TENCENTCLOUD_TOKEN','TCCLI_PROFILE','TENCENTCLOUD_ROLE_ARN','CLOUDFLARE_API_TOKEN']) assert.equal(authorized.options.env[key],undefined);
    const controller = new AbortController();controller.abort();
    const before = calls.length;await assert.rejects(runCli(['auth','login'],{signal:controller.signal}),/abort/i);assert.equal(calls.length,before);
    assert.equal((await prepareCli({force:true})).action,'installed');assert.equal(installs,2);
    fs.unlinkSync(native);assert.equal((await prepareCli()).action,'installed');assert.equal(installs,3);
    failInstall = true;await assert.rejects(prepareCli({force:true}),/tccli_installation_failed:23/);
    assert.equal(inspectCli({root}).version,version);assert.equal(fs.existsSync(path.join(root,'.cache/install.lock')),false);
  } finally {
    mocked.mock.restore();syncBuiltinESMExports();process.chdir(originalCwd);
    for (const [key,value] of Object.entries(saved)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
}));
