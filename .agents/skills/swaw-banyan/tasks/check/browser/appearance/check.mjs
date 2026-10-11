import assert from 'node:assert/strict';

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
  return {page:options.page,from:options.from,checks:['choices','persistence','reload','manual-over-system','system-preference','history-return','cross-tab','history-forward']};
}
