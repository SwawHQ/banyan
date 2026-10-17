import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {assertRootLinks} from '../../nav/_shared/links.mjs';
import {checkEmptyHistory} from './empty.mjs';

export async function check({page,baseUrl,options}) {
  const source=new URL(options.from,baseUrl),paths=options.pages,pages=paths.map(path=>new URL(path,baseUrl));
  const response=await page.goto(source.href,{waitUntil:'load'});assert.ok(response?.ok(),'Settings history checks need a successful source page.');
  await waitForBrowse(page);await afterPaint(page);assert.equal(page.url(),source.href,'Settings source must retain its explicit URL.');
  await page.evaluate(()=>history.replaceState({...history.state,swbanSettingsHistory:{value:'keep'}},'',location.href));
  const roots=await assertRootLinks(page),before=await page.evaluate(()=>history.length),steps=[];
  for(const target of pages) {
    await Promise.all([page.waitForURL(target.href,{waitUntil:'load'}),page.locator('[data-root-href='+JSON.stringify(target.pathname)+']').click()]);
    await waitForBrowse(page);await afterPaint(page);await assertRootLinks(page);
    assert.equal(page.url(),target.href,'Settings links must not copy the source query or fragment.');
    assert.equal(await page.evaluate(()=>history.length),before+steps.length+1,'Each settings visit must add one native history entry.');
    steps.push(target.pathname);
  }
  const length=await page.evaluate(()=>history.length);await page.reload({waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
  assert.equal(page.url(),pages.at(-1).href,'Reload must keep the last settings page.');
  assert.equal(await page.evaluate(()=>history.length),length,'Settings reload must not add a history entry.');
  async function backTo(target) {
    const back=page.locator('a[data-page-action="back"]'),count=await back.count();
    assert.ok(count<=1,'Settings must not have duplicate Back links.');
    if(count)await back.click();else await page.goBack({waitUntil:'commit'});
    await page.waitForURL(target.href,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);await assertRootLinks(page);
    assert.equal(page.url(),target.href,'Settings Back must return exactly one history entry.');
    assert.equal(await page.evaluate(()=>history.length),length,'Settings Back must not replace native history with a new visit.');
  }
  for(const target of [...pages.slice(0,-1)].reverse())await backTo(target);
  await backTo(source);
  assert.deepEqual(await page.evaluate(()=>history.state?.swbanSettingsHistory),{value:'keep'},'Settings return must restore caller history state.');
  await page.goForward({waitUntil:'commit'});await page.waitForURL(pages[0].href,{waitUntil:'load'});await waitForBrowse(page);await assertRootLinks(page);
  await backTo(source);
  assert.deepEqual(await page.evaluate(()=>history.state?.swbanSettingsHistory),{value:'keep'},'Settings Forward and Back must retain source history state.');
  const empty=await checkEmptyHistory(page,source,paths);
  return {from:options.from,pages:paths,steps,roots,historyLength:length,returned:source.pathname+source.search+source.hash,empty};
}
