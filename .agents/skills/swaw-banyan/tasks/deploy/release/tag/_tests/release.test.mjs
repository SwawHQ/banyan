import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {release} from '../release.mjs';
import {toolExecutable} from '../../../../_shared/tools/operations.mjs';
import {gitEnvironment} from '../../../../base/git/environment.mjs';

const entry=fileURLToPath(new URL('../entry.mjs',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw','banyan','release-tag');
const modulePath='github.com/SwawHQ/banyan/module';
const version='0.1.0',tags=['v'+version,'module/v'+version];
let work,previous,sequence=0;
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
function run(executable,args,cwd,env=process.env) {
  const result=spawnSync(executable,args,{cwd,env,encoding:'utf8',timeout:30000,windowsHide:true});
  assert.ifError(result.error);return result;
}
function git(cwd,args) {
  const result=run(toolExecutable('git'),args,cwd,{...gitEnvironment(),GIT_OPTIONAL_LOCKS:'0'});
  assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout.trim();
}
function fixture({skillVersion=version,themeVersion=skillVersion,skillModule=modulePath,themeModule=skillModule}={}) {
  const root=path.join(work,'source '+(++sequence)),remote=path.join(work,'remote '+sequence+'.git');
  fs.mkdirSync(root,{recursive:true});
  for(const directory of [root,remote]) fs.appendFileSync(process.env.GIT_CONFIG_GLOBAL,'[safe]\n directory = '+JSON.stringify(directory)+'\n');
  git(work,['init','--bare','--initial-branch=main',remote]);
  git(root,['init','--initial-branch=main']);
  git(root,['config','user.name','Release fixture']);git(root,['config','user.email','fixture@example.test']);
  write(path.join(root,'.agents/skills/swaw-banyan/SKILL.md'),'---\nmetadata:\n  version: '+JSON.stringify(skillVersion)+'\n  module: '+JSON.stringify(skillModule)+'\n---\n');
  write(path.join(root,'module/theme.toml'),'name="banyan"\nversion='+JSON.stringify(themeVersion)+'\n');
  write(path.join(root,'module/go.mod'),'module '+themeModule+'\n\ngo 1.18\n');
  git(root,['add','.']);git(root,['commit','-m','release source']);git(root,['remote','add','origin',remote]);
  return {root,remote,commit:git(root,['rev-parse','HEAD'])};
}
function bare(name) {
  const directory=path.join(work,name+'.git');
  fs.appendFileSync(process.env.GIT_CONFIG_GLOBAL,'[safe]\n directory = '+JSON.stringify(directory)+'\n');
  git(work,['init','--bare','--initial-branch=main',directory]);return directory;
}
const remoteTags=remote=>git(remote,['for-each-ref','--format=%(refname)','refs/tags/']);
function unpublished({root,remote}) {
  assert.equal(remoteTags(remote),'');assert.equal(git(root,['tag','-l']),'');
}
beforeEach(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'case-'));
  const settings={GIT_CONFIG_GLOBAL:path.join(work,'git-config'),GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'};
  previous=Object.fromEntries(Object.keys(settings).map(key=>[key,process.env[key]]));Object.assign(process.env,settings);
  write(process.env.GIT_CONFIG_GLOBAL,'[commit]\n gpgsign = false\n');
});
afterEach(()=>{
  for(const [key,value] of Object.entries(previous??{})) if(value===undefined)delete process.env[key];else process.env[key]=value;
  if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);assert.ok(path.basename(work).startsWith('case-'));fs.rmSync(work,{recursive:true,force:true});}
});

test('--check validates committed source and prints a plan without creating or publishing tags',()=>{
  const source=fixture();
  const result=run(process.execPath,[entry,'--check'],source.root);
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{version,commit:source.commit,tags,remote:'origin',published:false});
  unpublished(source);
});
test('default publication creates exactly two remote tags for the captured commit',()=>{
  const source=fixture();
  const result=run(process.execPath,[entry],source.root);
  assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).published,true);
  assert.deepEqual(remoteTags(source.remote).split('\n').sort(),tags.map(tag=>'refs/tags/'+tag).sort());
  for(const tag of tags)assert.equal(git(source.remote,['rev-parse','refs/tags/'+tag]),source.commit);
  assert.equal(git(source.root,['tag','-l']),'');
});

test('submodule-only push configuration cannot skip the release tags',()=>{
  const source=fixture();git(source.root,['config','push.recurseSubmodules','only']);
  assert.equal(release({cwd:source.root}).published,true);
  for(const tag of tags)assert.equal(git(source.remote,['rev-parse','refs/tags/'+tag]),source.commit);
  assert.equal(remoteTags(source.remote).split('\n').length,2);
});
test('a relative push URL publishes to that local path instead of a same-named remote',()=>{
  const source=fixture(),name='destination',destination=path.join(source.root,name);
  fs.appendFileSync(process.env.GIT_CONFIG_GLOBAL,'[safe]\n directory = '+JSON.stringify(destination)+'\n');
  git(source.root,['init','--bare','--initial-branch=main',destination]);
  fs.appendFileSync(path.join(source.root,'.git/info/exclude'),'\n'+name+'/\n');
  git(source.root,['remote','add',name,source.remote]);git(source.root,['remote','set-url','--push','origin',name]);
  assert.equal(git(source.root,['status','--porcelain']),'');
  const result=release({cwd:source.root});assert.equal(result.published,true);
  for(const tag of tags)assert.equal(git(destination,['rev-parse','refs/tags/'+tag]),source.commit);
  assert.equal(remoteTags(source.remote),'');assert.equal(git(source.root,['tag','-l']),'');
});

test('URL rewrites run once and preserve the native origin destination',()=>{
  const source=fixture(),other=bare('wrong destination'),alias='release-alias:repo';
  const first=pathToFileURL(source.remote).href,second=pathToFileURL(other).href;
  git(source.root,['config','--global','url.'+first+'.insteadOf',alias]);
  git(source.root,['config','--global','url.'+second+'.insteadOf',first]);
  git(source.root,['remote','set-url','origin',alias]);
  git(source.root,['push','origin','HEAD:refs/heads/native-probe']);
  assert.equal(git(source.remote,['rev-parse','refs/heads/native-probe']),source.commit);
  assert.equal(release({cwd:source.root,check:true}).published,false);
  assert.equal(remoteTags(source.remote),'');assert.equal(remoteTags(other),'');
  assert.equal(release({cwd:source.root}).published,true);
  for(const tag of tags)assert.equal(git(source.remote,['rev-parse','refs/tags/'+tag]),source.commit);
  assert.equal(remoteTags(other),'');
});

test('pushInsteadOf and distinct fetch/push URLs use the push destination for release checks',()=>{
  const source=fixture(),destination=bare('push destination'),alias='release-alias:repo';
  git(source.root,['push','origin','HEAD:refs/tags/'+tags[0]]);
  git(source.root,['config','--global','url.'+pathToFileURL(source.remote).href+'.insteadOf',alias]);
  git(source.root,['config','--global','url.'+pathToFileURL(destination).href+'.pushInsteadOf',alias]);
  git(source.root,['remote','set-url','origin',alias]);
  assert.equal(release({cwd:source.root,check:true}).published,false);
  assert.equal(remoteTags(destination),'');
  assert.equal(release({cwd:source.root}).published,true);
  for(const tag of tags)assert.equal(git(destination,['rev-parse','refs/tags/'+tag]),source.commit);
  assert.equal(remoteTags(source.remote),'refs/tags/'+tags[0]);
});

test('a tag already at a distinct push URL blocks the entire release',()=>{
  const source=fixture(),destination=bare('push destination');
  git(source.root,['remote','set-url','--push','origin',destination]);
  git(source.root,['push','origin','HEAD:refs/tags/'+tags[1]]);
  for(const check of [false,true]) assert.throws(()=>release({cwd:source.root,check,language:'en'}),error=>{
    assert.ok(error.message.includes(tags[1]));assert.ok(error.message.includes('will not be overwritten'));
    assert.ok(error.message.includes('swban deploy/release/tag --check'));return true;
  });
  assert.equal(remoteTags(destination),'refs/tags/'+tags[1]);assert.equal(remoteTags(source.remote),'');
});

test('a conflicting push tag from another commit is reported without inventing its hash',()=>{
  const source=fixture(),destination=bare('push destination');
  git(source.root,['remote','set-url','--push','origin',destination]);
  git(source.root,['push','origin','HEAD:refs/tags/'+tags[0]]);
  write(path.join(source.root,'next.txt'),'next release source');git(source.root,['add','.']);git(source.root,['commit','-m','new source']);
  const next=git(source.root,['rev-parse','HEAD']);assert.notEqual(next,source.commit);
  for(const check of [false,true]) assert.throws(()=>release({cwd:source.root,check,language:'en'}),error=>{
    assert.ok(error.message.includes('\n  '+tags[0]+'\n'));assert.ok(!error.message.includes('('+next+')'));
    assert.ok(!error.message.includes('\n  '+tags[1]));return true;
  });
  assert.equal(remoteTags(destination),'refs/tags/'+tags[0]);
  assert.equal(git(destination,['rev-parse','refs/tags/'+tags[0]]),source.commit);
});

test('an explicit push URL ignores pushInsteadOf and mirror settings cannot affect unrelated refs',()=>{
  const source=fixture(),destination=bare('push destination'),wrong=bare('wrong destination'),alias='release-alias:repo';
  git(source.root,['config','--global','url.'+pathToFileURL(destination).href+'.insteadOf',alias]);
  git(source.root,['config','--global','url.'+pathToFileURL(wrong).href+'.pushInsteadOf',alias]);
  git(source.root,['remote','set-url','--push','origin',alias]);
  git(source.root,['push','origin','HEAD:refs/heads/keep']);
  git(source.root,['config','remote.origin.mirror','true']);
  assert.equal(release({cwd:source.root,check:true}).published,false);
  assert.equal(remoteTags(destination),'');
  assert.equal(release({cwd:source.root}).published,true);
  for(const tag of tags)assert.equal(git(destination,['rev-parse','refs/tags/'+tag]),source.commit);
  assert.equal(git(destination,['for-each-ref','--format=%(refname)','refs/heads/']),'refs/heads/keep');
  assert.equal(remoteTags(wrong),'');assert.equal(remoteTags(source.remote),'');
});

test('--check skips pre-push hooks and publication still respects hook rejection',()=>{
  const source=fixture(),hook=path.join(source.root,'.git/hooks/pre-push'),marker=path.join(source.root,'.git/pre-push-ran');
  write(hook,'#!/bin/sh\n: > .git/pre-push-ran\necho "fixture rejects publication" >&2\nexit 1\n');fs.chmodSync(hook,0o755);
  assert.equal(release({cwd:source.root,check:true}).published,false);
  assert.equal(fs.existsSync(marker),false);unpublished(source);
  assert.throws(()=>release({cwd:source.root}),/fixture rejects publication/);
  assert.equal(fs.existsSync(marker),true);unpublished(source);
});
test('committed version, module identity and SemVer errors refuse publication',()=>{
  for(const [options,message] of [
    [{themeVersion:'0.2.0'},/Theme and Skill versions|版本号不一致/],
    [{themeModule:'example.test/other/module'},/module paths must match/],
    [{skillVersion:'01.2.3'},/SemVer/],
    [{skillVersion:'v0.1.0'},/SemVer/],
    [{skillVersion:'2.0.0'},/major version/]
  ]) {
    const source=fixture(options);assert.throws(()=>release({cwd:source.root}),message);unpublished(source);
  }
});

test('version mismatch reports both committed values and repair steps in Chinese and English',()=>{
  const source=fixture({themeVersion:'0.2.0'});
  for(const language of ['zh','en']) for(const check of [false,true]) {
    assert.throws(()=>release({cwd:source.root,language,check}),error=>{
      assert.ok(error.message.includes('.agents/skills/swaw-banyan/SKILL.md: metadata.version = "0.1.0"'));
      assert.ok(error.message.includes('module/theme.toml: version = "0.2.0"'));
      assert.ok(error.message.includes(language==='zh'?'同一个待发布版本号':'same intended release version'));
      assert.ok(error.message.includes(language==='zh'?'提交修改后':'Commit the changes'));
      assert.ok(error.message.includes('swban deploy/release/tag --check'));return true;
    });
    unpublished(source);
  }
  const cli=run(process.execPath,[entry,'--check'],source.root);
  assert.equal(cli.status,1);assert.equal(cli.stdout,'');
  assert.ok(cli.stderr.includes('metadata.version = "0.1.0"'));assert.ok(cli.stderr.includes('version = "0.2.0"'));
  unpublished(source);
});

test('native Go parsing rejects fake Module directives inside invalid block comments',()=>{
  const source=fixture();
  write(path.join(source.root,'module/go.mod'),'/*\nmodule '+modulePath+'\n*/\nmodule example.test/other/module\n\ngo 1.18\n');
  git(source.root,['add','.']);git(source.root,['commit','-m','invalid Module syntax']);
  assert.throws(()=>release({cwd:source.root}),/mod files must use \/\/ comments/);unpublished(source);
});

test('native Go parsing accepts indented Module directives, quotes and line comments',()=>{
  const source=fixture();
  write(path.join(source.root,'module/go.mod'),'// fixture Module\n\tmodule "'+modulePath+'" // identity\n\ngo 1.18\n');
  git(source.root,['add','.']);git(source.root,['commit','-m','valid Module formatting']);
  assert.equal(release({cwd:source.root,check:true}).published,false);unpublished(source);
});
test('Git replacement objects cannot substitute valid metadata for an invalid original commit',()=>{
  const source=fixture({themeVersion:'0.2.0'}),file=path.join(source.root,'module/theme.toml');
  write(file,'name="banyan"\nversion='+JSON.stringify(version)+'\n');
  git(source.root,['add','.']);git(source.root,['commit','-m','replacement with matching version']);
  const replacement=git(source.root,['rev-parse','HEAD']);git(source.root,['reset','--hard',source.commit]);
  git(source.root,['replace',source.commit,replacement]);
  assert.match(git(source.root,['show',source.commit+':module/theme.toml']),/version="0\.1\.0"/);
  assert.throws(()=>release({cwd:source.root}),/Theme and Skill versions|版本号不一致/);unpublished(source);
});
test('uncommitted or untracked source refuses publication',()=>{
  for(const changed of ['module/theme.toml','new.txt']) {
    const source=fixture();write(path.join(source.root,changed),'pending change');
    assert.throws(()=>release({cwd:source.root}),/pending changes/);unpublished(source);
  }
});
test('existing local or remote version tags are never overwritten',()=>{
  const local=fixture();git(local.root,['tag',tags[0]]);
  assert.throws(()=>release({cwd:local.root}),/local release tags already exist|本地已存在版本标签/);
  assert.equal(git(local.root,['rev-parse','refs/tags/'+tags[0]]),local.commit);assert.equal(remoteTags(local.remote),'');
  const remote=fixture();git(remote.root,['push','origin','HEAD:refs/tags/'+tags[1]]);
  assert.throws(()=>release({cwd:remote.root}),/tags already exist on origin|origin 上已存在版本标签/);
  assert.equal(git(remote.remote,['rev-parse','refs/tags/'+tags[1]]),remote.commit);
  assert.equal(remoteTags(remote.remote),'refs/tags/'+tags[1]);assert.equal(git(remote.root,['tag','-l']),'');
});

test('existing remote tags report exact names, hashes and a safe next step without publishing the missing tag',()=>{
  for(const existing of [[tags[1]],tags]) {
    const source=fixture();git(source.root,['push','origin',...existing.map(tag=>'HEAD:refs/tags/'+tag)]);
    const before=remoteTags(source.remote);
    for(const language of ['zh','en']) for(const check of [false,true]) {
      assert.throws(()=>release({cwd:source.root,language,check}),error=>{
        assert.ok(error.message.includes('origin'));
        for(const tag of existing)assert.ok(error.message.includes(tag+' ('+source.commit+')'));
        assert.ok(error.message.includes(language==='zh'?'不会覆盖':'will not be overwritten'));
        assert.ok(error.message.includes(language==='zh'?'无需重复发布':'needs no repeat publication'));
        assert.ok(error.message.includes(language==='zh'?'未使用的版本号':'unused version'));
        assert.ok(error.message.includes('SKILL.md: metadata.version'));
        assert.ok(error.message.includes('module/theme.toml: version'));
        assert.ok(error.message.includes('swban deploy/release/tag --check'));return true;
      });
      assert.equal(remoteTags(source.remote),before);assert.equal(git(source.root,['tag','-l']),'');
    }
    const cli=run(process.execPath,[entry],source.root);
    assert.equal(cli.status,1);assert.equal(cli.stdout,'');assert.ok(cli.stderr.includes(existing[0]));
    assert.ok(cli.stderr.includes('swban deploy/release/tag --check'));
    assert.equal(remoteTags(source.remote),before);assert.equal(git(source.root,['tag','-l']),'');
  }
});

test('all conflicting local tags are reported with repair steps and remain unchanged',()=>{
  const source=fixture();for(const tag of tags)git(source.root,['tag',tag]);
  const before=git(source.root,['tag','-l']);
  for(const language of ['zh','en']) assert.throws(()=>release({cwd:source.root,language}),error=>{
    for(const tag of tags)assert.ok(error.message.includes('\n  '+tag));
    assert.ok(error.message.includes(language==='zh'?'本地已存在版本标签':'local release tags already exist'));
    assert.ok(error.message.includes('SKILL.md: metadata.version'));assert.ok(error.message.includes('module/theme.toml: version'));
    assert.ok(error.message.includes('swban deploy/release/tag --check'));return true;
  });
  assert.equal(git(source.root,['tag','-l']),before);assert.equal(remoteTags(source.remote),'');
});
test('a remote hook rejection leaves no partially published tag pair',()=>{
  const source=fixture(),hook=path.join(source.remote,'hooks/update');
  write(hook,'#!/bin/sh\nif [ "$1" = "refs/tags/module/v0.1.0" ]; then\n echo "fixture rejects Module tag" >&2\n exit 1\nfi\nexit 0\n');
  fs.chmodSync(hook,0o755);
  assert.throws(()=>release({cwd:source.root}),/fixture rejects Module tag|atomic push/);unpublished(source);
});
test('help works without source and invalid options fail before publishing',()=>{
  for(const flag of ['--help','-h']) {
    const result=run(process.execPath,[entry,flag],work,{...process.env,PATH:''});
    assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/swban deploy\/release\/tag/);
  }
  const source=fixture();
  for(const args of [['--bad'],['extra'],['--check=false'],['--check','--check']]) {
    const result=run(process.execPath,[entry,...args],source.root);
    assert.equal(result.status,1,result.stderr);assert.equal(result.stdout,'');unpublished(source);
  }
});
