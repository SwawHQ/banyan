import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {chooseLanguage} from '../choices/check.mjs';
import {checkMissingNotice} from './missing.mjs';

export async function checkOptionalLabels(page,source,settings,code,language) {
  const results=[];
  for(const kind of ['partial-write','malformed','mismatched']) {
    const visit=await page.context().newPage(),errors=[];
    visit.on('pageerror',error=>errors.push(error.message));
    try {
      if(kind==='partial-write')await visit.addInitScript(()=>{
        const set=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value) {
          if(this===sessionStorage&&key==='banyan:language-return-label')throw new Error('Display label unavailable');
          return set.call(this,key,value);
        };
      });
      await visit.goto(source.href,{waitUntil:'load'});await waitForBrowse(visit);
      await Promise.all([visit.waitForURL(settings.href,{waitUntil:'load'}),
        visit.locator('[data-root-href='+JSON.stringify(settings.pathname)+']').click()]);
      await chooseLanguage(visit,source.origin,code);
      assert.equal(await visit.evaluate(()=>sessionStorage.getItem('banyan:language-return')),code,
        'A label failure must not discard the selected language code.');
      if(kind==='partial-write')assert.equal(await visit.evaluate(()=>sessionStorage.getItem('banyan:language-return-label')),null,
        'Partial-write checks must run without a display label.');
      else await visit.evaluate(({kind,language})=>sessionStorage.setItem('banyan:language-return-label',
        kind==='malformed'?'{broken}':JSON.stringify({code:language,name:'Unrelated display label'})),{kind,language});
      await visit.locator('[data-page-action="back"]').click();
      await visit.waitForURL(source.href,{waitUntil:'load'});await waitForBrowse(visit);await afterPaint(visit);
      assert.equal(visit.url(),source.href,'Invalid display labels must retain the untranslated source URL.');
      assert.equal(await visit.locator('html').getAttribute('lang'),language,'Invalid labels must retain the source language.');
      const notice=await checkMissingNotice(visit,code);
      assert.ok(!notice.text.includes('Unrelated display label'),'A label for another code must not identify the selected language.');
      assert.deepEqual(await visit.evaluate(()=>['banyan:language-return','banyan:language-return-label'].map(key=>sessionStorage.getItem(key))),[null,null],
        'Return must consume the code and invalid display metadata.');
      assert.deepEqual(errors,[],'Optional labels must not cause uncaught storage or JSON errors.');
      results.push({kind,...notice});
    } finally {await visit.close();}
  }
  return results;
}
