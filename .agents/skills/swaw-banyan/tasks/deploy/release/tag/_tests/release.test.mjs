import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {release} from '../release.mjs';
import {toolExecutable} from '../../../../_shared/tools/operations.mjs';
import {hugoEnvironment} from '../../../../base/hugo/run.mjs';
import {goEnvironment} from '../../../../base/go/environment.mjs';
import {gitEnvironment} from '../../../../base/git/environment.mjs';

const module='github.com/SwawHQ/banyan/module',version='0.1.1',tag='v'+version;
const entry=fileURLToPath(new URL('../entry.mjs',import.meta.url));
let root,remote,work,previous;
function write(file,data){
  const dest=path.join(root,file);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);
}
function git(args,cwd=root){
  const result=spawnSync(toolExecutable('git'),args,{cwd,env:gitEnvironment(),encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
const run=(options={})=>release({cwd:root,version,...options});
const commit=()=>{git(['add','.']);git(['commit','-m','fixture']);};
const remoteTags=()=>git(['tag','--list'],remote).split('\n').filter(Boolean);
beforeEach(()=>{
  const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw','banyan','release-tag');
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'case-'));
  root=path.join(work,'source');remote=path.join(work,'remote.git');fs.mkdirSync(root);
  const env={GIT_CONFIG_GLOBAL:path.join(work,'gitconfig'),GIT_CONFIG_NOSYSTEM:'1',GOSUMDB:'off',
    GOPROXY:'direct',HUGO_MODULE_PROXY:'direct',GOPRIVATE:'',GONOPROXY:'',GOENV:'off',GIT_ALLOW_PROTOCOL:'file'};
  previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
  git(['config','--global','safe.directory','*']);
  git(['config','--global','url.'+pathToFileURL(remote).href+'.insteadOf','https://github.com/SwawHQ/banyan']);
  git(['init','--bare','--initial-branch=main',remote]);
  git(['init','--initial-branch=main']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.test']);
  write('.agents/skills/swaw-banyan/SKILL.md','---\nmetadata:\n  version: "0.1.0"\n  module: "'+module+'"\n---\n');
  write('module/theme.toml','name = "banyan"\nversion = "0.1.0"\n');
  write('go.mod','module example.test/site\n\ngo 1.18\n\nrequire '+module+' v0.0.0\nreplace '+module+' => ./module\n');
  write('module/go.mod','module '+module+'\n\ngo 1.18\n');
  write('hugo.work','go 1.18\n\nuse .\nuse ./module\n');
  write('hugo.toml','baseURL="https://example.test/"\n[module]\n[[module.imports]]\npath="'+module+'"\n');
  write('module/layouts/home.html','fixture home');
  commit();git(['remote','add','origin',remote]);git(['push','-u','origin','main']);
});
afterEach(()=>{
  for(const [k,v] of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;
  fs.rmSync(work,{recursive:true,force:true});
});
test('check and invalid input leave files, history and tags unchanged',()=>{
  const head=git(['rev-parse','HEAD']);
  assert.deepEqual(run({check:true}).tags,['module/'+tag,tag]);
  for(const v of ['module','project','v0.1.1','1.01.0'])assert.throws(()=>run({version:v}),/SemVer/);
  assert.equal(git(['rev-parse','HEAD']),head);assert.deepEqual(remoteTags(),[]);assert.equal(git(['status','--porcelain']),'');
  write('untracked','pending');assert.throws(()=>run(),/clean working tree/);
  const help=spawnSync(process.execPath,[entry,'--help'],{cwd:root,encoding:'utf8'});
  assert.equal(help.status,0);assert.match(help.stdout,/deploy\/release\/tag/);
});
test('publishes the branch with each immutable tag and builds using the downloaded Module',()=>{
  git(['config','remote.origin.mirror','true']);git(['config','push.recurseSubmodules','only']);
  const cli=spawnSync(process.execPath,[entry,version],{cwd:root,encoding:'utf8',windowsHide:true});
  assert.equal(cli.status,0,cli.stderr);const result=JSON.parse(cli.stdout);assert.equal(result.published,true);
  const moduleRef='module/'+tag;
  assert.equal(git(['rev-parse','main'],remote),result.commit);
  assert.equal(git(['rev-parse',tag],remote),result.commit);assert.notEqual(git(['rev-parse',moduleRef],remote),result.commit);
  assert.match(git(['show',moduleRef+':module/theme.toml'],remote),/version = "0.1.1"/);
  assert.match(git(['show',moduleRef+':.agents/skills/swaw-banyan/SKILL.md'],remote),/version: "0.1.1"/);
  assert.match(git(['show',tag+':go.mod'],remote),/require github.com\/SwawHQ\/banyan\/module v0.1.1/);
  assert.doesNotMatch(git(['show',tag+':go.mod'],remote),/replace/);
  assert.match(git(['show',tag+':go.sum'],remote),/ v0.1.1 h1:/);
  assert.equal(git(['status','--porcelain']),'');assert.throws(()=>run(),/already published/);
});
test('download failure permits a site fix and retry, but changed theme requires another version',()=>{
  const proxy=process.env.GOPROXY;process.env.GOPROXY='off';
  assert.throws(()=>run(),/disabled|GOPROXY/);process.env.GOPROXY=proxy;
  assert.deepEqual(remoteTags(),['module/'+tag]);const first=git(['rev-parse','module/'+tag],remote);
  assert.equal(git(['status','--porcelain']),'');
  write('module/changed','changed');commit();assert.throws(()=>run(),/different source/);
  git(['revert','--no-edit','HEAD']);write('content/_index.md','---\ntitle: Fixed\n---\n');commit();
  assert.equal(run({check:true}).resume,true);
  const cache=path.join(work,'proxy-cache');
  const seed=spawnSync(toolExecutable('go'),['mod','download',module+'@'+tag],{
    cwd:root,env:{...goEnvironment(gitEnvironment()),GOWORK:'off',GOMODCACHE:cache,GOFLAGS:'-modcacherw'},encoding:'utf8'
  });
  assert.equal(seed.status,0,seed.stderr);
  process.env.GOPROXY=pathToFileURL(path.join(cache,'cache/download')).href;
  assert.equal(run().resume,true);assert.equal(git(['rev-parse','module/'+tag],remote),first);
});
test('a fork cannot publish a project tag using another repository’s same-version Module',()=>{
  const fork=path.join(work,'fork.git');git(['init','--bare','--initial-branch=main',fork]);
  git(['remote','set-url','origin',fork]);git(['push','origin','main']);
  git(['push',remote,'HEAD:refs/tags/module/'+tag]);
  assert.throws(()=>run(),/does not match published/);
  assert.equal(git(['tag','--list'],fork),'module/'+tag);
  assert.notEqual(git(['rev-parse','module/'+tag],fork),git(['rev-parse','module/'+tag],remote));
});

test('local tag conflict, non-release branch and remote hook rejection cannot publish either tag',()=>{
  git(['tag',tag]);assert.throws(()=>run(),/Conflicting local tag/);git(['tag','-d',tag]);
  git(['switch','-c','feature']);assert.throws(()=>run(),/default branch/);git(['switch','main']);
  const hook=path.join(remote,'hooks','update');fs.writeFileSync(hook,'#!/bin/sh\ncase "$1" in refs/tags/*) exit 1;; esac\n');fs.chmodSync(hook,0o755);
  const before=git(['rev-parse','main'],remote);
  assert.throws(()=>run(),/rejected|hook|atomic/);assert.deepEqual(remoteTags(),[]);assert.equal(git(['rev-parse','main'],remote),before);
});

test('release validates the local theme even when a working vendor copy exists',()=>{
  function hugo(args) {
    const result=spawnSync(toolExecutable('hugo'),args,{cwd:root,env:hugoEnvironment(),encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);return result.stdout;
  }
  hugo(['mod','vendor']);
  assert.match(hugo(['mod','graph']),/\+vendor/);
  write('module/layouts/home.html','{{ missingReleaseFunction }}');commit();
  const before=git(['rev-parse','HEAD']),remoteBefore=git(['rev-parse','main'],remote);
  assert.throws(()=>run(),/missingReleaseFunction/);
  assert.deepEqual(remoteTags(),[]);assert.equal(git(['rev-parse','HEAD']),before);
  assert.equal(git(['rev-parse','main'],remote),remoteBefore);assert.equal(git(['status','--porcelain']),'');
});

test('preflight inspects the rewritten push destination and ignores tags on the fetch remote',()=>{
  const other=path.join(work,'other.git');git(['init','--bare','--initial-branch=main',other]);
  git(['push',other,'HEAD:refs/heads/main','HEAD:refs/tags/'+tag]);
  git(['remote','set-url','origin',other]);
  git(['config','--global','url.'+pathToFileURL(remote).href+'.pushInsteadOf',other]);
  assert.equal(run({check:true}).published,false);
  git(['push','origin','HEAD:refs/tags/'+tag]);assert.throws(()=>run({check:true}),/already published/);
});
