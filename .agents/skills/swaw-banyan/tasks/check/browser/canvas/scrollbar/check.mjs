import assert from 'node:assert/strict';
import {openArticle,openAside} from '../../aside/_shared/page.mjs';
import {afterPaint} from '../../_shared/viewport.mjs';
import {panCanvas} from '../_shared/state.mjs';

const read=page=>page.locator('.page-content').evaluate(column=>{
  const aside=document.querySelector('.document-aside').getBoundingClientRect();
  return {supportsColor:CSS.supports('scrollbar-color','auto'),color:getComputedStyle(column).getPropertyValue('scrollbar-color'),
    nestedColor:getComputedStyle(column.firstElementChild).getPropertyValue('scrollbar-color'),
    width:column.clientWidth,scrollbar:column.offsetWidth-column.clientWidth,gap:aside.left-column.getBoundingClientRect().right,
    expectedGap:parseFloat(getComputedStyle(column.parentElement).columnGap),overflowX:column.scrollWidth-column.clientWidth,
    maxY:column.scrollHeight-column.clientHeight,y:column.scrollTop,
    hidesIdle:matchMedia('(hover: hover) and (pointer: fine) and (forced-colors: none)').matches};
});
const idle=page=>page.waitForFunction(()=>!document.querySelector('.page-content').hasAttribute('data-scrolling'));
const readCanvas=page=>page.evaluate(()=>{
  const canvas=document.scrollingElement;
  return {color:getComputedStyle(canvas).getPropertyValue('scrollbar-color'),
    nestedColor:getComputedStyle(document.body).getPropertyValue('scrollbar-color'),
    width:canvas.clientWidth,gutter:innerHeight-canvas.clientHeight,
    maxX:canvas.scrollWidth-(window.visualViewport?.width??canvas.clientWidth),x:window.visualViewport?.pageLeft??scrollX};
});
const idleCanvas=page=>page.waitForFunction(()=>!document.scrollingElement.hasAttribute('data-scrolling'));

export async function check({page,baseUrl,options}) {
  const widths=options.widths.split(',').map(Number),cases=[];
  await page.setViewportSize({width:widths[0],height:900});await openArticle(page,baseUrl+options.page);await openAside(page,options.touch);
  await page.mouse.move(0,0);
  await page.locator('.page-content[data-auto-scrollbar]').waitFor({state:'attached'});
  await page.locator('html[data-auto-scrollbar]').waitFor({state:'attached'});
  // Return to the first width to catch geometry retained from an earlier size.
  for(const width of widths.length>1?[...widths,widths[0]]:widths) {
    await page.setViewportSize({width,height:900});await afterPaint(page);await idle(page);await idleCanvas(page);
    const resized=await read(page),expected=resized.hidesIdle?'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)':'auto';
    assert.ok(resized.maxY>0,'Choose an article that scrolls at 900 pixels high.');
    // Engines without scrollbar-color still exercise activity and geometry.
    // Report the capability explicitly; do not claim to have sampled colors.
    if(resized.supportsColor) {
      assert.equal(resized.color,expected,'Idle scrollbar colors must follow the pointer capability.');
      assert.equal(resized.nestedColor,'auto','Nested prose must retain native scrollbar colors.');
    }
    await page.locator('.page-content').evaluate(column=>{
      const range=column.scrollHeight-column.clientHeight;
      column.scrollTop=Math.round(range*(column.scrollTop<range/2?0.65:0.25));
    });
    await page.waitForFunction(()=>document.querySelector('.page-content').hasAttribute('data-scrolling'));
    const active=await read(page);
    if(active.supportsColor)assert.equal(active.color,'auto','Scrolling must reveal native scrollbar colors.');
    await idle(page);const settled=await read(page);
    if(settled.supportsColor)assert.equal(settled.color,resized.color,'Idle must restore the original scrollbar colors.');
    for(const state of [resized,active,settled]) {
      assert.equal(state.width,resized.width,'Scrollbar activity must preserve the reading width.');
      assert.equal(state.scrollbar,resized.scrollbar,'Scrollbar activity must preserve the gutter.');
      assert.ok(Math.abs(state.gap-state.expectedGap)<=1,'Scrollbar activity must preserve the aside gap.');
      assert.equal(state.overflowX,0,'Reading content must not overflow horizontally.');
    }
    assert.equal(settled.y,active.y,'Idle must preserve the reading position.');
    assert.ok(active.y>0&&active.y!==resized.y,'Exercise a changed reading position.');
    const canvasIdle=await readCanvas(page);
    assert.ok(canvasIdle.maxX>0,'The canvas must scroll horizontally.');
    if(resized.supportsColor) {
      assert.equal(canvasIdle.color,expected,'Idle canvas scrollbar colors must follow the pointer capability.');
      assert.equal(canvasIdle.nestedColor,'auto','Canvas scrollbar colors must not hide nested scrollbars.');
    }
    await panCanvas(page,Math.round(canvasIdle.maxX*(canvasIdle.x<canvasIdle.maxX/2?0.65:0.25)));
    await page.waitForFunction(()=>document.scrollingElement.hasAttribute('data-scrolling'));
    const canvasActive=await readCanvas(page);
    if(resized.supportsColor)assert.equal(canvasActive.color,'auto','Canvas scrolling must reveal native scrollbar colors.');
    await idleCanvas(page);const canvasSettled=await readCanvas(page);
    assert.equal(canvasSettled.x,canvasActive.x,'Idle must preserve the canvas position.');
    assert.equal(canvasSettled.width,canvasIdle.width,'Canvas scrollbar activity must preserve the viewport width.');
    assert.equal(canvasSettled.gutter,canvasIdle.gutter,'Canvas scrollbar activity must preserve the gutter.');
    if(resized.supportsColor)assert.equal(canvasSettled.color,expected,'Idle must hide the canvas scrollbar again.');
    let canvasHover;
    if(!options.touch&&canvasIdle.gutter>0) {
      await page.mouse.move(20,899);
      await page.waitForFunction(()=>document.scrollingElement.hasAttribute('data-scrollbar-hover'));
      canvasHover=await readCanvas(page);
      if(resized.supportsColor)assert.equal(canvasHover.color,'auto','Hovering the canvas scrollbar must reveal native colors.');
      await page.mouse.move(0,0);
      await page.waitForFunction(()=>!document.scrollingElement.hasAttribute('data-scrollbar-hover'));
      if(resized.supportsColor)assert.equal((await readCanvas(page)).color,expected,'Leaving the canvas scrollbar must restore idle colors.');
    }
    cases.push({width,resized,active,idle:settled,canvas:{idle:canvasIdle,active:canvasActive,settled:canvasSettled,hover:canvasHover}});
  }
  const first=cases[0].resized,last=cases.at(-1).resized;
  assert.equal(last.width,first.width,'Returning to the first viewport width must restore the reading width.');
  assert.equal(last.scrollbar,first.scrollbar,'Returning to the first viewport width must restore the gutter.');
  const height=await page.locator('.page-content').evaluate(column=>column.scrollHeight+100);
  await page.setViewportSize({width:widths[0],height});await afterPaint(page);await idle(page);
  const short=await read(page);
  assert.ok(short.maxY<=0,'Expanded viewport must fit the entire article.');
  assert.ok(Math.abs(short.gap-short.expectedGap)<=1,'A non-scrolling article must retain its aside gap.');
  return {page:options.page,cases,short};
}
