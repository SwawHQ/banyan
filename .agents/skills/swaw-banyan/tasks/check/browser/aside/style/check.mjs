import assert from 'node:assert/strict';
import {setTheme} from '../../../../_shared/browser/theme.mjs';
import {activate} from '../../../../_shared/browser/viewport.mjs';
import {openArticle,openAside} from '../_shared/page.mjs';

export async function check({page,baseUrl,options}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  const paint=locator=>locator.evaluate(node=>({color:getComputedStyle(node).color,background:getComputedStyle(node,'::before').backgroundColor,
    ring:getComputedStyle(node,'::before').boxShadow,underline:getComputedStyle(node.querySelector('.item-title')).textDecorationThickness}));
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:900});await openArticle(page,baseUrl+options.page);
    const toggle=page.locator('#document-aside-toggle'),close=page.locator('#document-aside-close');
    const spacing=await toggle.evaluate(node=>{
      const list=document.querySelector('[data-root-navigation] .item-list'),row=list.querySelector('.item-control'),title=document.querySelector('.prose h1');
      return {height:node.getBoundingClientRect().height,rowHeight:row.getBoundingClientRect().height,
        gap:node.getBoundingClientRect().top-title.getBoundingClientRect().bottom,rowGap:parseFloat(getComputedStyle(list).rowGap)};
    });
    assert.ok(Math.abs(spacing.height-spacing.rowHeight)<0.1,'The toggle must occupy one navigation row.');
    assert.ok(Math.abs(spacing.gap-spacing.rowGap)<0.1,'Toggle spacing must match the navigation row gap.');
    assert.equal(await page.locator('#document-aside button').count(),1,'The aside must have one explicit close control.');
    assert.ok(await close.evaluate(node=>node.closest('.document-tools')===document.querySelector('#document-aside').lastElementChild
      &&!!(document.querySelector('.document-toc').compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING)),
      'The close control must follow the chapter list.');
    for(const theme of ['light','dark']) {
      await setTheme(page,theme);
      const reference=page.locator('[data-root-navigation] .item-control:not(.is-current)').first();
      await reference.hover();await setTheme(page,theme);const preview=await paint(reference);
      await toggle.hover();await setTheme(page,theme);
      assert.deepEqual(await paint(toggle),preview,'The collapsed toggle must reuse navigation hover styles.');
      await page.mouse.move(0,0);await openAside(page);await setTheme(page,theme);
      const metadata=await page.locator('.document-meta__row').evaluateAll(rows=>{
        const boxes=rows.map(row=>row.getBoundingClientRect());
        return boxes.slice(1).map((box,index)=>box.top-boxes[index].bottom);
      });
      if(metadata.length)assert.ok(Math.max(...metadata)-Math.min(...metadata)<=1,'Metadata rows must have uniform spacing.');
      const taxonomy=page.locator('.document-meta__row--taxonomy-path').first();
      if(await taxonomy.count()) {
        await taxonomy.hover();
        assert.equal(await taxonomy.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)','A multi-link metadata row must have no hover background.');
      }
      const selected=page.locator('[data-root-navigation] .item-control.is-current');
      assert.equal(await selected.count(),1,'The page must have one selected root entry.');
      assert.deepEqual(await paint(toggle),await paint(selected),'The expanded toggle must reuse selected navigation styles.');
      assert.equal(await toggle.evaluate(node=>getComputedStyle(node).borderTopWidth),'0px');
      assert.ok(await page.evaluate(()=>{
        const starts=['.document-toc a[data-chapter-anchor="main"] .item-title','.document-toc__h2 .item-title','#document-aside-close .item-title']
          .map(selector=>document.querySelector(selector).getBoundingClientRect().left);
        return starts.every(left=>Math.abs(left-starts[0])<0.1);
      }),'The close control and top-level chapters must align with the chapter header.');
      await activate(page,close);
    }
    results.push({width,...spacing});
  }
  return {page:options.page,cases:results,themes:['light','dark']};
}
