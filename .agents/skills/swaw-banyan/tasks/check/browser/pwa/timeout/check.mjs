import assert from 'node:assert/strict';
import {waiting} from '../_shared/state.mjs';
import {builds,visit,update,rootLink,version,oldCaches,observe,quiet,settled} from '../_shared/update.mjs';

export async function checkNavigationFailure({page,server,baseUrl,options},interrupt) {
  const pair=await builds(options),target=new URL(options.page,baseUrl).href,from=new URL(options.from,baseUrl).href;
  assert.notEqual(from,target,'Activation failures need a requested cross-page navigation.');
  const events=observe(page);
  try {
    await server.setRoot(pair.old);await visit(page,target,options.timeout);const before=await version(page);
    await visit(page,from,options.timeout);const cachesBefore=await oldCaches(page,options.timeout);
    await server.setRoot(pair.next);await update(page,options.timeout);await page.evaluate(interrupt);
    events.loads=0;await (await rootLink(page,target)).click();await page.waitForURL(target,{waitUntil:'load'});await settled(page);
    assert.equal(events.loads,1,'Failed activation must allow only the requested navigation.');
    assert.equal(page.url(),target,'Failed activation must preserve the link destination.');
    await waiting(page,options.timeout);assert.equal(await version(page),before,'Failed activation must retain the active build.');
    const cachesAfter=await page.evaluate(()=>caches.keys());
    for(const key of cachesBefore)assert.ok(cachesAfter.includes(key),'Failed activation must preserve cache '+key+'.');
    quiet(events);return {from:options.from,page:options.page,version:before,cachesBefore,cachesAfter,loads:1,waiting:true};
  }finally{events.stop();}
}

export function check(args) {
  return checkNavigationFailure(args,()=>{
    const post=ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage=function(message,...args){
      if(message?.type==='SKIP_WAITING')return;
      return post.call(this,message,...args);
    };
  });
}
