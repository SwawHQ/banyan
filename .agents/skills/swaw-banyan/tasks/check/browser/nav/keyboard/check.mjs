import assert from 'node:assert/strict';

export async function check({page,baseUrl,options}) {
  await page.setViewportSize({width:390,height:900});
  const response = await page.goto(baseUrl+options.page,{waitUntil:'load'});
  assert.ok(response?.ok(),'Page must return a successful response.');
  const order = await page.evaluate(()=>{
    const rail=document.querySelector('.page-rail'),nav=rail?.querySelector('[data-root-navigation]');
    const nextColumn=document.querySelector('[data-slot=breadcrumb]')||document.querySelector('#main');
    const links=[...(nav?.querySelectorAll('a[href]')||[])];
    if (!links.length||!nextColumn) throw new Error('Page needs root links and a next column.');
    links.at(-1).focus();
    return {count:links.length,before:!!(nav.compareDocumentPosition(nextColumn)&Node.DOCUMENT_POSITION_FOLLOWING),focused:nav.contains(document.activeElement)};
  });
  assert.ok(order.before&&order.focused,'Root navigation must precede the next column and accept keyboard focus.');
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(()=>!!document.activeElement.closest('[data-slot=breadcrumb], #main')),
    'Tab after the final root link must proceed to the next visible column.');
  return {page:options.page,order,viewport:{width:390,height:900}};
}
