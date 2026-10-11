import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {zip} from './fixtures/zip.mjs';
import {readRelease,moduleFromGraph,assess,inspect} from '../.agents/skills/swaw-banyan/tasks/check/module/inspect.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {hugoEnvironment} from '../.agents/skills/swaw-banyan/scripts.js/hugo/index.mjs';

const repository = fileURLToPath(new URL('../',import.meta.url));
const skill = path.join(repository,'.agents/skills/swaw-banyan');
const entry = path.join(skill,'tasks/check/module/entry.mjs');
const release = readRelease(), expected = 'v'+release.version;
const different = expected === 'v0.2.0' ? 'v0.3.0' : 'v0.2.0';
const parent = fs.realpathSync(os.tmpdir());
let work,sequence = 0,previous;
function write(file,value) { fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,value); }
function proxyModule(module,version) {
  const escaped = module.replace(/[A-Z]/g,char => '!'+char.toLowerCase());
  const prefix = path.join(work,'proxy',escaped,'@v',version);
  const mod = `module ${module}\n\ngo 1.18\n`;
  write(prefix+'.mod',mod);
  write(prefix+'.info',JSON.stringify({Version:version,Time:'2026-01-01T00:00:00Z'}));
  write(prefix+'.zip',zip([
    {name:`${module}@${version}/go.mod`,bytes:Buffer.from(mod)},
    {name:`${module}@${version}/layouts/index.html`,bytes:Buffer.from('fixture')}
  ]));
}
function site({version=expected,replacement='',imported=true,disabled=false}={}) {
  const root = path.join(work,'site '+(++sequence));
  write(path.join(root,'hugo.toml'),'baseURL = "https://example.test/"\n'+(imported
    ? `[[module.imports]]\npath = "${release.module}"\ndisable = ${disabled}\n` : ''));
  write(path.join(root,'go.mod'),`module example.test/site\n\ngo 1.18\n\nrequire ${release.module} ${version}\n`+
    (replacement ? `replace ${release.module} => ${replacement}\n` : ''));
  return root;
}
function cli(root,args=[]) {
  const result = spawnSync(process.execPath,[entry,...args],{cwd:root,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);
  return result;
}
function hugo(root,args) {
  const result = spawnSync(toolExecutable('hugo'),args,{cwd:root,env:hugoEnvironment(),encoding:'utf8',timeout:30000});
  assert.ifError(result.error);
  assert.equal(result.status,0,result.stdout+result.stderr);
  return result.stdout;
}
before(() => {
  work = fs.mkdtempSync(path.join(parent,'banyan-module-'));
  const settings = {HUGO_CACHEDIR:path.join(work,'cache'),HUGO_RESOURCEDIR:path.join(work,'resources'),
    HUGO_MODULE_PROXY:pathToFileURL(path.join(work,'proxy')).href,GOSUMDB:'off',
    GOPRIVATE:'',GONOPROXY:'',GONOSUMDB:'',GIT_OPTIONAL_LOCKS:'0'};
  previous = Object.fromEntries(Object.keys(settings).map(key => [key,process.env[key]]));
  Object.assign(process.env,settings);
  for (const version of [expected,different]) proxyModule(release.module,version);
  proxyModule('example.test/fork/module',expected);
});
after(() => {
  for (const [key,value] of Object.entries(previous ?? {})) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  if (work) {
    assert.equal(path.dirname(fs.realpathSync(work)),parent);
    assert.ok(path.basename(work).startsWith('banyan-module-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
});

test('metadata is the single release source and rejects malformed or duplicated values',() => {
  assert.equal(release.module,'github.com/SwawHQ/banyan/module');
  const root = path.join(work,'metadata');
  for (const body of ['metadata:\n  version: 0.1\n  module: x/module',
    'metadata:\n  version: "v0.1.0"\n  module: x/module',
    'metadata:\n  version: "0.1.0"\n  version: "0.2.0"\n  module: x/module']) {
    write(path.join(root,'SKILL.md'),'---\n'+body+'\n---\n');
    assert.throws(() => readRelease(root));
  }
  write(path.join(root,'SKILL.md'),'---\nmetadata:\n  version: "1.0.0-rc.1"\n  module: example.test/module\n---\n');
  assert.equal(readRelease(root).version,'1.0.0-rc.1');
});

test('real Hugo resolves a pinned version and CLI reports matching versions',() => {
  const root = site(), result = inspect(root);
  assert.equal(result.state,'matched');
  assert.equal(result.module.version,expected);
  const command = cli(root);
  assert.equal(command.status,0,command.stdout+command.stderr);
  assert.match(command.stdout,/Pairing: matched/);
});

test('mismatch fails without changing the requested dependency',() => {
  const root = site({version:different}), mod = fs.readFileSync(path.join(root,'go.mod'),'utf8');
  const command = cli(work,[root]);
  assert.equal(command.status,1,command.stdout+command.stderr);
  assert.ok(command.stderr.includes(different));
  assert.ok(command.stderr.includes(expected));
  assert.equal(fs.readFileSync(path.join(root,'go.mod'),'utf8'),mod);
});

test('remote replacements use the effective version and reject another module identity',() => {
  const root = site({replacement:`${release.module} ${different}`});
  assert.equal(inspect(root).module.version,different);
  assert.equal(inspect(root).state,'mismatch');
  const fork = inspect(site({replacement:`example.test/fork/module ${expected}`}));
  assert.equal(fork.module.path,'example.test/fork/module');
  assert.equal(fork.state,'mismatch');
});

test('actual hugo mod vendor remains authoritative after go.mod changes',() => {
  const root = site();
  hugo(root,['mod','vendor','--noBuildLock']);
  const mod = path.join(root,'go.mod');
  write(mod,fs.readFileSync(mod,'utf8').replace(expected,different));
  const result = inspect(root);
  assert.equal(result.module.vendored,true);
  assert.equal(result.module.version,expected);
  assert.equal(result.state,'matched');
  const list = path.join(root,'_vendor/modules.txt');
  write(list,fs.readFileSync(list,'utf8').replace(expected,different));
  assert.equal(inspect(root).state,'mismatch');
  assert.equal(cli(root).status,1);
});

test('same checkout is development, including a Skill junction; another local copy is unverified',() => {
  const root = site({replacement:JSON.stringify(path.join(repository,'module').replaceAll('\\','/'))});
  const result = inspect(root);
  assert.equal(result.state,'development');
  assert.equal(cli(root).status,0);
  const link = path.join(work,'skill link');
  fs.symlinkSync(skill,link,process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(assess(result.module,release,{root:link,site:root}).state,'development');
  const local = path.join(work,'module with spaces @ local');
  write(path.join(local,'go.mod'),`module ${release.module}\ngo 1.18\n`);
  const external = site({replacement:JSON.stringify(local.replaceAll('\\','/'))});
  assert.equal(inspect(external).state,'unverified');
  assert.equal(cli(external).status,1);
});

test('missing or disabled imports do not pass based on go.mod alone',() => {
  for (const root of [site({imported:false}),site({disabled:true})]) {
    assert.equal(inspect(root).state,'missing');
    assert.equal(cli(root).status,1);
  }
});

test('help works without a site; bad arguments and resolution errors fail',() => {
  for (const flag of ['--help','-h']) {
    const result = cli(work,[flag]);
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/swban check\/module/);
  }
  assert.equal(cli(work,['--unknown']).status,1);
  assert.equal(cli(work,['one','two']).status,1);
  const broken = site({replacement:'./does-not-exist'});
  const failure = cli(broken);
  assert.equal(failure.status,1);
  assert.doesNotMatch(failure.stdout,/Pairing: matched/);
});

test('unversioned, pseudo-version and conflicting graph entries cannot masquerade as release pairs',() => {
  const local = moduleFromGraph(`site ${release.module}@${expected} => C:\\dev\\module@v0.1.0`,release.module);
  assert.equal(local.directory,'C:\\dev\\module@v0.1.0');
  for (const suffix of ['', '@v0.0.0-20260101000000-abcdefabcdef']) {
    assert.equal(assess(moduleFromGraph('site '+release.module+suffix,release.module),release).state,'mismatch');
  }
  assert.throws(() => moduleFromGraph(`site ${release.module}@${expected}\nsite ${release.module}@${different}`,release.module),/multiple/);
});
