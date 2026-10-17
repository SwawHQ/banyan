import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {zip} from './fixtures/zip.mjs';
import {parse as parseToml} from '../.agents/skills/swaw-banyan/tasks/_shared/_vendor/toml.mjs';
import {readRelease,moduleFromGraph,assess,inspect} from '../.agents/skills/swaw-banyan/tasks/check/banyan/inspect.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/toolchain/operations.mjs';
import {hugoEnvironment} from '../.agents/skills/swaw-banyan/tasks/base/hugo/run.mjs';

const repository = fileURLToPath(new URL('../',import.meta.url));
const skill = path.join(repository,'.agents/skills/swaw-banyan');
const entry = path.join(skill,'tasks/check/banyan/entry.mjs');
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
function themeSite({version=release.version,name='banyan',themesDir='themes',linked=false}={}) {
  const root=path.join(work,'theme site '+(++sequence)),directory=path.join(root,themesDir,name);
  write(path.join(root,'hugo.toml'),'baseURL="https://example.test/"\ntheme='+JSON.stringify(name)+'\nthemesDir='+JSON.stringify(themesDir)+'\n');
  if(linked) {
    fs.mkdirSync(path.dirname(directory),{recursive:true});
    fs.symlinkSync(path.join(repository,'module'),directory,process.platform==='win32'?'junction':'dir');
  } else {
    write(path.join(directory,'theme.toml'),'name="banyan"\n'+(version===null?'':'version='+JSON.stringify(version)+'\n'));
    write(path.join(directory,'layouts/home.html'),'Theme fixture');
  }
  return {root,directory};
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

test('Skill release metadata matches the shipped theme and rejects malformed or duplicated values',() => {
  assert.equal(release.module,'github.com/SwawHQ/banyan/module');
  assert.equal(parseToml(fs.readFileSync(path.join(repository,'module/theme.toml'),'utf8')).version,release.version);
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

test('theme configuration resolves both a versioned Module and a local theme directory',()=>{
  const remote=site({imported:false});
  write(path.join(remote,'hugo.toml'),'baseURL="https://example.test/"\ntheme='+JSON.stringify(release.module)+'\n');
  assert.equal(inspect(remote).state,'matched');
  for(const options of [{},{name:'renamed',themesDir:'theme sources'}]) {
    const {root,directory}=themeSite(options),result=inspect(root);
    assert.equal(result.state,'matched');assert.equal(result.module.kind,'theme');
    assert.equal(result.module.directory,fs.realpathSync(directory));
    assert.equal(cli(root).status,0);
    assert.equal(fs.existsSync(path.join(root,'go.mod')),false);
  }
});

test('theme directory versions detect mismatch and missing metadata without changing the theme',()=>{
  const {root,directory}=themeSite({version:different.slice(1)}),file=path.join(directory,'theme.toml');
  const before=fs.readFileSync(file,'utf8');
  const result=inspect(root);
  assert.equal(result.state,'mismatch');assert.equal(cli(root).status,1);
  assert.match(result.issues.join('\n'),/https:\/\/github.com\/SwawHQ\/banyan\/releases/);
  assert.ok(result.issues[0].includes('/archive/refs/tags/'+expected+'.zip'));
  assert.ok(result.issues[0].includes('module/ from project tag '+expected));
  assert.equal(fs.readFileSync(file,'utf8'),before);
  const missing=themeSite({version:null}).root;
  assert.equal(inspect(missing).state,'unverified');assert.equal(cli(missing).status,1);
  const malformed=themeSite({version:'not-a-version'}).root;
  assert.throws(()=>inspect(malformed),/Invalid Banyan theme version/);
  assert.equal(cli(malformed).status,1);
});

test('a theme linked to this checkout is development and duplicate Banyan themes fail',()=>{
  const linked=themeSite({linked:true}).root;
  assert.equal(inspect(linked).state,'development');assert.equal(cli(linked).status,0);
  const {root}=themeSite();
  write(path.join(root,'themes/another/theme.toml'),'name="banyan"\nversion='+JSON.stringify(release.version)+'\n');
  write(path.join(root,'hugo.toml'),'baseURL="https://example.test/"\ntheme=["banyan","another"]\n');
  assert.throws(()=>inspect(root),/multiple Banyan themes/);
});

test('mismatch fails without changing the requested dependency',() => {
  const root = site({version:different}), mod = fs.readFileSync(path.join(root,'go.mod'),'utf8');
  const command = cli(work,[root]);
  assert.equal(command.status,1,command.stdout+command.stderr);
  assert.ok(command.stderr.includes(different));
  assert.ok(command.stderr.includes(expected));
  assert.ok(command.stderr.includes('swban base/hugo mod get '+release.module+'@'+expected));
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
  assert.match(inspect(root).issues.join('\n'),/then swban base\/hugo mod vendor/);
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
    assert.match(result.stdout,/swban check\/banyan/);
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
