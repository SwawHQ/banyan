import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {current,identify} from '../inspect.mjs';
import {readRelease} from '../../../../_shared/banyan.mjs';
import {toolExecutable} from '../../../../_shared/tools/operations.mjs';
import {hugoEnvironment} from '../../../../base/hugo/run.mjs';
import {gitEnvironment} from '../../../../base/git/environment.mjs';
import {zip} from '../../../../_shared/tools/_tests/fixtures/zip.mjs';
import {help} from '../../../../help/run.mjs';

const release=readRelease(),version='v1.2.3',next='v1.2.4',pseudo='v0.0.0-20260101000000-abcdefabcdef';
const entry=fileURLToPath(new URL('../entry.mjs',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw','banyan','upgrade-version-current');
let work,previous,sequence=0;
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
function run(executable,args,cwd,env) {
  const result=spawnSync(executable,args,{cwd,env,encoding:'utf8',timeout:30000,windowsHide:true});
  assert.ifError(result.error);return result;
}
function git(root,args) {
  const result=run(toolExecutable('git'),args,root,{...gitEnvironment(),GIT_CONFIG_GLOBAL:path.join(work,'empty-config'),GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:'0'});
  assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout.trim();
}
function hugo(root,args) {
  const result=run(toolExecutable('hugo'),[...args,'--noBuildLock'],root,hugoEnvironment());
  assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout;
}
function site({replacement='',required=version}={}) {
  const root=path.join(work,'site '+(++sequence));
  write(path.join(root,'hugo.toml'),'baseURL="https://example.test/"\n[[module.imports]]\npath='+JSON.stringify(release.module)+'\n');
  write(path.join(root,'go.mod'),'module example.test/site\n\ngo 1.18\nrequire '+release.module+' '+required+'\n'+(replacement?'replace '+release.module+' => '+replacement+'\n':''));
  return root;
}
function proxy(module,version) {
  const mod='module '+module+'\n\ngo 1.18\n';
  const prefix=path.join(work,'proxy',module.replace(/[A-Z]/g,char=>'!'+char.toLowerCase()),'@v',version);
  write(prefix+'.mod',mod);write(prefix+'.info',JSON.stringify({Version:version,Time:'2026-01-01T00:00:00Z'}));
  write(prefix+'.zip',zip([{name:module+'@'+version+'/go.mod',bytes:Buffer.from(mod)},
    {name:module+'@'+version+'/layouts/home.html',bytes:Buffer.from('fixture')} ]));
}
function localSource() {
  const root=path.join(work,'source '+(++sequence)),source=path.join(root,'module');
  const remote=path.join(work,'official '+sequence+'.git');
  write(path.join(source,'go.mod'),'module '+release.module+'\n\ngo 1.18\n');
  write(path.join(source,'theme.toml'),'name="banyan"\nversion="0.1.0"\n');
  write(path.join(source,'layouts/home.html'),'original');
  git(work,['init','--bare','--initial-branch=main',remote]);
  officialConfig(root,pathToFileURL(remote).href);
  return {root,source,remote};
}
function officialConfig(root,url) {
  write(path.join(work,'empty-config'),'[safe]\n directory = '+JSON.stringify(root)+'\n[url '+JSON.stringify(url)+']\n insteadOf = '+JSON.stringify('https://'+release.module.replace(/\/module$/,'')+'.git')+'\n');
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'case-'));
  const settings={HUGO_CACHEDIR:path.join(work,'hugo-cache'),GOMODCACHE:path.join(work,'modules'),GOCACHE:path.join(work,'go-cache'),
    GOPROXY:pathToFileURL(path.join(work,'proxy')).href,HUGO_MODULE_PROXY:pathToFileURL(path.join(work,'proxy')).href,
    GOSUMDB:'off',GOPRIVATE:'',GONOPROXY:'',GONOSUMDB:'',GOWORK:'off',GOENV:'off',GIT_CONFIG_GLOBAL:path.join(work,'empty-config'),GIT_CONFIG_NOSYSTEM:'1'};
  previous=Object.fromEntries(Object.keys(settings).map(key=>[key,process.env[key]]));Object.assign(process.env,settings);
  proxy(release.module,version);proxy(release.module,next);proxy(release.module,pseudo);proxy('example.test/fork/module',version);
});
after(()=>{
  for (const [key,value] of Object.entries(previous??{})) if (value===undefined) delete process.env[key]; else process.env[key]=value;
  if (work) {assert.equal(path.dirname(fs.realpathSync(work)),parent);assert.ok(path.basename(work).startsWith('case-'));fs.rmSync(work,{recursive:true,force:true});}
});

test('Hugo resolves published versions and effective remote replacements, without forcing the Skill version',()=>{
  assert.equal(current(site()).old,version);
  assert.equal(current(site({replacement:release.module+' '+next})).old,next);
  assert.equal(current(site({required:pseudo})).old,'abcdefabcdef');
  const fork=current(site({replacement:'example.test/fork/module '+version}));
  assert.equal(fork.old,null);assert.match(fork.source,/example\.test\/fork/);
});
test('vendor remains authoritative after go.mod and vendor source edits',()=>{
  const root=site();hugo(root,['mod','vendor']);
  write(path.join(root,'go.mod'),fs.readFileSync(path.join(root,'go.mod'),'utf8').replace(version,next));
  write(path.join(root,'_vendor',release.module,'layouts/home.html'),'local edit');
  const result=current(root);assert.equal(result.old,version);assert.equal(result.basis,'vendor');
});
test('an official source commit survives uncommitted edits, while local commits remain unknown',()=>{
  const {root,source,remote}=localSource();git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.test']);
  git(root,['add','.']);git(root,['commit','-m','official base']);const base=git(root,['rev-parse','HEAD']);
  git(root,['remote','add','upstream','git@github.com:SwawHQ/banyan.git']);
  git(root,['update-ref','refs/remotes/upstream/main',base]);
  git(root,['push',remote,'HEAD:refs/heads/main']);
  const siteRoot=site({replacement:JSON.stringify(source.replaceAll('\\','/'))});
  assert.deepEqual(current(siteRoot),{old:base,source:fs.realpathSync(source),basis:'git',modified:false});
  write(path.join(source,'layouts/home.html'),'local edit');
  assert.equal(current(siteRoot).old,base);assert.equal(current(siteRoot).modified,true);
  git(root,['add','.']);git(root,['commit','-m','local customization']);
  const customized=current(siteRoot);assert.equal(customized.old,null);
  assert.match(customized.reason,/cannot be confirmed/);
});
test('ZIP metadata is a candidate, and a replaced requirement cannot become old',()=>{
  const {source}=localSource(),root=site({replacement:JSON.stringify(source.replaceAll('\\','/'))});
  const result=current(root);assert.equal(result.old,null);assert.equal(result.candidate,'v0.1.0');
  assert.notEqual(result.old,version);
  const cli=run(process.execPath,[entry,root],work,process.env);
  assert.equal(cli.status,1,cli.stderr);assert.equal(JSON.parse(cli.stdout).old,null);
});
test('a configured official URL and cached fork refs cannot authenticate an official base',()=>{
  const {root,source}=localSource();git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.test']);
  git(root,['add','.']);git(root,['commit','-m','fork source']);
  git(root,['remote','add','origin','https://github.com/SwawHQ/banyan.git']);
  git(root,['update-ref','refs/remotes/origin/main',git(root,['rev-parse','HEAD'])]);
  assert.equal(identify({directory:source},release).old,null);
  assert.equal(identify(null,release).old,null);
});
test('a local merge stays unknown until that exact commit is published by an official ref',()=>{
  const {root,source,remote}=localSource();git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.test']);
  git(root,['add','.']);git(root,['commit','-m','base']);git(root,['branch','topic']);
  write(path.join(root,'main.txt'),'main');git(root,['add','.']);git(root,['commit','-m','main']);
  const main=git(root,['rev-parse','HEAD']);git(root,['checkout','topic']);
  write(path.join(root,'topic.txt'),'topic');git(root,['add','.']);git(root,['commit','-m','topic']);
  const topic=git(root,['rev-parse','HEAD']);git(root,['checkout','main']);git(root,['merge','--no-edit','topic']);
  git(root,['remote','add','upstream','https://github.com/SwawHQ/banyan.git']);
  git(root,['update-ref','refs/remotes/upstream/main',main]);git(root,['update-ref','refs/remotes/upstream/topic',topic]);
  git(root,['push',remote,main+':refs/heads/main',topic+':refs/heads/topic']);
  assert.equal(identify({directory:source},release).old,null);
  const merged=git(root,['rev-parse','HEAD']);git(root,['update-ref','refs/remotes/upstream/main',merged]);
  git(root,['push',remote,merged+':refs/heads/main']);
  assert.equal(identify({directory:source},release).old,merged);
});
test('an ours merge cannot report omitted upstream changes as the current official base',()=>{
  const {root,source,remote}=localSource();git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.test']);
  git(root,['add','.']);git(root,['commit','-m','base']);git(root,['branch','local']);
  write(path.join(source,'layouts/home.html'),'new upstream template');git(root,['add','.']);git(root,['commit','-m','upstream change']);
  const upstream=git(root,['rev-parse','HEAD']);
  git(root,['remote','add','upstream','https://github.com/SwawHQ/banyan.git']);
  git(root,['update-ref','refs/remotes/upstream/main',upstream]);
  git(root,['push',remote,upstream+':refs/heads/main']);
  git(root,['checkout','local']);write(path.join(root,'local.txt'),'local');git(root,['add','.']);git(root,['commit','-m','local work']);
  git(root,['merge','--strategy=ours','--no-edit','main']);
  assert.equal(git(root,['merge-base','HEAD','refs/remotes/upstream/main']),upstream);
  assert.equal(fs.readFileSync(path.join(source,'layouts/home.html'),'utf8'),'original');
  const result=identify({directory:source},release);assert.equal(result.old,null);
  assert.match(result.reason,/cannot be confirmed/);
});
test('unavailable official refs and missing shallow history report unknown without fetching',()=>{
  const {root,source,remote}=localSource();git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.test']);
  git(root,['add','.']);git(root,['commit','-m','base']);git(root,['push',remote,'HEAD:refs/heads/main']);
  const clone=path.join(work,'shallow '+(++sequence));git(work,['clone','--depth=1',pathToFileURL(remote).href,clone]);
  fs.appendFileSync(path.join(work,'empty-config'),'[safe]\n directory = '+JSON.stringify(clone)+'\n');
  assert.equal(identify({directory:path.join(clone,'module')},release).old,git(root,['rev-parse','HEAD']));
  write(path.join(source,'layouts/home.html'),'new upstream');git(root,['add','.']);git(root,['commit','-m','new upstream']);
  git(root,['push',remote,'HEAD:refs/heads/main']);
  const shallow=identify({directory:path.join(clone,'module')},release);
  assert.equal(shallow.old,null);assert.match(shallow.reason,/locally available history/);
  officialConfig(root,pathToFileURL(path.join(work,'missing-official.git')).href);
  const unavailable=identify({directory:source},release);
  assert.equal(unavailable.old,null);assert.match(unavailable.reason,/could not be verified/);
});

test('partial clones report unknown without lazily fetching missing official history',()=>{
  const {root,source,remote}=localSource();git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.test']);
  git(root,['add','.']);git(root,['commit','-m','base']);git(root,['push',remote,'HEAD:refs/heads/main']);
  git(remote,['config','uploadpack.allowFilter','true']);
  const clone=path.join(work,'partial '+(++sequence));git(work,['clone','--filter=blob:none',pathToFileURL(remote).href,clone]);
  fs.appendFileSync(path.join(work,'empty-config'),'[safe]\n directory = '+JSON.stringify(clone)+'\n');
  assert.equal(git(clone,['config','--get','remote.origin.promisor']),'true');
  write(path.join(source,'layouts/home.html'),'new upstream');git(root,['add','.']);git(root,['commit','-m','new upstream']);
  const tip=git(root,['rev-parse','HEAD']);git(root,['push',remote,'HEAD:refs/heads/main']);
  const objects=()=>git(clone,['cat-file','--batch-all-objects','--batch-check=%(objectname)']).split('\n').sort();
  const before=objects();assert.ok(!before.includes(tip),'The new official commit must be missing locally.');
  const previous=process.env.GIT_NO_LAZY_FETCH;
  try {
    process.env.GIT_NO_LAZY_FETCH='0';
    const result=identify({directory:path.join(clone,'module')},release);
    assert.deepEqual(objects(),before,'Version inspection must not download Git objects.');
    assert.equal(result.old,null);assert.match(result.reason,/locally available history/);
  } finally {
    if(previous===undefined)delete process.env.GIT_NO_LAZY_FETCH;else process.env.GIT_NO_LAZY_FETCH=previous;
  }
});

test('replacement commits cannot forge membership in official history',()=>{
  const {root,source,remote}=localSource();git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.test']);
  git(root,['add','.']);git(root,['commit','-m','base']);git(root,['branch','local']);
  write(path.join(source,'layouts/home.html'),'official template');git(root,['add','.']);git(root,['commit','-m','official update']);
  const upstream=git(root,['rev-parse','HEAD']);git(root,['push',remote,'HEAD:refs/heads/main']);
  const tree=git(root,['rev-parse','HEAD^{tree}']);git(root,['checkout','local']);
  write(path.join(source,'layouts/home.html'),'local template');git(root,['add','.']);git(root,['commit','-m','local change']);
  const local=git(root,['rev-parse','HEAD']);
  const replacement=git(root,['commit-tree',tree,'-p',local,'-m','replacement history']);
  git(root,['replace',upstream,replacement]);
  assert.equal(git(root,['merge-base','--is-ancestor',local,upstream]),'');
  const result=identify({directory:source},release);
  assert.equal(result.old,null);assert.match(result.reason,/cannot be confirmed/);
});
test('grafts cannot forge membership in official history, including an inherited graft file',()=>{
  const {root,source,remote}=localSource();git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Fixture']);git(root,['config','user.email','fixture@example.test']);
  git(root,['add','.']);git(root,['commit','-m','base']);git(root,['branch','local']);
  write(path.join(source,'layouts/home.html'),'official template');git(root,['add','.']);git(root,['commit','-m','official update']);
  const upstream=git(root,['rev-parse','HEAD']);git(root,['push',remote,'HEAD:refs/heads/main']);
  git(root,['checkout','local']);
  write(path.join(source,'layouts/home.html'),'local template');git(root,['add','.']);git(root,['commit','-m','unpublished local change']);
  const local=git(root,['rev-parse','HEAD']);
  assert.equal(identify({directory:source},release).old,null);
  const graft=path.resolve(root,git(root,['rev-parse','--git-path','info/grafts']));
  write(graft,upstream+' '+local+'\n');
  const forged=run(toolExecutable('git'),['merge-base','--is-ancestor',local,upstream],root,
    {...gitEnvironment(),GIT_NO_REPLACE_OBJECTS:'1',GIT_GRAFT_FILE:graft});
  assert.equal(forged.status,0,forged.stderr);
  const result=identify({directory:source},release);
  assert.equal(result.old,null);assert.match(result.reason,/cannot be confirmed/);
  const previous=process.env.GIT_GRAFT_FILE;
  try {
    process.env.GIT_GRAFT_FILE=graft;
    assert.equal(identify({directory:source},release).old,null);
  } finally {
    if(previous===undefined)delete process.env.GIT_GRAFT_FILE;else process.env.GIT_GRAFT_FILE=previous;
  }
});

test('CLI emits usable JSON, help works without a site, and upgrade is discoverable',()=>{
  const result=run(process.execPath,[entry,site()],work,process.env);
  assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).old,version);
  assert.match(help(['1'],'en'),/^upgrade\/\s+#/m);
  assert.match(help(['upgrade','3'],'zh'),/upgrade\/version\/current/);
  for (const args of [['--help'],['-h']]) {
    const result=run(process.execPath,[entry,...args],work,{...process.env,PATH:''});
    assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/swban upgrade\/version\/current/);
  }
  for (const args of [['--bad'],['one','two'],['']]) assert.equal(run(process.execPath,[entry,...args],work,process.env).status,1);
});
