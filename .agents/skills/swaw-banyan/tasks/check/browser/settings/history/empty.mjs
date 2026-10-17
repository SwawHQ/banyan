import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';

export async function checkEmptyHistory(page,source,pages) {
  const cases=[];
  const length=await page.evaluate(()=>history.length);
  for(const path of pages) {
    let visit;
    try {
      [visit]=await Promise.all([page.context().waitForEvent('page'),
        page.locator('[data-root-href='+JSON.stringify(path)+']').click({button:'middle'})]);
      await visit.waitForURL(new URL(path,source.origin).href,{waitUntil:'load'});await waitForBrowse(visit);await afterPaint(visit);
      assert.equal(visit.url(),new URL(path,source.origin).href,'Native settings tabs must not carry source query or fragment data.');
      assert.equal(page.url(),source.href,'Opening settings tabs must keep the source page.');
      assert.equal(await page.evaluate(()=>history.length),length,'Opening settings tabs must not change source history.');
      assert.equal(await visit.evaluate(()=>history.length),1,'No-history checks must start without a previous page: '+path+'.');
      const back=visit.locator('a[data-page-action="back"]'),count=await back.count();
      if(!count)continue;
      assert.equal(count,1,'A settings page must have one Back link.');
      const home=await visit.locator('body').getAttribute('data-site-root');assert.ok(home,'Settings must declare their language home.');
      const expected=new URL(home,source.origin).href,language=await visit.locator('html').getAttribute('lang');
      assert.equal(new URL(await back.getAttribute('href'),visit.url()).href,expected,'Back without history must link to the current language home.');
      await back.click();await visit.waitForURL(expected,{waitUntil:'load'});await waitForBrowse(visit);await afterPaint(visit);
      assert.equal(visit.url(),expected,'Back without history must use its native language-home link.');
      assert.equal(await visit.locator('html').getAttribute('lang'),language,'No-history Back must keep the page language.');
      cases.push({page:path,home});
    }finally{if(visit)await visit.close();}
  }
  assert.ok(cases.length,'Include a settings page with a Back link to check the no-history case.');
  return cases;
}
