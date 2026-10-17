import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {assertChoices,chooseLanguage} from '../choices/check.mjs';
import {checkExplicitVisits} from './visits.mjs';
import {checkMissingNotice} from './missing.mjs';
import {checkTabIsolation} from './tabs.mjs';
import {checkCanceledReturn} from './cancel.mjs';
import {checkUnavailableStorage} from './storage.mjs';
import {checkOptionalLabels} from './labels.mjs';
import {checkNewTabReturn} from './new-tab.mjs';

export async function check({page,baseUrl,options}) {
  const source=new URL(options.from,baseUrl),settings=new URL(options.page,baseUrl);
  await page.goto(source.href,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
  assert.equal(page.url(),source.href,'Explicit visits must load the requested source URL before language settings.');
  const translation=await page.evaluate(code=>({language:document.documentElement.lang,
    canonical:document.querySelector('link[rel="canonical"]')?.href,
    href:[...document.querySelectorAll('link[rel="alternate"][hreflang]')].find(link=>link.hreflang===code)?.href}),options.to);
  assert.ok(translation.canonical,'Source must publish a canonical link.');
  const missing=options.to!==translation.language&&!translation.href;
  const target=missing||options.to===translation.language?translation.canonical:translation.href;
  const alternate=new URL(target);
  assert.equal(alternate.origin,new URL(translation.canonical).origin,'Translation must use the canonical site origin.');
  const expected=new URL(alternate.pathname,baseUrl);expected.search=source.search;expected.hash=source.hash;
  const targets=[{url:source.href,language:translation.language}];
  if(expected.href!==source.href)targets.push({url:expected.href,language:options.to});
  const rootLink=page.locator('[data-root-href='+JSON.stringify(settings.pathname)+']');
  assert.equal(await rootLink.count(),1,'Source must link to the requested language settings.');
  await Promise.all([page.waitForURL(settings.href,{waitUntil:'load'}),rootLink.click()]);
  const initial=await assertChoices(page,baseUrl);let length=await page.evaluate(()=>history.length);
  const choice=initial.choices.find(choice=>choice.code===options.to);
  assert.ok(choice?.translated,'Target language must have a translated settings choice.');
  assert.ok(initial.choices.every(choice=>choice.translated),'Repeated choices need translated settings in each language.');
  const visits=await checkExplicitVisits(page,targets,initial.choices.map(choice=>choice.code),options.timeout);
  const notices=[];
  const codes=[...initial.choices.filter(choice=>choice.code!==options.to).map(choice=>choice.code),options.to,options.to];
  for(const code of codes) {
    await chooseLanguage(page,baseUrl,code);
    assert.equal(await page.evaluate(()=>history.length),length,'Repeated choices must use one settings history entry.');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:language-return')),code,'Pending return must store the selected code.');
  }
  const finalSettings=page.url();await page.reload({waitUntil:'load'});await assertChoices(page,baseUrl);
  async function returned() {
    await page.waitForURL(expected.href,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    assert.equal(page.url(),expected.href,'Translated return must retain source query and fragment.');
    assert.equal(await page.locator('html').getAttribute('lang'),missing?translation.language:options.to,
      'Returned page must use the translation or keep the original language when unavailable.');
    assert.equal(await page.evaluate(()=>history.length),length,'Returning must replace the source history entry.');
    assert.deepEqual(await page.evaluate(()=>['banyan:language-return','banyan:language-return-label'].map(key=>sessionStorage.getItem(key))),[null,null],
      'Return must consume its pending code and display label.');
  }
  await page.locator('[data-page-action="back"]').click();await returned();
  if(missing)notices.push(await checkMissingNotice(page,choice.label));
  await page.goForward({waitUntil:'commit'});await page.waitForURL(finalSettings,{waitUntil:'load'});
  await assertChoices(page,baseUrl);
  await page.goBack({waitUntil:'commit'});await returned();
  assert.equal(await page.locator('[data-language-return-notice]').count(),0,'Consumed choices must not show another return notice.');
  await page.reload({waitUntil:'load'});await returned();
  assert.equal(await page.locator('[data-language-return-notice]').count(),0,'Reloads must not repeat a missing-translation notice.');
  // A second source visit verifies that browser Back also applies a fresh choice.
  await page.goto(source.href,{waitUntil:'load'});await waitForBrowse(page);
  await Promise.all([page.waitForURL(settings.href,{waitUntil:'load'}),rootLink.click()]);
  length=await page.evaluate(()=>history.length);
  await chooseLanguage(page,baseUrl,options.to);await page.goBack({waitUntil:'commit'});await returned();
  if(missing)notices.push(await checkMissingNotice(page,choice.label));
  const boundaries={
    tabs:await checkTabIsolation(page,source,settings,options.to,translation.language),
    canceled:await checkCanceledReturn(page,source,settings,options.to,translation.language),
    storage:await checkUnavailableStorage(page,source,settings,options.to,translation.language),
    labels:missing?await checkOptionalLabels(page,source,settings,options.to,translation.language):[],
    newTab:await checkNewTabReturn(page,source,settings,options.to)
  };
  return {from:options.from,to:options.to,returned:expected.pathname+expected.search+expected.hash,
    settings:new URL(finalSettings).pathname,codes,historyLength:length,visits,missingTranslation:missing,notices,boundaries};
}
