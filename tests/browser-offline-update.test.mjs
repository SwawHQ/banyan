import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {runScenarioSuite} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/suite.mjs';
import {visit,update,observe,quiet,settled} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/_shared/update.mjs';
import {waitForState} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/_shared/state.mjs';
import {verifyCspOutput} from '../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),parent=fs.realpathSync.native(os.tmpdir());
const versions=['v20261015001001','v20261015001002'];
let work,old,next,disabled,third,replacement;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
async function contentVersion(page){return page.evaluate(async()=>{
  const response=await (await caches.open('sw-content-state')).match(new URL('/sw-version.json',location.href));
  return (await response?.json())?.version;
});}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-offline-update-'));
  const delivery=fs.readFileSync(path.join(root,'module/data/banyan/delivery.toml'),'utf8');
  const routes=delivery.slice(delivery.indexOf('[[routes]]'));
  const build=(name,version,mode='enable')=>{
    const content=path.join(work,name+'-content'),data=path.join(work,name+'-data'),config=path.join(work,name+'.toml');
    const offline=name==='old'?'offline':name==='third'?'offline-third':'offline-next';
    for(const lang of ['en','zh','zh-tw']){
      const prefix=lang==='en'?'':'/'+lang,suffix=lang==='en'?'':'.'+lang;
      const text=fs.readFileSync(path.join(root,'module/content/offline/index'+suffix+'.md'),'utf8')
        .replace(/^---\r?\n/,'---\nurl: '+prefix+'/'+offline+'/\n')
        .replace(/^title:.*$/m,'title: "Offline fixture '+name+'"');
      write(path.join(content,'offline/index'+suffix+'.md'),text);
    }
    write(path.join(data,'delivery.toml'),'[service_worker]\nmode = "'+mode+'"\ncontent_check_interval = 5\noffline_notice_path = "'+offline+'/"\n'+routes+
      (name==='next'?'\n[[routes]]\npath = "/*offline-next/"\nhttp.headers.Vary = "Accept"\n':''));
    write(config,[['content',content],['content','content'],['data',data],['data','data']]
      .map(([target,directory])=>'[[module.mounts]]\nsource = '+JSON.stringify(directory.replaceAll('\\','/'))+'\ntarget = "'+target+'"\n').join('')+
      '[params.build]\nversion = "'+version+'"\n');
    const destination=path.join(work,name),result=spawnSync(toolExecutable('hugo'),
      ['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',destination],
      {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
    verifyCspOutput(destination);return destination;
  };
  old=build('old',versions[0]);next=build('next',versions[1]);
  disabled=build('disabled',versions[1],'disable');third=build('third',versions[1]);
  replacement=path.join(work,'replacement');fs.cpSync(next,replacement,{recursive:true});
  for(const prefix of ['','zh','zh-tw']){
    const file=path.join(replacement,prefix,'offline-next/index.html');
    write(file,fs.readFileSync(file,'utf8').replaceAll('Offline fixture next','Offline fixture replacement'));
  }
  assert.deepEqual(fs.readFileSync(path.join(next,'sw.js')),fs.readFileSync(path.join(replacement,'sw.js')));
  verifyCspOutput(replacement);
  assert.notEqual(fs.readFileSync(path.join(old,'sw.js'),'utf8'),fs.readFileSync(path.join(next,'sw.js'),'utf8'));
},{timeout:60000});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync.native(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('program updates preserve offline pages across path changes, disable mode and replaced waiting workers',{timeout:60000},async()=>{
  const result=await runScenarioSuite({primaryBuildDir:old,outputDir:path.join(work,'reports'),timeout:15000,
    scenarios:[{id:'offline-path-update',kind:'single',async run({page,context,baseUrl,server}){
      await visit(page,baseUrl+'/');
      assert.equal(await contentVersion(page),versions[0]);
      await context.setOffline(true);
      const initial=await page.goto(baseUrl+'/uncached-before-update/',{waitUntil:'load'});
      assert.ok(initial?.ok()&&initial.fromServiceWorker());
      assert.match(await page.title(),/^Offline fixture old(?: - |$)/);
      await context.setOffline(false);
      await page.evaluate(()=>{window.originalController=navigator.serviceWorker.controller;});
      await server.setRoot(next);
      for(const prefix of ['','/zh','/zh-tw']){
        const response=await context.request.get(baseUrl+prefix+'/offline-next/');
        assert.ok(response.ok());assert.equal(response.headers().vary,'Accept');
      }
      await update(page);
      assert.equal(await contentVersion(page),versions[0],'Installation must not switch the active content version.');
      const prepared=await page.evaluate(async()=>Promise.all(['','/zh','/zh-tw'].map(async prefix=>
        Boolean((await caches.match(new Request(new URL(prefix+'/offline-next/',location.href),{headers:{Accept:'text/html'}})))?.ok))));
      assert.deepEqual(prepared,[true,true,true],'Every language fallback must be ready before activation.');
      assert.equal(await page.evaluate(async()=>(await caches.keys()).filter(key=>key.startsWith('sw-program-offline-')).length),1);
      const observed=observe(page);
      try{
        await context.setOffline(true);
        const activationRequests=[],onRequest=request=>activationRequests.push(request.url());
        context.on('request',onRequest);
        try{
          await page.evaluate(async()=>{(await navigator.serviceWorker.getRegistration()).waiting.postMessage({type:'SKIP_WAITING'});});
          await waitForState(()=>page.evaluate(async()=>{
            const registration=await navigator.serviceWorker.getRegistration();
            return registration?.active?.state==='activated'&&navigator.serviceWorker.controller!==window.originalController;
          }),
            4000,'The prepared program must activate offline within the navigation deadline.');
        }finally{context.off('request',onRequest);}
        assert.deepEqual(activationRequests,[],'Activation must restore prepared pages without network requests.');
        assert.equal(observed.loads,0,'Activation must not reload the reader.');
        assert.equal(await page.evaluate(async()=>(await caches.keys()).filter(key=>key.startsWith('sw-program-offline-')).length),0,
          'Activation must remove its temporary program cache.');
        for(const prefix of ['','/zh','/zh-tw']){
          const response=await page.goto(baseUrl+prefix+'/uncached-after-update/',{waitUntil:'load'});
          assert.ok(response?.ok()&&response.fromServiceWorker(),'The new fallback must work before a background content check.');
          assert.match(await page.title(),/^Offline fixture next(?: - |$)/);
          assert.ok(await page.locator('main').isVisible());
        }
        await settled(page);
        assert.equal(observed.loads,3);assert.equal(observed.navigationRequests,3);quiet(observed);
        assert.equal(await contentVersion(page),versions[0],'Offline fallback preparation must retain the active content version.');
      }finally{observed.stop();await context.setOffline(false);}
    }},{id:'offline-enable-after-disable',kind:'single',async run({page,context,baseUrl,server}){
      await visit(page,baseUrl+'/');
      await page.evaluate(()=>{window.originalController=navigator.serviceWorker.controller;});
      await server.setRoot(disabled);
      // Keep the enable document open so the disable manager cannot unregister the worker.
      await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
      await waitForState(()=>page.evaluate(async()=>{
        const registration=await navigator.serviceWorker.getRegistration();
        return registration?.active?.state==='activated'&&navigator.serviceWorker.controller!==window.originalController&&
          !(await caches.keys()).includes('sw-content-state');
      }),15000,'The active disable worker must clear metadata without unregistering.');
      await page.evaluate(()=>{window.disabledController=navigator.serviceWorker.controller;});
      await server.setRoot(next);await update(page);
      const stagedVersion=await page.evaluate(async()=>{
        const key=(await caches.keys()).find(key=>key.startsWith('sw-program-offline-'));
        const response=key?await (await caches.open(key)).match(new URL('/sw-version.json',location.href)):null;
        return (await response?.json())?.version;
      });
      assert.equal(stagedVersion,versions[1],'Re-enabling must prepare its content version before the worker waits.');
      assert.equal(await contentVersion(page),undefined,'Installation must leave the active metadata unchanged.');
      await context.setOffline(true);
      try{
        await page.evaluate(async()=>{(await navigator.serviceWorker.getRegistration()).waiting.postMessage({type:'SKIP_WAITING'});});
        await waitForState(()=>page.evaluate(async()=>{
          const registration=await navigator.serviceWorker.getRegistration();
          return registration?.active?.state==='activated'&&navigator.serviceWorker.controller!==window.disabledController;
        }),4000,'The re-enabled worker must activate while offline.');
        const response=await page.goto(baseUrl+'/uncached-after-disable/',{waitUntil:'load'});
        assert.ok(response?.ok()&&response.fromServiceWorker());
        assert.match(await page.title(),/^Offline fixture next(?: - |$)/);
        assert.equal(await contentVersion(page),versions[1],'Offline activation must publish the prepared content version.');
      }finally{await context.setOffline(false);}
    }},{id:'offline-reinstalled-waiting-program',kind:'single',async run({page,context,baseUrl,server}){
      await visit(page,baseUrl+'/');
      const requests=[],onRequest=request=>{if(new URL(request.url()).pathname.endsWith('/offline-next/'))requests.push(request.url());};
      for(const directory of [next,third,replacement]){
        await page.evaluate(async()=>{window.previousWaiting=(await navigator.serviceWorker.getRegistration()).waiting;});
        await server.setRoot(directory);
        if(directory===replacement)context.on('request',onRequest);
        try{
          await update(page);
          await waitForState(()=>page.evaluate(async()=>{
            const worker=(await navigator.serviceWorker.getRegistration()).waiting;
            return worker?.state==='installed'&&worker!==window.previousWaiting;
          }),15000,'Each published program must replace the previous waiting worker.');
        }finally{context.off('request',onRequest);}
      }
      assert.equal(requests.length,3,'Reinstalling the same program must fetch its current offline pages again.');
      assert.equal(await contentVersion(page),versions[0]);
      await page.evaluate(()=>{window.originalController=navigator.serviceWorker.controller;});
      await context.setOffline(true);
      try{
        await page.evaluate(async()=>{(await navigator.serviceWorker.getRegistration()).waiting.postMessage({type:'SKIP_WAITING'});});
        await waitForState(()=>page.evaluate(async()=>{
          const registration=await navigator.serviceWorker.getRegistration();
          return registration?.active?.state==='activated'&&navigator.serviceWorker.controller!==window.originalController;
        }),4000,'The refreshed waiting program must activate offline.');
        for(const prefix of ['','/zh','/zh-tw']){
          const response=await page.goto(baseUrl+prefix+'/uncached-after-reinstallation/',{waitUntil:'load'});
          assert.ok(response?.ok()&&response.fromServiceWorker());
          assert.match(await page.title(),/^Offline fixture replacement(?: - |$)/);
        }
      }finally{await context.setOffline(false);}
    }}]});
  assert.equal(result.totals.failed,0,result.scenarios.filter(value=>value.status==='failed').map(value=>value.message).join('\n'));
});
