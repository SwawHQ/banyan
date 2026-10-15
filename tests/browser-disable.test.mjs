import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {command} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/disable/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';
import {isManagedCacheKey,shouldDeleteVersionedCache} from '../module/assets/js/pwa/cache-names.js';

test('cache cleanup keeps current and unrelated caches',()=>{
  for(const key of ['nav-html-old','asset-versioned-old']) {
    assert.equal(isManagedCacheKey(key),true);
    assert.equal(shouldDeleteVersionedCache(key,'nav-html-current','asset-versioned-current'),true);
  }
  for(const key of ['nav-html-current','asset-versioned-current','asset-fingerprint','sw-content-state','sw-program-offline-probe']) {
    assert.equal(isManagedCacheKey(key),true);
    assert.equal(shouldDeleteVersionedCache(key,'nav-html-current','asset-versioned-current'),false);
  }
  for(const key of ['other-cache','asset-static-retired']) {
    assert.equal(isManagedCacheKey(key),false);
    assert.equal(shouldDeleteVersionedCache(key,'nav-html-current','asset-versioned-current'),false);
  }
});

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan');
const parent=fs.realpathSync(os.tmpdir()),page='/cleanup-start/';
let work,skill,enabled,disabled,off;
const faults={};
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(args=[],first=enabled,next=disabled) {
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/pwa/disable',first,'--next',next,
    ...(args.includes('--page')?[]:['--page',page]),...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function report(result) {
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
function fails(first,next,message) {
  const result=cli(['--timeout','1500'],first,next);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-disable-'));skill=path.join(work,'skill');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime=process.versions.bun?'bun':'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun??process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  for(const language of ['en','zh','zh-tw']) {
    const prefix=language==='en'?'':'/'+language,suffix=language==='en'?'':'.'+language;
    write(path.join(content,'cleanup-start/index'+suffix+'.md'),'---\ntitle: Independent cleanup source\nslug: cleanup-start\nurl: '+prefix+page+'\nlayout: page-article\n---\n\nIndependent worker cleanup page.');
  }
  const mounts='[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n';
  const build=(name,mode,asset,code)=>{
    const assets=path.join(work,name+'-assets');if(asset)write(path.join(assets,'js/pwa/'+asset),code);
    const data=path.join(work,name+'-data');
    write(path.join(data,'delivery.toml'),'[service_worker]\nmode = "'+mode+'"\n');
    write(config,mounts+(asset?'[[module.mounts]]\nsource = '+JSON.stringify(assets.replaceAll('\\','/'))+'\ntarget = "assets"\n[[module.mounts]]\nsource = "assets"\ntarget = "assets"\n':'')+
      '[[module.mounts]]\nsource = '+JSON.stringify(data.replaceAll('\\','/'))+'\ntarget = "data"\n'+
      '[[module.mounts]]\nsource = "data"\ntarget = "data"\n[params.build]\nversion = "v20261010001001"\n');
    const destination=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',destination],
      {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return destination;
  };
  enabled=build('enabled','enable');disabled=build('disabled','disable');off=build('off','off');
  const worker=fs.readFileSync(path.join(root,'module/assets/js/pwa/worker-disable.js'),'utf8');
  const manager=fs.readFileSync(path.join(root,'module/assets/js/pwa/manager-disable.js'),'utf8');
  for(const [name,asset,input,search,replacement] of [
    ['worker-waits','worker-disable.js',worker,'self.skipWaiting();','// Fault: leave the disable worker waiting.'],
    ['worker-no-clean','worker-disable.js',worker,'keys.filter(isManagedCacheKey)','[]'],
    ['worker-clear-all','worker-disable.js',worker,'keys.filter(isManagedCacheKey)','keys'],
    ['manager-no-unregister','manager-disable.js',manager,'await unregisterManagedWorkers();','// Fault: leave the root registration.'],
    ['manager-no-clean','manager-disable.js',manager,'await clearManagedCaches();','// Fault: leave manager-phase caches.'],
    ['manager-clear-all','manager-disable.js',manager,'keys.filter(isManagedCacheKey)','keys'],
    ['manager-unregister-all','manager-disable.js',manager,'.filter(isRootScopedRegistration)','.filter(() => true)'],
    ['manager-clear-storage','manager-disable.js',manager,'await clearManagedCaches();','await clearManagedCaches(); localStorage.clear(); sessionStorage.clear();']
  ]) {
    assert.ok(input.includes(search),'Fault must alter real source: '+name);
    faults[name]=build(name,'disable',asset,input.replace(search,replacement));
  }
  // A separate registration outside the theme scope is real browser state.
  // Only the enabled page registers it, so a faulty disable manager cannot hide
  // its deletion by registering it again on reload.
  const foreign='self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));';
  for(const directory of [enabled,disabled,...Object.values(faults)])write(path.join(directory,'unrelated-worker/sw.js'),foreign);
  write(path.join(enabled,'foreign-bootstrap.js'),'void navigator.serviceWorker.register("/unrelated-worker/sw.js",{scope:"/unrelated-worker/"});');
  for(const prefix of ['','/zh','/zh-tw']) {
    const file=path.join(enabled,prefix+page,'index.html');
    write(file,fs.readFileSync(file,'utf8').replace('</head>','<script defer src="/foreign-bootstrap.js"></script></head>'));
  }
},{timeout:60000});
after(()=>{if(work){assert.equal(path.dirname(work),parent);assert.ok(path.basename(work).startsWith('banyan-browser-disable-'));fs.rmSync(work,{recursive:true,force:true});}});

test('disable declarations expose an explicit disable build and a configurable page',()=>{
  assert.throws(()=>parseArguments(command(),[]),/--next is required/);
  assert.equal(parseArguments(command(),['enabled','--next','disabled']).page,'/');
  for(const value of ['https://example.invalid/','//example.invalid/'])assert.throws(()=>parseArguments(command(),['--next','disabled','--page',value]));
  assert.equal(parseArguments(command(),['--next','disabled','--page','/page/#fragment']).page,'/page/#fragment');
  for(const flag of ['next','page'])assert.match(helpFor(command()),new RegExp('--'+flag+' <'));
});

test('real disable worker and manager independently clean while preserving other scopes and storage',{timeout:20000},()=>{
  for(const selected of [page,'/zh'+page+'?keep=yes','/']) {
    const state=report(cli(['--page',selected,'--trace','--out',path.join(work,'reports')]));
    assert.equal(state.details.after.controller,'');assert.equal(state.details.worker.registrations.some(registration=>new URL(registration.scope).pathname==='/'),true);
    assert.equal(state.details.manager.cacheKeys.some(key=>key.startsWith('nav-html-')),false);
    if(selected!=='/') {
      assert.equal(state.details.before.registrations.length,2);assert.equal(state.details.after.registrations.length,1);
      assert.ok(state.details.after.registrations[0].scope.endsWith('/unrelated-worker/'));
    }
  }
});

test('cleanup rejects off mode, enable destinations and absent manager scripts',{timeout:15000},()=>{
  fails(enabled,off,/one disable manager/);fails(enabled,enabled,/one disable manager/);fails(disabled,enabled,/one enable manager/);
  const missing=path.join(work,'missing-manager');fs.cpSync(disabled,missing,{recursive:true});
  const file=path.join(missing,page,'index.html'),html=fs.readFileSync(file,'utf8');
  const changed=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,script=>script.includes('sw-manager.disable.')?'':script);
  assert.notEqual(changed,html);write(file,changed);fails(enabled,missing,/one disable manager/);
});

test('worker-phase faults cannot pass through a working page manager',{timeout:20000},()=>{
  for(const name of ['worker-waits','worker-no-clean'])fails(enabled,faults[name],/disable worker must take control and remove managed caches before reload/);
});

test('worker cleanup preserves unrelated cache contents',{timeout:10000},()=>{
  fails(enabled,faults['worker-clear-all'],/preserve unrelated cache contents/);
});

test('manager-phase faults cannot pass through an already clean worker',{timeout:15000},()=>{
  for(const name of ['manager-no-unregister','manager-no-clean'])fails(enabled,faults[name],/disable manager must unregister the root worker and clear managed caches/);
});

test('manager cleanup preserves unrelated caches, other registrations and site storage',{timeout:20000},()=>{
  for(const [name,message] of [['manager-clear-all',/preserve unrelated cache contents/],['manager-unregister-all',/registrations in other scopes/],['manager-clear-storage',/localStorage/]])fails(enabled,faults[name],message);
});

test('disable artifacts cannot be written into either build',{timeout:10000},()=>{
  for(const directory of [enabled,disabled]) {
    const out=path.join(directory,'forbidden-reports'),result=cli(['--out',out]);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/outside the published build/);assert.equal(fs.existsSync(out),false);
  }
});
