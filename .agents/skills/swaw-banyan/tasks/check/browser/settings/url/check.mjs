import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';

export async function check({page,baseUrl,options}) {
  const cases=[],errors=[],dialogs=[],onError=error=>errors.push(error.message),onDialog=async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();};
  page.on('pageerror',onError);page.on('dialog',onDialog);
  await page.addInitScript(()=>history.replaceState({...history.state,swbanSettingsURL:{value:'keep'}},'',location.href));
  try {
    for(const hint of ['https://example.invalid/missing/','unused']) {
      const expected=new URL(options.page,baseUrl);expected.searchParams.set('return',hint);expected.searchParams.set('probe','keep');expected.hash='settings-probe';
      const response=await page.goto(expected.href,{waitUntil:'load'});
      assert.ok(response?.ok(),'Settings URL checks need a successful page response.');
      const language=await page.locator('html').getAttribute('lang'),length=await page.evaluate(()=>history.length);
      for(const phase of ['visit','reload']) {
        if(phase==='reload')await page.reload({waitUntil:'load'});
        await waitForBrowse(page);await afterPaint(page);
        assert.equal(page.url(),expected.href,'Settings visits and reloads must retain unused query and fragment data.');
        assert.equal(await page.locator('html').getAttribute('lang'),language,'Unused URL data must not change the settings language.');
        assert.deepEqual(await page.evaluate(()=>history.state?.swbanSettingsURL),{value:'keep'},'Settings must preserve caller history state.');
        assert.equal(await page.evaluate(()=>history.length),length,'Unused URL handling and reloads must not add history entries.');
        cases.push({phase,page:expected.pathname+expected.search+expected.hash});
      }
    }
    assert.deepEqual(errors,[],'Settings URL handling must not raise uncaught errors.');
    assert.deepEqual(dialogs,[],'Unused return hints must not trigger a dialog.');
    return {page:options.page,cases};
  }finally{page.off('pageerror',onError);page.off('dialog',onDialog);}
}
