import assert from 'node:assert/strict';
import {waiting} from '../_shared/state.mjs';
import {builds,visit,update,panelState,version,observe,quiet,settled} from '../_shared/update.mjs';

export async function check({page,context=page.context(),server,baseUrl,options}) {
  const pair=await builds(options),target=new URL(options.page,baseUrl).href,events=observe(page);
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
    const before=await version(page);
    await page.evaluate(()=>{window.__swbanOldController=navigator.serviceWorker.controller;});
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
    await action.evaluate(node=>{node.style.visibility='hidden';});
    await update(page,options.timeout);await update(page,options.timeout);await panelState(page,'ready');
    await settled(page);await waiting(page,options.timeout);
    assert.equal(events.loads,0,'Repeated checks and hidden controls must not reload the page.');
    assert.equal(page.url(),target,'Checks must preserve the reading URL.');
    assert.equal(await action.textContent(),label,'Repeated checks must restore the check label.');
    assert.equal(await version(page),before,'Checking must not replace the current document.');
    assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller===window.__swbanOldController),true,
      'Manual checks must retain the old controller.');
    quiet(events);
    return {page:options.page,before,after:await version(page),controllerPreserved:true,waiting:true,
      automaticChecks:false,offlineRetry:true,repeatedChecks:true,hiddenControl:true};
  }finally{await context.setOffline(false);events.stop();}
}
