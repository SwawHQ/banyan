import assert from 'node:assert/strict';
import {waiting} from '../_shared/state.mjs';
import {builds,visit,update,rootLink,panelState,version,oldCaches,clearedCaches,observe,quiet,settled} from '../_shared/update.mjs';

export async function check({page,context=page.context(),server,baseUrl,options}) {
  const pair=await builds(options),target=new URL(options.page,baseUrl).href,from=new URL(options.from,baseUrl).href;
  assert.notEqual(from,target,'Check and linked pages must differ.');
  const events=observe(page);
  try {
    await server.setRoot(pair.old);await visit(page,target,options.timeout);
    const before=await version(page),cachesBefore=await oldCaches(page,options.timeout);
    const action=page.locator('[data-site-update-action="check"]');
    await panelState(page,'current');
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
    assert.equal(await version(page),before,'Checking must not apply the next build.');
    quiet(events);await action.evaluate(node=>{node.style.visibility='';});
    await (await rootLink(page,from)).click();await page.waitForURL(from,{waitUntil:'load'});
    await (await rootLink(page,target)).click();await page.waitForURL(target,{waitUntil:'load'});
    await panelState(page,'current');const after=await version(page);
    assert.notEqual(after,before,'Explicit page navigation must apply the waiting build.');
    const cachesAfter=await clearedCaches(page,cachesBefore,options.timeout);quiet(events);
    return {page:options.page,before,after,cachesBefore,cachesAfter,offlineRetry:true,repeatedChecks:true,hiddenControl:true};
  }finally{await context.setOffline(false);events.stop();}
}
