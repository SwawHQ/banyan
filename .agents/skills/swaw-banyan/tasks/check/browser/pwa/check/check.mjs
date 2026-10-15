import assert from 'node:assert/strict';
import {active,waiting} from '../_shared/state.mjs';
import {builds,visit,update,rootLink,panelState,version,oldCaches,observe,quiet,settled} from '../_shared/update.mjs';

export async function check({page,context=page.context(),server,baseUrl,options}) {
  const pair=await builds(options),target=new URL(options.page,baseUrl).href,from=new URL(options.from,baseUrl).href;
  assert.notEqual(from,target,'Check and linked pages must differ.');
  const events=observe(page);
  try {
    await context.addInitScript(()=>{
      window.__swbanUpdateChecks=0;
      const update=ServiceWorkerRegistration.prototype.update;
      ServiceWorkerRegistration.prototype.update=function(...args){
        window.__swbanUpdateChecks++;return update.apply(this,args);
      };
    });
    await page.clock.install();
    await server.setRoot(pair.old);await visit(page,target,options.timeout);
    const before=await version(page),cachesBefore=await oldCaches(page,options.timeout);
    await page.evaluate(()=>{
      window.__swbanOldController=navigator.serviceWorker.controller;
      sessionStorage.removeItem('__swbanControllerChanged');
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        sessionStorage.setItem('__swbanControllerChanged','true');
      },{once:true});
    });
    const action=page.locator('[data-site-update-action="check"]');
    await panelState(page,'current');
    assert.equal(await page.evaluate(()=>window.__swbanUpdateChecks),0,'A new document must not check for updates automatically.');
    await page.clock.fastForward('16:00');
    assert.equal(await page.evaluate(()=>window.__swbanUpdateChecks),0,'Elapsed time must not check for updates.');
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    assert.equal(await page.evaluate(()=>window.__swbanUpdateChecks),0,'Visibility changes must not check for updates.');
    await context.setOffline(true);await action.click();await panelState(page,'offline');
    await context.setOffline(false);await action.click();await panelState(page,'current');
    await server.setRoot(pair.next);await action.click();await waiting(page,options.timeout);await panelState(page,'ready');
    const label=await action.textContent();events.loads=0;
    for(let n=0;n<2;n++){await action.click();await panelState(page,'ready');}
    // Hidden controls cannot enable a confirmation fallback or activate a worker.
    await action.evaluate(node=>{node.style.visibility='hidden';});
    await update(page,options.timeout);await update(page,options.timeout);await panelState(page,'ready');
    await settled(page);await waiting(page,options.timeout);
    assert.equal(events.loads,0,'Repeated checks and hidden controls must not reload the page.');
    assert.equal(page.url(),target,'Checks must preserve the reading URL.');
    assert.equal(await action.textContent(),label,'Repeated checks must restore the check label.');
    assert.equal(await version(page),before,'Checking must not replace the current document.');
    assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller===window.__swbanOldController),true,
      'Manual checks must retain the old controller.');
    quiet(events);await action.evaluate(node=>{node.style.visibility='';});
    await (await rootLink(page,from)).click();await page.waitForURL(from,{waitUntil:'load'});
    await (await rootLink(page,target)).click();await page.waitForURL(target,{waitUntil:'load'});
    await active(page,options.timeout);await panelState(page,'current');const after=await version(page);
    assert.equal(await page.evaluate(()=>window.__swbanUpdateChecks),0,'The destination document must not check for updates automatically.');
    const controllerChanged=await page.evaluate(()=>{
      const changed=sessionStorage.getItem('__swbanControllerChanged')==='true';
      sessionStorage.removeItem('__swbanControllerChanged');return changed;
    });
    assert.equal(controllerChanged,true,'Explicit page navigation must change the controlling worker.');
    assert.equal(await page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting)),false,
      'Explicit page navigation must activate its waiting worker.');
    const cachesAfter=await page.evaluate(()=>caches.keys());quiet(events);
    return {page:options.page,before,after,cachesBefore,cachesAfter,controllerChanged,automaticChecks:false,offlineRetry:true,repeatedChecks:true,hiddenControl:true};
  }finally{await context.setOffline(false);events.stop();}
}
