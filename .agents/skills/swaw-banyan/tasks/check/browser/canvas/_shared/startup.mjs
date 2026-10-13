import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';
import {readCanvas} from './state.mjs';

export async function installStartupProbe(page) {
  await page.addInitScript(()=>{
    if(window.__swbanCanvasStartup)return;
    const probe=window.__swbanCanvasStartup={parsed:null,firstFrameX:null,nav:null,columns:[],domContentLoaded:false};
    document.addEventListener('DOMContentLoaded',()=>{probe.domContentLoaded=true;},{once:true});
    if(PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
      probe.layoutShift=0;
      probe.shifts=new PerformanceObserver(list=>{
        for(const entry of list.getEntries())if(!entry.hadRecentInput)probe.layoutShift+=entry.value;
      });
      probe.shifts.observe({type:'layout-shift',buffered:true});
    }
    const observer=new MutationObserver(()=>{
      if(!document.getElementById('main'))return;
      probe.nav=document.querySelector('[data-slot=breadcrumb]');
      probe.columns=[...document.querySelectorAll('[data-slot=breadcrumb] [data-collection-column]')];
      probe.parsed={columns:probe.columns.length,entryPending:document.documentElement.hasAttribute('data-entry-breadcrumb-pending')};
      observer.disconnect();
      requestAnimationFrame(()=>{probe.firstFrameX=window.visualViewport?.pageLeft??scrollX;});
    });
    observer.observe(document,{childList:true,subtree:true});
  });
}

// The caller supplies a navigation that completes at commit, while scripts stay held.
export async function observeStartup(page,navigate) {
  let release;
  const gate=new Promise(resolve=>{release=resolve;}),held=[];
  const handler=route=>{
    if(route.request().resourceType()!=='script')return route.continue();
    const continued=gate.then(()=>route.continue());held.push(continued);return continued;
  };
  await page.route('**/*',handler);
  let first;
  try {
    await navigate();
    await page.waitForFunction(()=>Number.isFinite(window.__swbanCanvasStartup?.firstFrameX)
      &&!!document.getElementById('main')&&[...document.querySelectorAll('link[rel="stylesheet"]')].every(link=>link.disabled||link.sheet));
    await afterPaint(page);first={...await readCanvas(page),scriptsHeld:held.length};
  } finally {
    release();
    try {await Promise.all(held);}finally{await page.unroute('**/*',handler);}
  }
  await page.waitForLoadState('load');await waitForBrowse(page);await afterPaint(page);
  return {first,final:await readCanvas(page)};
}
