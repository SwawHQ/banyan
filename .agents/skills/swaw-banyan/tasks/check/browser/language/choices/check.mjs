import assert from 'node:assert/strict';
import {afterPaint} from '../../_shared/viewport.mjs';

async function readChoices(page) {
  return page.evaluate(()=>{
    const picker=document.querySelector('[data-language-settings]'),list=picker?.querySelector('[data-list-view]');
    return {language:document.documentElement.lang,missingMessage:picker?.dataset.languageMissing,view:list?.dataset.listView,
      sortable:Boolean(list?.hasAttribute('data-sortable')||list?.querySelector('[data-sortable]')),
      choices:[...(picker?.querySelectorAll('[data-language-choice]')||[])].map(link=>({
        code:link.dataset.languageChoice,href:link.getAttribute('href'),tag:link.tagName,
        translated:link.dataset.hasTrans==='true',disabled:link.hasAttribute('disabled')||link.getAttribute('aria-disabled')==='true',
        current:link.getAttribute('aria-current')||'',selected:link.classList.contains('is-current'),
        label:link.querySelector('.item-title')?.textContent.trim(),
        left:link.querySelector('.item-title')?.getBoundingClientRect().left,
        iconHidden:link.querySelector('.item-icon')?.getAttribute('aria-hidden')==='true'||
          link.querySelector('.item-icon .icon')?.getAttribute('aria-hidden')==='true',
        icon:link.querySelector('.item-icon')?.textContent.trim()
      }))};
  });
}

export async function assertChoices(page,baseUrl) {
  const state=await readChoices(page);
  assert.equal(state.view,'choice','Choose a language settings page with a choice list.');
  assert.equal(state.sortable,false,'Language choices must not be sortable.');
  assert.ok(state.choices.length>0,'Settings must contain language choices.');
  assert.equal(new Set(state.choices.map(choice=>choice.code)).size,state.choices.length,'Language codes must be unique.');
  assert.equal(state.choices.filter(choice=>choice.current==='page').length,1,'Exactly one language must be current.');
  for(const choice of state.choices) {
    assert.ok(choice.code&&choice.tag==='A'&&choice.href&&!choice.disabled,'Each language must be an enabled native link.');
    assert.equal(new URL(choice.href,page.url()).origin,new URL(baseUrl).origin,'Language links must stay on the local site.');
    assert.equal(choice.iconHidden,true,'Language icons must be decorative.');
    assert.ok(choice.label,'Each language must have a visible name.');
    const link=page.locator('[data-language-choice='+JSON.stringify(choice.code)+']');
    assert.equal(await page.getByRole('link',{name:choice.label,exact:true}).and(link).count(),1,
      'Decorative markers must not change the accessible language name.');
    assert.equal(choice.current,choice.code===state.language?'page':'','Current language must match the document language.');
    assert.equal(choice.selected,choice.code===state.language,'Visible language selection must match aria-current.');
  }
  const positions=state.choices.map(choice=>choice.left);
  assert.ok(positions.every(Number.isFinite)&&Math.max(...positions)-Math.min(...positions)<=1,'Language titles must share one aligned column.');
  return state;
}

export async function chooseLanguage(page,baseUrl,code) {
  const link=page.locator('[data-language-choice='+JSON.stringify(code)+']'),href=await link.getAttribute('href');
  assert.ok(href,'Selected language must have a native href.');
  const expected=new URL(href,page.url()).href;
  // Selecting the current language also loads a new document at the same URL.
  await Promise.all([page.waitForNavigation({waitUntil:'load'}),link.click()]);
  assert.equal(page.url(),expected,'Choice must navigate to its native href.');
  const state=await assertChoices(page,baseUrl);assert.equal(state.language,code,'Choice must load its declared language.');
  return state;
}

export async function check({page,baseUrl,options}) {
  await page.goto(baseUrl+options.page,{waitUntil:'load'});await afterPaint(page);
  const initial=await assertChoices(page,baseUrl);
  assert.ok(initial.choices.every(choice=>choice.translated),'Choose settings with translations for every language.');
  const context=await page.context().browser().newContext({javaScriptEnabled:false,serviceWorkers:'block',viewport:page.viewportSize()});
  context.setDefaultTimeout(options.timeout??15000);context.setDefaultNavigationTimeout(options.timeout??15000);
  const staticCases=[];
  try {
    const staticPage=await context.newPage();
    for(const choice of initial.choices) {
      await staticPage.goto(baseUrl+options.page,{waitUntil:'load'});await assertChoices(staticPage,baseUrl);
      staticCases.push(await chooseLanguage(staticPage,baseUrl,choice.code));
    }
  }finally{await context.close();}
  // Return hints are query data, never instructions to inspect another page.
  const probe=new URL(options.page,baseUrl);probe.searchParams.set('return','https://example.invalid/missing/');probe.searchParams.set('probe','keep');probe.hash='anchor';
  await page.addInitScript(()=>history.replaceState({...history.state,banyanLanguageProbe:true},'',location.href));
  const dialogs=[],onDialog=async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();};page.on('dialog',onDialog);
  const runtimeCases=[];
  try {
    await page.goto(probe.href,{waitUntil:'load'});await afterPaint(page);
    assert.equal(page.url(),probe.href,'Settings must preserve unknown queries and fragments.');
    assert.equal(await page.evaluate(()=>history.state.banyanLanguageProbe),true,'Settings must preserve history state.');
    const length=await page.evaluate(()=>history.length);
    for(const choice of initial.choices) {
      runtimeCases.push(await chooseLanguage(page,baseUrl,choice.code));
      assert.equal(await page.evaluate(()=>history.length),length,'Language choices must replace the settings history entry.');
    }
    assert.deepEqual(dialogs,[],'Translated settings choices must not prompt about a return page.');
  }finally{page.off('dialog',onDialog);}
  return {page:options.page,initial,staticCases,runtimeCases};
}
