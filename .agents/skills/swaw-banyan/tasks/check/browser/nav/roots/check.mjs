import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';
import {assertRootLinks} from '../_shared/links.mjs';
import {readRootState,checkRootSelection} from '../_shared/root.mjs';

export async function check({page,baseUrl,options}) {
  const source=new URL(options.from,baseUrl),targets=options.pages.map(path=>new URL(path,baseUrl));
  assert.ok(targets.every(target=>target.pathname!==source.pathname),'Choose root pages other than --from.');
  const response=await page.goto(source.href,{waitUntil:'load'});
  assert.ok(response?.ok(),'Root source page must return a successful response.');await waitForBrowse(page);await afterPaint(page);
  const roots=(await readRootState(page)).roots;assert.ok(roots.includes(source.pathname),'--from must select a published root page.');
  async function ready(target,length) {
    await page.waitForURL(target.href,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    assert.equal(page.url(),target.href,'Root navigation must retain the expected URL without copied context.');
    await assertRootLinks(page);await checkRootSelection(page,target.pathname,roots);
    assert.equal(await page.evaluate(()=>history.length),length,'Root navigation must retain the native history length.');
  }
  const results=[];let length=await page.evaluate(()=>history.length);await ready(source,length);
  for(const target of targets) {
    assert.ok(roots.includes(target.pathname),'--pages must select published root entries: '+target.pathname);
    await Promise.all([page.waitForURL(target.href,{waitUntil:'load'}),page.locator('[data-root-href='+JSON.stringify(target.pathname)+']').click()]);
    length++;await ready(target,length);
    await page.reload({waitUntil:'load'});await ready(target,length);
    await page.goBack({waitUntil:'load'});await ready(source,length);
    await page.goForward({waitUntil:'load'});await ready(target,length);
    await page.goBack({waitUntil:'load'});await ready(source,length);
    results.push({page:target.pathname,historyLength:length});
    // The next click replaces the previous Forward entry.
    length--;
  }
  return {from:options.from,roots,cases:results};
}
