import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,serviceWorkerPolicy} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {verifyCspOutput} from '../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan');
const parent=path.join(fs.realpathSync.native(os.tmpdir()),'swaw/banyan/fingerprint-policy/browser'),panel='/prefs/content/',from='/content-start/';
const versions=['v20261015000001','v20261015000002'];
let work,skill,old,next,versionedOld,versionedNext,versionedDisabled,uncached;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(newBuild=next,firstBuild=old,task='content'){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/pwa',task,'entry.mjs'),firstBuild,
    ...(task==='offline'?[]:['--next',newBuild]),'--page',panel,...(task==='content'?['--from',from]:[]),'--out',path.join(work,'reports')],
    {cwd:work,encoding:'utf8',timeout:60000});
  assert.ifError(result.error);return result;
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-content-'));skill=path.join(work,'skill');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime='node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),data=path.join(work,'data'),config=path.join(work,'fixture.toml');
  for(const lang of ['en','zh','zh-tw']) {
    const prefix=lang==='en'?'':'/'+lang,suffix=lang==='en'?'':'.'+lang;
    write(path.join(content,'powered-by/index'+suffix+'.md'),fs.readFileSync(path.join(root,'module/content/powered-by/index'+suffix+'.md'),'utf8')
      .replace(/^---\r?\n/,'---\nurl: '+prefix+panel+'\n'));
    write(path.join(content,'content-start/index'+suffix+'.md'),'---\ntitle: Independent content source\nslug: content-start\nurl: '+prefix+from+
      '\nlayout: page-article\nroot_nav: true\nicon: code\nweight: 87\nbuild:\n  list: local\n---\n\nIndependent content source.');
  }
  const mounts=[['content',content],['content','content'],['data',data],['data','data']]
    .map(([target,directory])=>'[[module.mounts]]\nsource = '+JSON.stringify(directory.replaceAll('\\','/'))+'\ntarget = "'+target+'"\n').join('');
  const build=(name,version,policy=serviceWorkerPolicy('enable'))=>{
    write(path.join(data,'delivery.toml'),policy);
    write(config,mounts+'[params.build]\nversion = "'+version+'"\n');
    const destination=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',destination],
      {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
    verifyCspOutput(destination);return destination;
  };
  old=build('old',versions[0]);next=build('next',versions[1]);
  const policy=fs.readFileSync(path.join(root,'module/data/delivery.toml'),'utf8')
    .replace('mode = "off"','mode = "enable"').replaceAll('sw.bucket = "fingerprinted"','sw.bucket = "versioned"');
  versionedOld=build('versioned-old',versions[0],policy);versionedNext=build('versioned-next',versions[1],policy);
  versionedDisabled=build('versioned-disabled',versions[1],policy.replace('mode = "enable"','mode = "disable"'));
  uncached=build('uncached',versions[0],policy+'\n[[routes]]\npath = "/css/*"\nsw.bucket = "off"\n'+
    '\n[[routes]]\npath = "/js/*"\nsw.bucket = "off"\n');
},{timeout:60000});
after(()=>{
  if(work){assert.equal(path.dirname(fs.realpathSync.native(work)),parent);assert.ok(path.basename(work).startsWith('banyan-browser-content-'));fs.rmSync(work,{recursive:true,force:true});}
});

test('content releases switch caches once while a program waits without replacing the active worker or reader',{timeout:70000},()=>{
  const result=cli();assert.equal(result.status,0,result.stdout+result.stderr);
  const state=JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
  assert.equal(state.details.before,versions[0]);assert.equal(state.details.after,versions[1]);
  assert.equal(state.details.requests,1);assert.equal(state.details.readerPreserved,true);assert.equal(state.details.controllerPreserved,true);
  assert.equal(state.details.waitingProgramContentUpdated,true);
  assert.ok(state.details.fingerprintedResources>0);
  assert.ok(state.details.cachesAfter.includes('nav-html-'+versions[1]));
  assert.ok(!state.details.cachesAfter.includes('nav-html-'+versions[0]));
});

test('content checks reject a program change instead of treating it as a content release',{timeout:15000},()=>{
  const changed=path.join(work,'program-change');fs.cpSync(next,changed,{recursive:true});
  fs.appendFileSync(path.join(changed,'sw.js'),'\n// Different program\n');
  const result=cli(changed);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stdout+result.stderr,/identical sw.js bytes/);
});

test('HTTP immutable resources can use versioned SW caches for offline, content updates and cleanup',{timeout:70000},()=>{
  const reports={};
  for(const [task,destination] of [['offline',versionedNext],['content',versionedNext],['disable',versionedDisabled]]) {
    const result=cli(destination,versionedOld,task);assert.equal(result.status,0,result.stdout+result.stderr);
    reports[task]=JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8')).details;
  }
  assert.ok(reports.offline.offlineAssets>0);
  assert.ok(Object.values(reports.offline.assetBuckets).every(bucket=>bucket==='versioned'));
  assert.equal(reports.content.fingerprintedResources,0);
  assert.ok(reports.content.cachesAfter.includes('asset-versioned-'+versions[1]));
  assert.ok(!reports.content.cachesAfter.includes('asset-fingerprint'));
  assert.equal(reports.disable.after.controller,'');
});

test('offline checks explain the coverage boundary when core CSS/JS use SW off',{timeout:20000},()=>{
  const result=cli(next,uncached,'offline');
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout+result.stderr,/Full offline CSS\/JS coverage requires SW caching/);
});
