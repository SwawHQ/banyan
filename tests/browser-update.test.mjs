import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {command as activateCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/activate/options.mjs';
import {command as languageCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/language/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan');
const parent=fs.realpathSync(os.tmpdir()),panel='/prefs/update/',from='/reader-start/',language='/prefs/locale/';
const versions=['v20261010000001','v20261010000002'];
let work,skill,old,next,off;
const faults={};
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(name,args=[],directory=old,newBuild=next){
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/pwa/'+name,directory,
    '--next',newBuild,...(args.includes('--page')?[]:['--page',panel]),...(args.includes('--from')?[]:['--from',from]),...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function report(result){
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
function languageCLI(page=language,to='zh',directory=old){
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/pwa/language',directory,
    '--next',next,'--page',page,'--to',to,'--out',path.join(work,'reports')],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-update-'));skill=path.join(work,'skill');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime=process.versions.bun?'bun':'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun??process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  for(const lang of ['en','zh','zh-tw']) {
    const prefix=lang==='en'?'':'/'+lang,suffix=lang==='en'?'':'.'+lang;
    for(const [name,url] of [['powered-by',panel],['language',language]]) {
      let text=fs.readFileSync(path.join(root,'module/content/'+name+'/index'+suffix+'.md'),'utf8').replace(/^---\r?\n/,'---\nurl: '+prefix+url+'\n');
      if(name==='powered-by')for(const [key,value] of Object.entries({yes:lang+' worker yes',no:lang+' worker no'}))
        text=text.replace(new RegExp('^    '+key+':.*$','m'),'    '+key+': '+JSON.stringify(value));
      write(path.join(content,name+'/index'+suffix+'.md'),text);
    }
    write(path.join(content,'reader-start/index'+suffix+'.md'),'---\ntitle: Independent update source\nslug: reader-start\nurl: '+prefix+from+'\nlayout: page-article\nroot_nav: true\nicon: code\nweight: 87\nbuild:\n  list: local\n---\n\nIndependent update source.');
  }
  const mounts='[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n';
  const build=(name,version=versions[0],asset,code,mode='enable')=>{
    const assets=path.join(work,name+'-assets');
    if(asset)write(path.join(assets,'js/pwa/'+asset),code);
    const data=path.join(work,name+'-data');
    write(path.join(data,'delivery.toml'),'[service_worker]\nmode = "'+mode+'"\n');
    write(config,mounts+(asset?'[[module.mounts]]\nsource = '+JSON.stringify(assets.replaceAll('\\','/'))+'\ntarget = "assets"\n[[module.mounts]]\nsource = "assets"\ntarget = "assets"\n':'')+
      '[[module.mounts]]\nsource = '+JSON.stringify(data.replaceAll('\\','/'))+'\ntarget = "data"\n'+
      '[[module.mounts]]\nsource = "data"\ntarget = "data"\n[params.build]\nversion = "'+version+'"\n');
    const destination=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',destination],
      {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return destination;
  };
  old=build('old');next=build('next',versions[1]);off=build('off',versions[0],undefined,undefined,'off');
  const worker=fs.readFileSync(path.join(root,'module/assets/js/pwa/worker-enable.js.tmpl'),'utf8');
  const navigation=fs.readFileSync(path.join(root,'module/assets/js/pwa/navigation.js'),'utf8');
  const engine=fs.readFileSync(path.join(root,'module/assets/js/pwa/update-engine.js'),'utf8');
  for(const [name,asset,input,search,replacement,version] of [
    ['auto-activate','worker-enable.js.tmpl',worker,"self.addEventListener('install',", "self.addEventListener('install', () => { void self.skipWaiting(); });\nself.addEventListener('install',",versions[1]],
    ['old-cache','worker-enable.js.tmpl',worker,'return shouldDeleteVersionedCache(key, NAVIGATION_CACHE, VERSIONED_ASSET_CACHE);','return false;',versions[1]],
    ['reload-reader','update-engine.js',engine,"navigator.serviceWorker.addEventListener('controllerchange', () => {", "navigator.serviceWorker.addEventListener('controllerchange', () => { if (document.querySelector('#swban-unsaved-draft')) location.reload(); });\nnavigator.serviceWorker.addEventListener('controllerchange', () => {",versions[0]],
    ['check-activates','update-engine.js',engine,'if (bindWaitingWorker(runtime, registration)) return;','if (bindWaitingWorker(runtime, registration)) { void activateWaitingWorker(runtime); return; }',versions[0]],
    ['ignore-cancel','navigation.js',navigation,'const cancelNavigation = () => { navigationId++; navigating = false; };','const cancelNavigation = () => {};',versions[0]],
    ['blocks-failure','navigation.js',navigation,'await runtime.updates.activate();','if (!(await runtime.updates.activate())) return;',versions[0]],
    ['clears-failure','navigation.js',navigation,'await runtime.updates.activate();','await runtime.updates.activate(); await Promise.all((await caches.keys()).map(key => caches.delete(key)));',versions[0]],
    ['native-activates','update-engine.js',engine,'function markBackgroundUpdateChecked(runtime, registration) {','function markBackgroundUpdateChecked(runtime, registration) { if (registration?.waiting) void activateWaitingWorker(runtime);',versions[0]],
    ['captures-modifiers','navigation.js',navigation,'|| event.metaKey || event.ctrlKey || event.shiftKey || event.altKey','',versions[0]]
  ]) {
    assert.ok(input.includes(search),'Fault must alter real source: '+name);
    faults[name]=build(name,version,asset,input.replace(search,replacement));
  }
  faults['delayed-reload']=path.join(work,'delayed-reload');fs.cpSync(next,faults['delayed-reload'],{recursive:true});
  write(path.join(faults['delayed-reload'],'delayed-reload.js'),'setTimeout(()=>location.reload(),3500);');
  const document=path.join(faults['delayed-reload'],panel,'index.html');
  write(document,fs.readFileSync(document,'utf8').replace('</head>','<script defer src="/delayed-reload.js"></script></head>'));
},{timeout:60000});
after(()=>{if(work){assert.equal(path.dirname(work),parent);assert.ok(path.basename(work).startsWith('banyan-browser-update-'));fs.rmSync(work,{recursive:true,force:true});}});

test('update declarations require the next build and describe all paths',()=>{
  assert.throws(()=>parseArguments(activateCommand(),[]),/--next is required/);
  assert.throws(()=>parseArguments(activateCommand(),['--next','new','--page','https://example.invalid/']));
  const options=parseArguments(activateCommand(),['old','--next','new']);
  assert.equal(options.page,'/powered-by/');assert.equal(options.from,'/about/');
  for(const flag of ['next','page','from'])assert.match(helpFor(activateCommand()),new RegExp('--'+flag+' <'));
  assert.throws(()=>parseArguments(languageCommand(),['--next','new']),/--to is required/);
  assert.throws(()=>parseArguments(languageCommand(),['--next','new','--to','bad value']),/language code/);
});

test('update artifacts cannot be written inside either published build',{timeout:10000},()=>{
  for(const directory of [old,next]) {
    const destination=path.join(directory,'forbidden-reports'),result=cli('activate',['--out',destination]);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/outside the published build/);
    assert.equal(fs.existsSync(destination),false);
  }
});

test('checks retry offline, remain quiet when hidden and activate only on a native link',{timeout:15000},()=>{
  const state=report(cli('check',['--out',path.join(work,'reports')]));
  assert.equal(state.details.before,versions[0]);assert.equal(state.details.after,versions[1]);assert.ok(state.details.hiddenControl);
});

test('link activation replaces cached destinations and preserves unsaved reader tabs in two languages',{timeout:30000},()=>{
  for(const prefix of ['','/zh']) {
    const state=report(cli('activate',['--page',prefix+panel,'--from',prefix+from,'--trace','--out',path.join(work,'reports')]));
    assert.equal(state.details.before,versions[0]);assert.equal(state.details.after,versions[1]);assert.equal(state.details.readerPreserved,true);
    assert.ok(state.details.cachesBefore.some(key=>key.endsWith(versions[0])));assert.ok(state.details.cachesAfter.some(key=>key.endsWith(versions[1])));
  }
});

test('native refresh, history, anchors and middle-click keep the installed update waiting',{timeout:15000},()=>{
  const state=report(cli('native',['--out',path.join(work,'reports')]));assert.equal(state.details.waitingAfter.length,5);
});

test('a later anchor cancels the actual pending activation navigation',{timeout:15000},()=>{
  assert.equal(report(cli('cancel',['--out',path.join(work,'reports')])).details.canceled,true);
});

test('timeout and synchronous errors both preserve storage and permit one navigation',{timeout:30000},()=>{
  for(const name of ['timeout','error']) {
    const state=report(cli(name,['--out',path.join(work,'reports')]));assert.equal(state.details.loads,1);assert.equal(state.details.waiting,true);
  }
});

test('waiting updates preserve native language links and the selected translation',{timeout:15000},()=>{
  for(const [page,to] of [[language,'zh'],['/zh'+language,'en']])assert.equal(report(languageCLI(page,to)).details.to,to);
});

test('update checks reject identical builds and disabled workers',{timeout:10000},()=>{
  const same=path.join(work,'same-bytes');fs.cpSync(old,same,{recursive:true});
  for(const [directory,newBuild,message] of [[old,old,/different build directories/],[old,same,/different sw.js bytes/],[off,next,/SW-enabled/]]) {
    const result=cli('activate',['--timeout','1000'],directory,newBuild);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('activation rejects automatic updates and retained old navigation caches',{timeout:15000},()=>{
  for(const [name,message] of [['auto-activate',/waiting service worker|retained|new controller/],['old-cache',/old navigation caches/]]) {
    const result=cli('activate',['--timeout','1500'],old,faults[name]);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('activation rejects reloading another reader tab',{timeout:15000},()=>{
  const result=cli('activate',['--timeout','1500'],faults['reload-reader']);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/other tab|preserve another tab|Timeout|Execution context was destroyed/);
});

test('activation observes delayed reloads beyond navigation completion',{timeout:15000},()=>{
  const result=cli('activate',[],old,faults['delayed-reload']);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/delayed reload/);
});

test('manual and native checks detect unwanted activation',{timeout:15000},()=>{
  for(const [name,fault] of [['check','check-activates'],['native','native-activates']]) {
    const result=cli(name,['--timeout','1500'],faults[fault]);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/waiting service worker|Timeout|active build|reload/);
  }
});

test('native checks reject capturing modifier clicks to another document',{timeout:15000},()=>{
  const result=cli('native',['--timeout','1500'],faults['captures-modifiers']);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/Timeout|waiting service worker/);
});

test('cancel detects an activation redirect overriding the later anchor',{timeout:15000},()=>{
  const result=cli('cancel',[],faults['ignore-cancel']);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/cancel the pending page redirect/);
});

test('failed activation cannot block navigation or delete existing caches',{timeout:20000},()=>{
  for(const [name,message] of [['blocks-failure',/Timeout/],['clears-failure',/preserve cache|retain the active build/]]) {
    const result=cli('error',['--timeout','1500'],faults[name]);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});
