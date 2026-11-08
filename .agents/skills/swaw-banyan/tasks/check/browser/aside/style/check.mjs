import assert from 'node:assert/strict';
import {setTheme} from '../../_shared/theme.mjs';
import {activate} from '../../_shared/viewport.mjs';
import {openArticle,openAside} from '../_shared/page.mjs';

export async function check({page,baseUrl,options}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  const paint=locator=>locator.evaluate(node=>({color:getComputedStyle(node).color,background:getComputedStyle(node,'::before').backgroundColor,
    ring:getComputedStyle(node,'::before').boxShadow}));
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:900});await openArticle(page,baseUrl+options.page);
    const toggle=page.locator('#document-aside-toggle'),close=page.locator('#document-aside-close');
    const spacing=await toggle.evaluate(node=>{
      const row=document.querySelector('[data-root-navigation] .item-control'),title=document.querySelector('.prose h1');
      const button=node.getBoundingClientRect(),heading=title.getBoundingClientRect(),container=node.parentElement.getBoundingClientRect();
      const rtl=getComputedStyle(node).direction==='rtl';
      return {height:button.height,width:button.width,rowHeight:row.getBoundingClientRect().height,
        topGap:button.top-heading.top,endGap:rtl?button.left-container.left:container.right-button.right,
        titleGap:rtl?heading.left-button.right:button.left-heading.right};
    });
    assert.ok(Math.abs(spacing.height-spacing.rowHeight)<0.1,'The toggle must occupy one navigation row.');
    assert.ok(Math.abs(spacing.topGap)<0.1&&Math.abs(spacing.endGap)<0.1&&spacing.titleGap>=7,
      'The toggle must share the title row and align at its inline end without overlap.');
    assert.ok(spacing.width>=24&&spacing.height>=24,'The icon control must retain a usable target size.');
    assert.equal(await page.locator('.prose h1').evaluate(node=>getComputedStyle(node).marginBottom),'0px',
      'The title must not retain the old separate tool-row spacing.');
    const label=await page.locator('#document-aside').getAttribute('aria-label');
    assert.ok(label);assert.equal(await toggle.getAttribute('aria-label'),label);assert.equal(await toggle.getAttribute('title'),label);
    assert.equal(await toggle.locator('.item-icon .icon use').getAttribute('href'),'#icon-menu');
    const title=page.locator('.prose h1'),text=await title.textContent();
    try {
      await title.evaluate(node=>{node.textContent+=' Long title 测试'.repeat(20);});
      assert.ok(await toggle.evaluate(node=>{
        const button=node.getBoundingClientRect(),heading=node.parentElement.querySelector('h1').getBoundingClientRect();
        return heading.height>button.height&&Math.abs(button.top-heading.top)<0.1
          &&(getComputedStyle(node).direction==='rtl'?heading.left>=button.right:heading.right<=button.left);
      }),'Long titles must wrap without moving or overlapping the toggle.');
    } finally {await title.evaluate((node,text)=>{node.textContent=text;},text);}
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
      const directory=page.locator('.document-meta__row--path').first();
      if(await directory.count()) {
        await directory.hover();
        assert.equal(await directory.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)','A multi-link metadata row must have no hover background.');
      }
      const selected=page.locator('[data-root-navigation] .item-control.is-current');
      assert.equal(await selected.count(),1,'The page must have one selected root entry.');
      assert.deepEqual(await paint(toggle),await paint(selected),'The expanded toggle must reuse selected navigation styles.');
      const icon=toggle.locator('.icon');
      assert.equal(await icon.evaluate(node=>getComputedStyle(node).color),(await paint(toggle)).color,'The icon must inherit the control color.');
      const visible=await toggle.screenshot({animations:'disabled'});
      let hidden;
      try {await icon.evaluate(node=>{node.style.visibility='hidden';});hidden=await toggle.screenshot({animations:'disabled'});}
      finally {await icon.evaluate(node=>{node.style.removeProperty('visibility');});}
      assert.ok(!visible.equals(hidden),'The expanded icon must remain visible above the control background.');
      assert.equal(await toggle.evaluate(node=>getComputedStyle(node).borderTopWidth),'0px');
      assert.ok(await page.evaluate(()=>{
        const edge=getComputedStyle(document.documentElement).direction==='rtl'?'right':'left';
        const starts=['.document-toc a[data-chapter-anchor="main"] .item-title','.document-toc__h2 .item-title','#document-aside-close .item-title']
          .map(selector=>document.querySelector(selector).getBoundingClientRect()[edge]);
        return starts.every(left=>Math.abs(left-starts[0])<0.1);
      }),'The close control and top-level chapters must align with the chapter header.');
      await activate(page,close);
    }
    results.push({width,...spacing});
  }
  return {page:options.page,cases:results,themes:['light','dark']};
}
