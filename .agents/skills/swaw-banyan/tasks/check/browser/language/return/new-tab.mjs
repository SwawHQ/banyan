import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {assertChoices,chooseLanguage} from '../choices/check.mjs';

export async function checkNewTabReturn(page,source,settings,code) {
  const visit=await page.context().newPage();let opened;
  try {
    await visit.goto(source.href,{waitUntil:'load'});await waitForBrowse(visit);await afterPaint(visit);
    const length=await visit.evaluate(()=>history.length);
    [opened]=await Promise.all([visit.context().waitForEvent('page'),
      visit.locator('[data-root-href='+JSON.stringify(settings.pathname)+']').click({button:'middle'})]);
    await opened.waitForURL(settings.href,{waitUntil:'load'});await afterPaint(opened);
    assert.equal(opened.url(),settings.href,'Middle-click must open the settings native URL without return context.');
    assert.equal(visit.url(),source.href,'Opening a native settings tab must keep the source page.');
    assert.equal(await visit.evaluate(()=>history.length),length,'Opening another tab must not change source history.');
    assert.equal(await opened.evaluate(()=>history.length),1,'A native settings tab must have no previous page.');
    const state=await assertChoices(opened,source.origin),codes=[...state.choices.filter(choice=>choice.code!==code).map(choice=>choice.code),code];
    for(const selected of codes) {
      await chooseLanguage(opened,source.origin,selected);
      assert.equal(await opened.evaluate(()=>history.length),1,'Language choices must not add a previous page to a new tab.');
    }
    const back=opened.locator('a[data-page-action="back"]');assert.equal(await back.count(),1,'Language settings must have one Back link.');
    const home=await opened.locator('body').getAttribute('data-site-root');assert.ok(home,'Settings must declare their language home.');
    const expected=new URL(home,source.origin).href;
    assert.equal(new URL(await back.getAttribute('href'),opened.url()).href,expected,'A new language tab must link Back to its selected language home.');
    await back.click();await opened.waitForURL(expected,{waitUntil:'load'});await waitForBrowse(opened);await afterPaint(opened);
    assert.equal(opened.url(),expected,'Back in a new settings tab must use the selected language home.');
    assert.equal(await opened.locator('html').getAttribute('lang'),code,'The new-tab home must use the selected language.');
    assert.deepEqual(await opened.evaluate(()=>['banyan:language-return','banyan:language-return-label'].map(key=>sessionStorage.getItem(key))),[null,null],
      'Native home navigation must consume the new tab language choice.');
    assert.equal(visit.url(),source.href,'New-tab choices and Back must keep the original source page.');
    return {codes,home,historyLength:1,source:source.pathname+source.search+source.hash};
  }finally{if(opened)await opened.close();await visit.close();}
}
