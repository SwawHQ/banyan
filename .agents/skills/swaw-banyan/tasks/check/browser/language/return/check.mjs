import assert from 'node:assert/strict';
import {assertChoices} from '../choices/check.mjs';

export async function check({page,baseUrl,options}) {
  const source=new URL(options.from,baseUrl),settings=new URL(options.page??'/language/',baseUrl);
  if(page.url()!==source.href)await page.goto(source.href);
  const alternate=await page.locator('link[rel=alternate][hreflang='+JSON.stringify(options.to)+']').evaluateAll(nodes=>nodes[0]?.href);
  await page.locator('[data-root-href='+JSON.stringify(settings.pathname)+']').click();
  await page.waitForURL(settings.href);
  const choices=await assertChoices(page,baseUrl);
  const choice=choices.choices.find(item=>item.code===options.to);
  assert.ok(choice,'Target language must exist in the picker.');
  const link=page.locator('[data-language-choice='+JSON.stringify(options.to)+']');
  const length=await page.evaluate(()=>history.length);
  let expected=new URL(choice.href,page.url());
  if(alternate) {
    expected=new URL(new URL(alternate).pathname,baseUrl);
    expected.search=source.search;expected.hash=source.hash;
  } else {
    const canceled=page.waitForEvent('dialog').then(async dialog=>{assert.ok(dialog.message().includes(choice.label));await dialog.dismiss();});
    await Promise.all([canceled,link.click()]);
    assert.equal(page.url(),settings.href);
    page.once('dialog',dialog=>dialog.accept());
  }
  await Promise.all([page.waitForNavigation({waitUntil:'load'}),link.click()]);
  assert.equal(page.url(),expected.href);
  assert.equal(await page.evaluate(()=>history.length),length);
  return {from:options.from,to:options.to,returned:expected.pathname+expected.search+expected.hash,missingTranslation:!alternate};
}
