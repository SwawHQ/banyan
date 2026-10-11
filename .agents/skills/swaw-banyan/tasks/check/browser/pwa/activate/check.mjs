import assert from 'node:assert/strict';
import {active,waitForState} from '../_shared/state.mjs';
import {builds,visit,update,rootLink,panelState,version,oldCaches,clearedCaches,observe,quiet,settled} from '../_shared/update.mjs';

export async function check({page,context=page.context(),server,baseUrl,options}) {
  const pair=await builds(options),target=new URL(options.page,baseUrl).href,from=new URL(options.from,baseUrl).href;
  assert.notEqual(from,target,'Activation needs a link to another page.');
  const events=observe(page);let reader,readerEvents;
  try {
    await server.setRoot(pair.old);await visit(page,target,options.timeout);
    const before=await version(page),cachesBefore=await oldCaches(page,options.timeout);
    // The destination has already entered the old cache before the link is used.
    await visit(page,from,options.timeout);const link=await rootLink(page,target);
    reader=await context.newPage();readerEvents=observe(reader);await visit(reader,target,options.timeout);
    await reader.evaluate(()=>{
      window.__swbanOldController=navigator.serviceWorker.controller;
      window.__swbanDraft='preserved';
      const input=document.createElement('textarea');input.id='swban-unsaved-draft';input.value='An unsaved draft';document.body.append(input);
    });
    await server.setRoot(pair.next);await update(page,options.timeout);await update(page,options.timeout);
    assert.equal(page.url(),from,'Update discovery must retain the reading page.');
    events.loads=0;readerEvents.loads=0;
    await link.click();await page.waitForURL(target,{waitUntil:'load'});await active(page,options.timeout);
    assert.equal(await page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting)),false,
      'The link must activate its waiting worker before loading the destination.');
    await waitForState(()=>reader.evaluate(()=>navigator.serviceWorker.controller!==window.__swbanOldController),options.timeout??15000,
      'The other tab must receive the new controller.');
    await panelState(reader,'current');await panelState(page,'current');
    assert.equal(await reader.evaluate(()=>window.__swbanDraft),'preserved','Activation must preserve another tab.');
    assert.equal(await reader.locator('#swban-unsaved-draft').inputValue(),'An unsaved draft','Activation must preserve unsaved input.');
    const after=await version(page);assert.notEqual(after,before,'The cached destination must display the new build.');
    const cachesAfter=await clearedCaches(page,cachesBefore,options.timeout);
    await settled(page);
    assert.equal(events.loads,1,'The requested link must load once without a delayed reload.');
    assert.equal(readerEvents.loads,0,'Updating another controller must not reload its tab.');
    assert.equal(page.url(),target,'Activation must preserve the native link destination.');
    quiet(events);quiet(readerEvents);
    return {from:options.from,page:options.page,before,after,cachesBefore,cachesAfter,readerPreserved:true,loads:events.loads};
  }finally{events.stop();readerEvents?.stop();if(reader)await reader.close();}
}
