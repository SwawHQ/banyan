import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {chooseLanguage} from '../choices/check.mjs';

export async function checkCanceledReturn(page,source,settings,code,language) {
  const visit=await page.context().newPage(),dialogs=[];
  visit.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  try {
    await visit.goto(source.href,{waitUntil:'load'});await waitForBrowse(visit);
    await Promise.all([visit.waitForURL(settings.href,{waitUntil:'load'}),
      visit.locator('[data-root-href='+JSON.stringify(settings.pathname)+']').click()]);
    await chooseLanguage(visit,source.origin,code);
    const selectedSettings=visit.url();
    // Direct navigation consumes the choice; revisiting settings must not revive it.
    await visit.goto(source.href,{waitUntil:'load'});await assertOriginal();
    await visit.goBack({waitUntil:'commit'});await visit.waitForURL(selectedSettings,{waitUntil:'load'});
    await visit.goBack({waitUntil:'commit'});await assertOriginal();
    assert.deepEqual(dialogs,[],'Canceled language returns must not prompt.');
    return {selected:code,returned:source.pathname+source.search+source.hash,settings:new URL(selectedSettings).pathname};
  } finally {await visit.close();}

  async function assertOriginal() {
    await visit.waitForURL(source.href,{waitUntil:'load'});await waitForBrowse(visit);await afterPaint(visit);
    assert.equal(visit.url(),source.href,'A canceled choice must not translate explicit or later history visits.');
    assert.equal(await visit.locator('html').getAttribute('lang'),language,'A canceled return must keep the source language.');
    assert.equal(await visit.locator('[data-language-return-notice]').count(),0,'Canceled choices must not show a return notice.');
    assert.deepEqual(await visit.evaluate(()=>['banyan:language-return','banyan:language-return-label'].map(key=>sessionStorage.getItem(key))),[null,null],
      'Canceling a language return must consume its pending code and display label.');
  }
}
