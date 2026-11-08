import assert from 'node:assert/strict';
import {waiting} from '../_shared/state.mjs';
import {builds,visit,update,rootLink,panelState,version,naturallyActivate,observe,quiet,settled} from '../_shared/update.mjs';

export async function check({page,context=page.context(),server,baseUrl,options}) {
  const pair=await builds(options),target=new URL(options.page,baseUrl).href,from=new URL(options.from,baseUrl).href;
  assert.notEqual(from,target,'Lifecycle checks need a link to another page.');
  const events=observe(page);let reader,readerEvents,reopened;
  const activationRequests=[],onActivationRequest=request=>activationRequests.push(request.url());
  try {
    await server.setRoot(pair.old);await visit(page,target,options.timeout);
    const before=await version(page);
    await visit(page,from,options.timeout);
    reader=await context.newPage();readerEvents=observe(reader);await visit(reader,target,options.timeout);
    await reader.evaluate(()=>{
      window.__swbanOldController=navigator.serviceWorker.controller;
      const input=document.createElement('textarea');input.id='swban-unsaved-draft';input.value='An unsaved draft';document.body.append(input);
    });
    const workers=context.serviceWorkers();
    await server.setRoot(pair.next);await update(page,options.timeout);await settled(page);
    const program=context.serviceWorkers().find(worker=>!workers.includes(worker));
    assert.ok(program,'The update must start a new worker program.');
    const readContentState=()=>program.evaluate(async()=>{
      const response=await(await caches.open('sw-content-state')).match(new URL('/sw-version.json',self.location.href));
      return response?.json();
    });
    await panelState(reader,'ready');
    events.loads=0;events.navigationRequests=0;readerEvents.loads=0;
    await (await rootLink(page,target)).click();await page.waitForURL(target,{waitUntil:'load'});await waiting(page,options.timeout);
    await settled(page);
    assert.equal(await reader.evaluate(()=>navigator.serviceWorker.controller===window.__swbanOldController),true,
      'Ordinary links must preserve the old controller while another controlled page remains open.');
    assert.equal(await reader.locator('#swban-unsaved-draft').inputValue(),'An unsaved draft','Waiting programs must preserve unsaved input.');
    assert.equal(readerEvents.loads,0,'A program update must not reload another tab.');
    assert.equal(events.loads,1,'The requested link must load once without a delayed reload.');
    assert.equal(events.navigationRequests,1,'The requested link must issue only one navigation request.');
    quiet(events);quiet(readerEvents);
    context.on('request',onActivationRequest);
    try{reopened=await naturallyActivate(page,options.timeout);}finally{context.off('request',onActivationRequest);}
    assert.deepEqual(activationRequests,[],'Natural activation must not request network resources.');
    const state=await readContentState();
    assert.equal(state?.lastAttemptAt,0,'Program activation must persist an immediate check for the next navigation.');
    await visit(reopened,target,options.timeout);await panelState(reopened,'current');
    assert.equal(await reopened.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting)),false,
      'Reopening after all controlled pages close must use the naturally activated worker.');
    return {from:options.from,page:options.page,before,after:await version(reopened),naturalActivation:true,
      readerPreserved:true,waitingDuringNavigation:true,loads:events.loads};
  }finally{
    context.off('request',onActivationRequest);
    events.stop();readerEvents?.stop();if(reader&&!reader.isClosed())await reader.close();if(reopened)await reopened.close();
  }
}
