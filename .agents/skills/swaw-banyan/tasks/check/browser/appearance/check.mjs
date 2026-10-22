import assert from 'node:assert/strict';
import {afterPaint} from '../_shared/viewport.mjs';

async function checkStartupTheme(page,target) {
  const cases=[];
  for(const colorScheme of ['light','dark']) {
    await page.emulateMedia({colorScheme});
    for(const preference of [null,'unexpected']) {
      const expected=colorScheme;
      await page.evaluate(value=>{
        if(value===null)localStorage.removeItem('theme-preference');
        else localStorage.setItem('theme-preference',value);
      },preference);
      let release;
      const gate=new Promise(resolve=>{release=resolve;}),held=[];
      const handler=route=>{
        if(route.request().resourceType()!=='script')return route.continue();
        const continued=gate.then(()=>route.continue());held.push(continued);return continued;
      };
      await page.route('**/*',handler);
      let first;
      try {
        const response=await page.goto(target,{waitUntil:'commit'});
        assert.ok(response?.ok(),'Appearance page must return a successful response.');
        await page.waitForFunction(()=>document.getElementById('main')
          &&[...document.querySelectorAll('link[rel="stylesheet"]')].every(link=>link.disabled||link.sheet));
        await afterPaint(page);
        assert.ok(held.length>0,'Theme startup must be sampled before external scripts run.');
        first=await page.evaluate(()=>document.documentElement.dataset.theme);
        assert.equal(first,expected,'First-frame theme must match the stored choice or system preference: '+JSON.stringify({preference,colorScheme}));
      } finally {
        release();
        try {await Promise.all(held);}finally{await page.unroute('**/*',handler);}
      }
      await page.waitForLoadState('load');
      const final=await page.evaluate(()=>document.documentElement.dataset.theme);
      assert.equal(final,expected,'Deferred theme must retain the first-frame choice.');
      cases.push({preference,colorScheme,first,final});
    }
  }
  return cases;
}

export async function check({page,baseUrl,options}) {
  const target = baseUrl+options.page, origin = baseUrl+options.from;
  const choice = mode => page.locator(`.slot-main [data-theme-choice="${mode}"]`);
  const theme = mode => page.waitForFunction(value=>document.documentElement.dataset.theme===value,mode);
  const assertSelected = async mode => {
    await choice(mode).waitFor({state:'visible'});
    await page.waitForFunction(value=>{
      const buttons = [...document.querySelectorAll('.slot-main [data-theme-choice]')];
      return buttons.every(button=>button.getAttribute('aria-pressed')===String(button.dataset.themeChoice===value)
        && button.classList.contains('is-current')===(button.dataset.themeChoice===value));
    },mode);
  };
  await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
  const response = await page.goto(origin,{waitUntil:'load'});
  assert.ok(response?.ok(),'Origin page must return a successful response.');
  await page.locator(`[data-root-href=${JSON.stringify(new URL(target).pathname)}]`).click();
  await page.waitForURL(target);
  const contract = await page.locator('.slot-main [data-list-view]').evaluate(list=>({
    view:list.dataset.listView,sortable:list.hasAttribute('data-sortable')||!!list.querySelector('[data-sortable]'),
    buttons:[...list.querySelectorAll('[data-theme-choice]')].map(button=>({mode:button.dataset.themeChoice,tag:button.tagName}))
  }));
  assert.equal(contract.view,'choice'); assert.equal(contract.sortable,false);
  assert.deepEqual(contract.buttons.map(button=>button.mode),['auto','light','dark']);
  assert.ok(contract.buttons.every(button=>button.tag==='BUTTON'),'Appearance choices must be buttons.');
  await assertSelected('auto'); await theme('light');

  await choice('dark').click(); await theme('dark'); await assertSelected('dark');
  assert.equal(await page.evaluate(()=>localStorage.getItem('theme-preference')),'dark');
  await page.reload({waitUntil:'load'}); await theme('dark'); await assertSelected('dark');
  await choice('light').click(); await theme('light'); await assertSelected('light');
  assert.equal(await page.evaluate(()=>localStorage.getItem('theme-preference')),'light');
  await page.emulateMedia({colorScheme:'dark'});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await theme('light');
  await choice('auto').click(); await theme('dark'); await assertSelected('auto');
  assert.equal(await page.evaluate(()=>localStorage.getItem('theme-preference')),'auto');
  await page.locator('[data-page-action="back"]').click();
  await page.waitForURL(origin);
  await page.emulateMedia({colorScheme:'light'}); await theme('light');

  const other = await page.context().newPage();
  try {
    const response = await other.goto(target,{waitUntil:'load'});
    assert.ok(response?.ok(),'Appearance page must return a successful response.');
    await other.locator('.slot-main [data-theme-choice="dark"]').click();
    try { await theme('dark'); }
    catch (error) { error.message='Cross-tab synchronization failed: '+error.message; throw error; }
  } finally { await other.close(); }
  await page.goForward({waitUntil:'load'}); await page.waitForURL(target);
  await theme('dark'); await assertSelected('dark');
  const startup=await checkStartupTheme(page,target);
  return {page:options.page,from:options.from,startup,checks:['choices','persistence','reload','manual-over-system','system-preference','history-return','cross-tab','history-forward','first-frame-theme']};
}
