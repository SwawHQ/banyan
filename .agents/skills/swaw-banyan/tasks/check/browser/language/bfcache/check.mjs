import assert from 'node:assert/strict';
import {check as choose} from '../return/check.mjs';

export async function check({page,baseUrl,options}) {
  const source=new URL(options.from,baseUrl);
  await page.addInitScript(()=>addEventListener('pageshow',event=>{window.restoredFromCache=event.persisted;}));
  const first=await choose({page,baseUrl,options});
  const translated=page.url();
  await page.goBack({waitUntil:'commit'});await page.waitForURL(source.href,{waitUntil:'commit'});
  assert.ok(await page.evaluate(()=>window.restoredFromCache),'Expected actual pageshow.persisted on the original source.');
  const original=await page.locator('html').getAttribute('lang');
  await page.goForward({waitUntil:'commit'});await page.waitForURL(translated,{waitUntil:'commit'});
  const next=options.next??original;
  const second=await choose({page,baseUrl,options:{...options,from:first.returned,page:await page.locator('a[data-language-entry]').first().getAttribute('data-root-href'),to:next}});
  return {...second,next};
}
