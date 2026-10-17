import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {chooseLanguage} from '../choices/check.mjs';

export async function checkTabIsolation(page,source,settings,code,language) {
  const writer=await page.context().newPage(),other=await page.context().newPage(),dialogs=[];
  for(const tab of [writer,other])tab.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  try {
    for(const tab of [writer,other]) {
      await tab.goto(source.href,{waitUntil:'load'});await waitForBrowse(tab);
      await Promise.all([tab.waitForURL(settings.href,{waitUntil:'load'}),
        tab.locator('[data-root-href='+JSON.stringify(settings.pathname)+']').click()]);
    }
    await chooseLanguage(writer,source.origin,code);await afterPaint(writer);
    assert.deepEqual(await other.evaluate(()=>['banyan:language-return','banyan:language-return-label'].map(key=>sessionStorage.getItem(key))),[null,null],
      'Another tab must not receive a pending language choice or display label.');
    await other.locator('[data-page-action="back"]').click();
    await other.waitForURL(source.href,{waitUntil:'load'});await waitForBrowse(other);await afterPaint(other);
    assert.equal(other.url(),source.href,'Another tab must return to its original URL without translating.');
    assert.equal(await other.locator('html').getAttribute('lang'),language,'A return without a choice must keep the original language.');
    assert.equal(await other.locator('[data-language-return-notice]').count(),0,'A return without a choice must not show a missing-translation notice.');
    assert.equal(await writer.evaluate(()=>sessionStorage.getItem('banyan:language-return')),code,
      'Returning in another tab must not consume the writer tab choice.');
    assert.deepEqual(dialogs,[],'Independent language settings tabs must not prompt.');
    return {selected:code,otherReturned:new URL(other.url()).pathname+source.search+source.hash,writerPending:code};
  } finally {await other.close();await writer.close();}
}
