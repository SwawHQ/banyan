import assert from 'node:assert/strict';
import {waiting} from '../_shared/state.mjs';
import {builds,visit,update,rootLink,observe,quiet,settled} from '../_shared/update.mjs';

export async function check({page,server,baseUrl,options}) {
  const pair=await builds(options),from=new URL(options.from,baseUrl).href,target=new URL(options.page,baseUrl).href;
  assert.notEqual(from,target,'Cancellation needs a pending cross-page navigation.');
  const events=observe(page);
  try {
    await server.setRoot(pair.old);await visit(page,from,options.timeout);
    await server.setRoot(pair.next);await update(page,options.timeout);
    await page.evaluate(()=>{
      const post=ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage=function(message,...args){
        if(message?.type==='SKIP_WAITING'){window.__swbanActivationRequested=true;return;}
        return post.call(this,message,...args);
      };
      window.__swbanReading='preserved';
      const anchor=document.createElement('a');anchor.id='swban-cancel-anchor';anchor.href='#main';anchor.textContent='Stay here';document.body.prepend(anchor);
    });
    events.loads=0;await (await rootLink(page,target)).click();
    await page.waitForFunction(()=>window.__swbanActivationRequested===true);
    await page.locator('#swban-cancel-anchor').click();await settled(page);
    assert.equal(page.url(),from+'#main','A later anchor must cancel the pending page redirect.');
    assert.equal(await page.evaluate(()=>window.__swbanReading),'preserved','Cancellation must preserve the reading document.');
    assert.equal(events.loads,0,'Canceled navigation must not load another document.');
    await waiting(page,options.timeout);quiet(events);
    return {from:options.from,page:options.page,canceled:true,waiting:true,loads:0};
  }finally{events.stop();}
}
