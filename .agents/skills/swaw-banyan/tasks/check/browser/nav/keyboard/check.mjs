import assert from 'node:assert/strict';
import {waitForBrowse} from '../../_shared/viewport.mjs';

export async function checkColumnFocus(page) {
  await waitForBrowse(page);
  const columns=page.locator('.page-column');
  const states=await columns.evaluateAll(nodes=>nodes.map(node=>({visible:!!node.getClientRects().length,
    tabindex:node.getAttribute('tabindex'),name:node.getAttribute('aria-label'),className:node.className})));
  const visible=states.map((state,index)=>({...state,index})).filter(state=>state.visible);
  assert.ok(visible.length,'Page needs a visible scroll column.');
  await page.locator('.skip-link').evaluate(node=>node.focus({preventScroll:true}));
  const visited=new Set();let previous=-1;
  for(const state of visible) {
    assert.equal(state.tabindex,'0','Every visible column must have its own Tab stop.');
    assert.ok(state.name?.trim(),'Every visible column must have an accessible name.');
    // Native scroll containers can be Tab stops without a tabindex attribute.
    for(;;) {
      await page.keyboard.press('Tab');
      const focus=await page.evaluate(()=>{
        const active=document.activeElement,columns=[...document.querySelectorAll('.page-column')];
        return {column:columns.indexOf(active),within:columns.findIndex(node=>node.contains(active)),
          element:[...document.querySelectorAll('*')].indexOf(active)};
      });
      assert.ok(!visited.has(focus.element),'Tab must not trap focus inside a column.');visited.add(focus.element);
      if(focus.column===state.index)break;
      assert.ok(focus.column===-1&&focus.within===previous,'Tab must reach the column before its controls.');
    }
    previous=state.index;
    assert.ok(await columns.nth(state.index).evaluate(node=>{
      const style=getComputedStyle(node);return style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0&&parseFloat(style.outlineOffset)<0;
    }),'Focused columns must have a visible inset outline.');
  }
  assert.equal(await page.locator('#main').getAttribute('tabindex'),'-1','The skip-link target must not add a second Tab stop.');
  return visible.map(({className,name})=>({className,name}));
}

export async function check({page,baseUrl,options}) {
  await page.setViewportSize({width:390,height:900});
  const response = await page.goto(baseUrl+options.page,{waitUntil:'load'});
  assert.ok(response?.ok(),'Page must return a successful response.');
  await waitForBrowse(page);
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
  assert.ok(await page.evaluate(()=>!!document.activeElement.closest('[data-slot=breadcrumb], .page-content')),
    'Tab after the final root link must proceed to the next visible column.');
  const columns=await checkColumnFocus(page);
  return {page:options.page,order,columns,viewport:{width:390,height:900}};
}
