import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {chooseLanguage} from '../choices/check.mjs';

export async function checkUnavailableStorage(page,source,settings,code,language) {
  const visit=await page.context().newPage(),errors=[],dialogs=[];
  visit.on('pageerror',error=>errors.push(error.message));
  visit.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
  try {
    await visit.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new Error('Storage unavailable');}}));
    await visit.goto(source.href,{waitUntil:'load'});await waitForBrowse(visit);
    assert.equal(await visit.evaluate(()=>{try{window.sessionStorage;return false;}catch{return true;}}),true,
      'Storage failure checks must run with sessionStorage unavailable.');
    await Promise.all([visit.waitForURL(settings.href,{waitUntil:'load'}),
      visit.locator('[data-root-href='+JSON.stringify(settings.pathname)+']').click()]);
    const length=await visit.evaluate(()=>history.length);
    await chooseLanguage(visit,source.origin,code);
    assert.equal(await visit.evaluate(()=>history.length),length,'Language choices must still replace history when storage is unavailable.');
    await visit.locator('[data-page-action="back"]').click();
    await visit.waitForURL(source.href,{waitUntil:'load'});await waitForBrowse(visit);await afterPaint(visit);
    assert.equal(visit.url(),source.href,'Unavailable storage must not rewrite the return URL.');
    assert.equal(await visit.locator('html').getAttribute('lang'),language,'Unavailable storage must keep the original return language.');
    assert.equal(await visit.locator('[data-language-return-notice]').count(),0,'Unavailable storage must not invent a pending language return.');
    assert.deepEqual(errors,[],'Language navigation must handle unavailable storage without uncaught errors.');
    assert.deepEqual(dialogs,[],'Unavailable storage must not require a dialog for native language choices.');
    return {selected:code,returned:source.pathname+source.search+source.hash,unavailable:true,errors};
  } finally {await visit.close();}
}
