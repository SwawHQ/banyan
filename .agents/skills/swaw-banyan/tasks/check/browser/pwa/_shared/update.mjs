import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';
import {active,waiting,waitForState} from './state.mjs';

export async function builds(options) {
  assert.ok(options.dir&&options.next,'Update checks require the old build and --next build.');
  const old=await fs.realpath(options.dir),next=await fs.realpath(options.next);
  assert.notEqual(old,next,'Update checks need two different build directories.');
  const scripts=[];
  for(const directory of [old,next]) {
    assert.ok((await fs.stat(path.join(directory,'index.html'))).isFile(),'Both builds must contain index.html.');
    try {scripts.push(await fs.readFile(path.join(directory,'sw.js')));}
    catch(error) {
      if(error.code==='ENOENT')throw new Error('Both update builds must be SW-enabled and contain sw.js.');
      throw error;
    }
  }
  assert.ok(!scripts[0].equals(scripts[1]),'The two builds must contain different sw.js bytes.');
  return {old,next};
}

export async function visit(page,href,timeout=15000) {
  const response=await page.goto(href,{waitUntil:'load'});
  assert.ok(response?.ok(),'Update checks need a successful page response.');
  await waitForBrowse(page);await afterPaint(page);await active(page,timeout);
  assert.equal(page.url(),href,'The update visit must preserve its URL.');
}

export async function update(page,timeout=15000) {
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    if(!registration)throw new Error('No service worker registration.');
    await registration.update();
  });
  return waiting(page,timeout);
}

export async function rootLink(page,href) {
  const links=page.locator('[data-root-navigation] a[data-root-href]');
  const index=await links.evaluateAll((nodes,href)=>nodes.findIndex(node=>node.href===href),href);
  assert.ok(index>=0,'The page must contain a native root link to '+new URL(href).pathname+'.');
  const link=links.nth(index);
  assert.equal(await link.getAttribute('data-site-update-link'),null,'Root links must retain ordinary navigation semantics.');
  return link;
}

export async function panelState(page,status) {
  await page.waitForSelector('[data-site-update-panel][data-site-update-state="'+status+'"]');
  const value=await page.locator('[data-site-update-panel]').evaluate(node=>({
    copy:JSON.parse(node.dataset.siteUpdateCopy),controlled:node.querySelector('[data-pwa-controlled]').textContent,
    hasController:Boolean(navigator.serviceWorker.controller)
  }));
  assert.equal(value.controlled,value.copy[value.hasController?'yes':'no'],'Update status must use the current locale and controller.');
}

export async function version(page) {
  const version=await page.locator('[data-site-update-version]').getAttribute('title');
  assert.ok(version?.trim(),'The update page must expose its build version.');
  return version;
}

export async function oldCaches(page,timeout=15000) {
  return waitForState(()=>page.evaluate(async()=>{
    const keys=await caches.keys();return keys.some(key=>key.startsWith('nav-html-'))?keys:null;
  }),timeout,'The old build must have a navigation cache.');
}

export function observe(page) {
  const value={loads:0,navigationRequests:0,dialogs:[],errors:[]};
  const onLoad=()=>value.loads++,onError=error=>value.errors.push(error.message);
  const onRequest=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())value.navigationRequests++;};
  const onDialog=dialog=>{value.dialogs.push(dialog.type()+': '+dialog.message());void dialog.dismiss().catch(()=>{});};
  page.on('load',onLoad);page.on('pageerror',onError);page.on('dialog',onDialog);page.on('request',onRequest);
  value.stop=()=>{page.off('load',onLoad);page.off('pageerror',onError);page.off('dialog',onDialog);page.off('request',onRequest);};
  return value;
}

export function quiet(value) {
  assert.deepEqual(value.dialogs,[],'A waiting update must not open a dialog.');
  assert.deepEqual(value.errors,[],'Update navigation must not raise uncaught errors.');
}

// Watch beyond the shipped 4-second activation deadline. A state sampled only
// at navigation completion would miss a delayed reload or canceled redirect.
export async function settled(page) {await page.waitForTimeout(4500);await afterPaint(page);}
