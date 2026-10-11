import {setTimeout} from 'node:timers/promises';

// Await the result: Playwright's waitForFunction considers a Promise truthy.
export async function waitForState(read,timeout,message) {
  const end=performance.now()+timeout;
  do {
    const value=await read();
    if(value)return value;
    await setTimeout(50);
  }while(performance.now()<end);
  throw new Error(message);
}

export async function active(page,timeout=15000) {
  return waitForState(()=>page.evaluate(async()=>{
    const registration=await navigator.serviceWorker?.getRegistration();
    return registration?.active?.state==='activated'&&navigator.serviceWorker.controller===registration.active
      ?{script:registration.active.scriptURL,scope:registration.scope}:null;
  }),timeout,'The page must have an active controlling service worker.');
}

export async function waiting(page,timeout=15000) {
  return waitForState(()=>page.evaluate(async()=>{
    const registration=await navigator.serviceWorker?.getRegistration();
    return registration?.waiting?.state==='installed'?{script:registration.waiting.scriptURL,scope:registration.scope}:null;
  }),timeout,'The next build must install a waiting service worker.');
}
