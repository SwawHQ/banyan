import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runScenarioSuite} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/suite.mjs';
import {active} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/_shared/state.mjs';
import {panelState} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/_shared/update.mjs';
import {fixtureEnvironment,serviceWorkerPolicy} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {command as lifecycleCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/lifecycle/options.mjs';
import {command as languageCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/language/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan');
const parent=fs.realpathSync.native(os.tmpdir()),panel='/prefs/update/',from='/reader-start/',language='/prefs/locale/';
const versions=['v20261010000001','v20261010000002'];
let work,skill,old,next,off;
const faults={};
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(name,args=[],directory=old,newBuild=next){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/pwa/'+name,'entry.mjs'),directory,
    '--next',newBuild,...(args.includes('--page')?[]:['--page',panel]),...(args.includes('--from')?[]:['--from',from]),...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function report(result){
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
function languageCLI(page=language,to='zh',directory=old){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/pwa/language','entry.mjs'),directory,
    '--next',next,'--page',page,'--to',to,'--out',path.join(work,'reports')],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-update-'));skill=path.join(work,'skill');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime='node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
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
    if(asset)write(path.join(assets,asset),code);
    const data=path.join(work,name+'-data');
    write(path.join(data,'delivery.toml'),serviceWorkerPolicy(mode));
    write(config,mounts+(asset?'[[module.mounts]]\nsource = '+JSON.stringify(assets.replaceAll('\\','/'))+'\ntarget = "assets"\n[[module.mounts]]\nsource = "assets"\ntarget = "assets"\n':'')+
      '[[module.mounts]]\nsource = '+JSON.stringify(data.replaceAll('\\','/'))+'\ntarget = "data"\n'+
      '[[module.mounts]]\nsource = "data"\ntarget = "data"\n[params.build]\nversion = "'+version+'"\n');
    const destination=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',destination],
      {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
    if(mode==='enable')fs.appendFileSync(path.join(destination,'sw.js'),'\n// swban program-update probe: '+version+'\n');
    return destination;
  };
  old=build('old');next=build('next',versions[1]);off=build('off',versions[0],undefined,undefined,'off');
  const manager=fs.readFileSync(path.join(root,'module/assets/js/pwa/manager-entry.js.tmpl'),'utf8').replaceAll('\r\n','\n');
  const panelScript=fs.readFileSync(path.join(root,'module/assets/js/updates/page.js'),'utf8').replaceAll('\r\n','\n');
  const worker=fs.readFileSync(path.join(root,'module/assets/js/pwa/worker-enable.js.tmpl'),'utf8').replaceAll('\r\n','\n');
  for(const [name,input,search,replacement] of [
    ['startup-check',panelScript,'await readRegistration();\n        syncRegistrationStatus();','await readRegistration(); await registration.update();\n        syncRegistrationStatus();'],
    ['polls',panelScript,'const ready = () => {','window.setInterval(() => void checkForUpdates(), 15 * 60 * 1000);\n        const ready = () => {'],
    ['visibility-checks',panelScript,'const ready = () => {',"document.addEventListener('visibilitychange', () => void checkForUpdates());\n        const ready = () => {"]
  ]) {
    assert.ok(input.includes(search),'Fault must alter real source: '+name);
    faults[name]=build(name,versions[0],'js/updates/page.js',input.replace(search,replacement));
  }
  const install="self.addEventListener('install', (event) => {";
  assert.ok(worker.includes(install));
  faults['auto-activate']=build('auto-activate',versions[1],'js/pwa/worker-enable.js.tmpl',worker.replace(install,install+' self.skipWaiting();'));
  faults['captures-modifiers']=build('captures-modifiers',versions[0],'js/pwa/manager-entry.js.tmpl',manager+
    '\ndocument.addEventListener("click",event=>{const link=event.target.closest("a[href]");if(link&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)){event.preventDefault();location.assign(link.href);}});');
  faults['delayed-reload']=build('delayed-reload',versions[0],'js/pwa/manager-entry.js.tmpl',manager+
    '\nif(sessionStorage.getItem("swban-delayed-reload")){sessionStorage.removeItem("swban-delayed-reload");setTimeout(()=>location.reload(),3500);}\n'+
    'document.addEventListener("click",event=>{if(event.target.closest("[data-root-href]"))sessionStorage.setItem("swban-delayed-reload","yes");});');
},{timeout:60000});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync.native(work)),parent);assert.ok(path.basename(work).startsWith('banyan-browser-update-'));fs.rmSync(work,{recursive:true,force:true});}});

test('update declarations require the next build and describe all paths',()=>{
  assert.throws(()=>parseArguments(lifecycleCommand(),[]),/--next is required/);
  assert.throws(()=>parseArguments(lifecycleCommand(),['--next','new','--page','https://example.invalid/']));
  const options=parseArguments(lifecycleCommand(),['old','--next','new']);
  assert.equal(options.page,'/powered-by/');assert.equal(options.from,'/about/');
  for(const flag of ['next','page','from'])assert.match(helpFor(lifecycleCommand(),'en'),new RegExp('--'+flag+' <'));
  assert.throws(()=>parseArguments(languageCommand(),['--next','new']),/--to is required/);
  assert.throws(()=>parseArguments(languageCommand(),['--next','new','--to','bad value']),/language code/);
});

test('update artifacts cannot be written inside either published build',{timeout:10000},()=>{
  for(const directory of [old,next]) {
    const destination=path.join(directory,'forbidden-reports'),result=cli('lifecycle',['--out',destination]);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/outside the published build/);
    assert.equal(fs.existsSync(destination),false);
  }
});

test('manual checks retry offline and retain waiting programs without reloading',{timeout:15000},()=>{
  const state=report(cli('check',['--out',path.join(work,'reports')]));
  assert.equal(state.details.before,versions[0]);assert.equal(state.details.after,versions[0]);assert.ok(state.details.hiddenControl);
  assert.equal(state.details.controllerPreserved,true);assert.equal(state.details.waiting,true);
  assert.equal(state.details.automaticChecks,false);
});

test('checks reject automatic startup and recurring checks',{timeout:15000},()=>{
  for(const fault of ['startup-check','polls','visibility-checks']) {
    const result=cli('check',['--timeout','5000'],faults[fault]);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/must not check/);
  }
});

test('programs wait through ordinary links and activate naturally after all controlled tabs close',{timeout:30000},()=>{
  for(const prefix of ['','/zh']) {
    const state=report(cli('lifecycle',['--page',prefix+panel,'--from',prefix+from,'--trace','--out',path.join(work,'reports')]));
    assert.equal(state.details.before,versions[0]);assert.equal(state.details.readerPreserved,true);
    assert.equal(state.details.naturalActivation,true);assert.equal(state.details.waitingDuringNavigation,true);assert.equal(state.details.loads,1);
  }
});

test('native links, refresh, history, anchors and modifier clicks retain waiting programs',{timeout:15000},()=>{
  const state=report(cli('native',['--out',path.join(work,'reports')]));assert.equal(state.details.waitingAfter.length,6);
});

test('waiting updates preserve native language links and the selected translation',{timeout:15000},()=>{
  for(const [page,to] of [[language,'zh'],['/zh'+language,'en']])assert.equal(report(languageCLI(page,to)).details.to,to);
});

test('update checks reject identical builds and disabled workers',{timeout:10000},()=>{
  const same=path.join(work,'same-bytes');fs.cpSync(old,same,{recursive:true});
  for(const [directory,newBuild,message] of [[old,old,/different build directories/],[old,same,/different sw.js bytes/],[off,next,/SW-enabled/]]) {
    const result=cli('lifecycle',['--timeout','1000'],directory,newBuild);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('lifecycle checks reject automatic activation',{timeout:10000},()=>{
  const result=cli('lifecycle',['--timeout','1500'],old,faults['auto-activate']);
  assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/waiting service worker|old controller|Timeout/);
});

test('lifecycle checks observe delayed reloads beyond navigation completion',{timeout:15000},()=>{
  const result=cli('lifecycle',[],faults['delayed-reload']);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/delayed reload/);
});

test('native checks reject capturing modifier clicks to another document',{timeout:15000},()=>{
  const result=cli('native',['--timeout','1500'],faults['captures-modifiers']);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/Timeout|waiting service worker/);
});

test('the panel reports failed registration and retries without a global runtime',{timeout:30000},async()=>{
  const result=await runScenarioSuite({primaryBuildDir:old,outputDir:path.join(work,'registration-retry'),timeout:15000,
    scenarios:[{id:'panel-registration-retry',kind:'single',async run({page,context,baseUrl}){
      await context.addInitScript(()=>{
        const register=navigator.serviceWorker.register.bind(navigator.serviceWorker);
        navigator.serviceWorker.register=(...args)=>window.__swbanAllowRegistration?register(...args):Promise.reject(new Error('Registration probe'));
      });
      await page.goto(baseUrl+panel,{waitUntil:'load'});await panelState(page,'failed');
      assert.equal(await page.evaluate(()=>typeof window.BanyanServiceWorkerManagerRuntime),'undefined');
      const action=page.locator('[data-site-update-action="check"]');assert.equal(await action.isEnabled(),true);
      await action.click();await panelState(page,'failed');
      await page.evaluate(()=>{window.__swbanAllowRegistration=true;});
      await action.click();await active(page,15000);await panelState(page,'current');
      assert.equal(await action.isEnabled(),true);return {retried:true};
    }}]});
  assert.equal(result.totals.failed,0,result.scenarios.map(value=>value.message).join('\n'));
});
