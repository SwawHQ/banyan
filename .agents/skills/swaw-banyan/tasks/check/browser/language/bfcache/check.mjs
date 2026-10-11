import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';
import {assertChoices,chooseLanguage} from '../choices/check.mjs';

const probeKey='swban:language-bfcache';
export async function check({page,baseUrl,options}) {
  const source=new URL(options.from,baseUrl),settings=new URL(options.page??'/language/',baseUrl);
  const errors=[],dialogs=[],onError=error=>errors.push(error.message),onDialog=async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();};
  page.on('pageerror',onError);page.on('dialog',onDialog);
  await page.addInitScript(key=>addEventListener('pageshow',event=>{
    const events=JSON.parse(sessionStorage.getItem(key)||'[]');
    events.push({url:location.href,persisted:event.persisted});sessionStorage.setItem(key,JSON.stringify(events));
  }),probeKey);
  try {
    await page.goto(source.href,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    assert.equal(page.url(),source.href,'BFCache source must load its explicit URL.');
    const metadata=await page.evaluate(()=>({language:document.documentElement.lang,
      canonical:document.querySelector('link[rel="canonical"]')?.href,
      alternates:[...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(link=>({code:link.hreflang,href:link.href}))}));
    const next=options.next||metadata.language;
    assert.notEqual(options.to,metadata.language,'First BFCache choice must differ from the source language.');
    assert.notEqual(next,options.to,'Second BFCache choice must differ from the first target.');
    function translated(code) {
      const href=code===metadata.language?metadata.canonical:metadata.alternates.find(link=>link.code===code)?.href;
      assert.ok(href,'BFCache source must have a translation for '+code+'.');
      assert.ok(metadata.canonical,'BFCache source must publish its canonical URL.');
      const target=new URL(href);
      assert.equal(target.origin,new URL(metadata.canonical).origin,'Translations must use the canonical site origin.');
      const expected=new URL(target.pathname,baseUrl);expected.search=source.search;expected.hash=source.hash;return expected;
    }
    const first=translated(options.to),second=translated(next);
    await Promise.all([page.waitForURL(settings.href,{waitUntil:'load'}),
      page.locator('[data-root-href='+JSON.stringify(settings.pathname)+']').click()]);
    const state=await assertChoices(page,baseUrl),length=await page.evaluate(()=>history.length);
    for(const code of [options.to,next])assert.ok(state.choices.find(choice=>choice.code===code)?.translated,
      'BFCache target must be declared in translated language settings.');
    async function returned(original,expected,code) {
      // A restored document fires pageshow, not a new load event. Its translation loads a new document.
      await page.waitForURL(expected.href,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
      const events=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'[]'),probeKey);
      assert.equal(events.filter(event=>event.url===original.href&&event.persisted).length,1,
        'Expected one actual pageshow.persisted BFCache restoration for '+original.pathname+'.');
      assert.equal(page.url(),expected.href,'BFCache translation must retain source query and fragment.');
      assert.equal(await page.locator('html').getAttribute('lang'),code,'BFCache return must apply the selected language.');
      assert.equal(await page.evaluate(()=>history.length),length,'BFCache return must replace the restored history entry.');
      assert.deepEqual(await page.evaluate(()=>['banyan:language-return','banyan:language-return-label'].map(key=>sessionStorage.getItem(key))),[null,null],
        'BFCache return must consume its pending code and display label.');
      return events;
    }
    await chooseLanguage(page,baseUrl,options.to);const finalSettings=page.url();
    await page.locator('[data-page-action="back"]').click();await returned(source,first,options.to);
    await page.evaluate(()=>history.forward());await page.waitForURL(finalSettings,{waitUntil:'commit'});await assertChoices(page,baseUrl);
    await chooseLanguage(page,baseUrl,next);await page.evaluate(()=>history.back());
    const events=await returned(first,second,next);
    assert.deepEqual(errors,[],'BFCache language returns must not raise uncaught errors.');
    assert.deepEqual(dialogs,[],'Translated BFCache choices must not prompt.');
    return {from:options.from,to:options.to,next,returned:second.pathname+second.search+second.hash,historyLength:length,events};
  } finally {
    page.off('pageerror',onError);page.off('dialog',onDialog);
    if(!page.isClosed())await page.evaluate(key=>sessionStorage.removeItem(key),probeKey).catch(()=>{});
  }
}
