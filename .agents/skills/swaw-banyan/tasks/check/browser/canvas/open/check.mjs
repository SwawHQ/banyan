import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse,clickVisible,visiblePoint} from '../../_shared/viewport.mjs';
import {readCanvas,panCanvas,waitForCanvasX} from '../_shared/state.mjs';
import {installStartupProbe,observeStartup} from '../_shared/startup.mjs';
import {checkReservedColumns,checkInitialLayout} from '../first-paint/check.mjs';
import {readOpeningSource,checkOpeningSource} from './source.mjs';
import {touchDrag} from '../_shared/touch.mjs';

async function articleLink(page,article) {
  const target=new URL(article,page.url()).pathname;
  const matches=await page.locator('main [data-list-entry][href]').evaluateAll((nodes,target)=>nodes
    .filter(node=>new URL(node.href).pathname===target).map(node=>({href:node.getAttribute('href'),url:node.href})),target);
  assert.equal(matches.length,1,'Source collection must link to the requested article exactly once.');
  assert.equal(new URL(matches[0].url).origin,new URL(page.url()).origin,'Article must stay within the local site.');
  return page.locator('main [data-list-entry][href='+JSON.stringify(matches[0].href)+']');
}

async function centerVertically(link) {
  await link.evaluate(node=>{
    const column=node.closest('.page-content,.path-column'),box=node.getBoundingClientRect(),parent=column.getBoundingClientRect();
    column.scrollTop+=box.top+box.height/2-parent.top-parent.height/2;
  });
}

async function checkOpenResult(page,before,name,state,target) {
  assert.equal(page.url(),target,'Opening must retain the source link URL, including source and sort state.');
  checkReservedColumns(state.first,state.final);checkInitialLayout(state.first,state.final,before.canvasOffsetX);
  const after=state.final;
  assert.equal(after.columns.length,before.columns.length+1,'Opening an article must add one source list column.');
  assert.ok(Math.abs(after.nav.x-before.nav.x)<=1,'Root navigation must stay in place.');
  assert.ok(before.columns.every((column,index)=>Math.abs(column.x-after.columns[index].x)<=1&&Math.abs(column.width-after.columns[index].width)<=1),
    'Existing source columns must stay in place.');
  assert.ok(Math.abs(after.columns.at(-1).x-before.main.x)<=1,'The original collection must remain in the same column.');
  assert.ok(after.mainDocumentX>before.mainDocumentX,'Article content must extend the canvas in the reading direction.');
  assert.equal(after.readingY,0,'A new article must start at the top.');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,'The one-navigation record must be consumed.');
  const selected=page.locator('[data-slot=breadcrumb] [aria-current="page"][href]');
  const row=await selected.evaluateAll((nodes,target)=>{
    const node=nodes.find(node=>node.href===target);if(!node)return null;
    const box=node.getBoundingClientRect();return {x:box.x-(window.visualViewport?.offsetLeft||0),width:box.width};
  },target);
  assert.ok(row,'Source navigation must mark the opened article as current.');
  assert.ok(Math.abs(row.x-name.x)<=1&&Math.abs(row.width-name.width)<=1,'The selected article row must retain its source position and width.');
  return row;
}

async function checkCurrentEntry(page,touch) {
  const currentUrl=page.url();
  const href=await page.locator('[data-slot=breadcrumb] [aria-current="page"][href]').evaluateAll((nodes,url)=>nodes.find(node=>node.href===url)?.getAttribute('href'),currentUrl);
  const selected=page.locator('[data-slot=breadcrumb] [aria-current="page"][href='+JSON.stringify(href)+']');
  await centerVertically(selected);await afterPaint(page);
  const marker=await page.evaluate(()=>{
    window.__swbanCurrentDocument=crypto.randomUUID();
    const content=document.querySelector('.page-content');content.scrollTop=Math.min(120,content.scrollHeight-content.clientHeight);
    return window.__swbanCurrentDocument;
  });await afterPaint(page);
  const before=await readCanvas(page);assert.ok(before.readingY>0,'Choose an article with overflowing reading content at 900 pixels high.');
  let requests=0;
  const record=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())requests++;};
  page.on('request',record);
  try {await clickVisible(page,selected,touch);await afterPaint(page);}
  catch(error) {throw new Error('Current article click failed: '+error.message);}
  finally {page.off('request',record);}
  assert.equal(requests,0,'Clicking the current article must not request a new document.');
  assert.equal(page.url(),currentUrl,'Clicking the current article must preserve its URL.');
  assert.equal(await page.evaluate(()=>window.__swbanCurrentDocument),marker,'Clicking the current article must retain the document.');
  const after=await readCanvas(page);
  assert.equal(after.readingY,before.readingY,'Clicking the current article must preserve the reading position.');
  assert.ok(Math.abs(after.canvasOffsetX-before.canvasOffsetX)<=1,'Clicking the current article must preserve the canvas position.');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,'Clicking the current article must not leave a navigation record.');
  return {readingY:after.readingY,canvasOffsetX:after.canvasOffsetX};
}

async function checkOpenedHistory(page,sourceUrl,target,before,after,source) {
  // Complete the opened page's asset requests before its native history snapshot.
  await page.waitForLoadState('networkidle');
  assert.equal(await page.evaluate(()=>history.scrollRestoration),'auto','The browser must own history restoration after opening.');
  await page.reload();await waitForBrowse(page);
  assert.equal(await page.evaluate(()=>history.scrollRestoration),'auto','The browser must own history restoration after reload.');
  await waitForCanvasX(page,after.canvasOffsetX,'Reload after opening');
  const reload=await checkOpeningSource(page,source);
  await page.goBack();assert.equal(page.url(),sourceUrl,'Back must return to the actual source collection.');
  await waitForBrowse(page);await waitForCanvasX(page,before.canvasOffsetX,'Back after opening');
  assert.deepEqual(await readOpeningSource(page,await readCanvas(page)),source,'Back must restore the collection source, root, siblings and sorting.');
  await page.goForward();assert.equal(page.url(),target,'Forward must return to the opened article.');
  await waitForBrowse(page);await waitForCanvasX(page,after.canvasOffsetX,'Forward after opening');
  const forward=await checkOpeningSource(page,source);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,'History must not recreate the one-navigation record.');
  return {reload:after.canvasOffsetX,back:before.canvasOffsetX,forward:(await readCanvas(page)).canvasOffsetX,lineage:{reload,forward}};
}

// Consumer journeys can supply a source already positioned by real touch input.
export async function checkOpening({page,options}) {
  await installStartupProbe(page);
  const sourceUrl=page.url(),entry=await articleLink(page,options.page),target=await entry.evaluate(node=>node.href);
  const before=await readCanvas(page),name=await entry.evaluate(node=>{
    const box=node.getBoundingClientRect();return {x:box.x-(window.visualViewport?.offsetLeft||0),width:box.width};
  });
  const source=await readOpeningSource(page,before);
  assert.ok(Math.abs(name.width-before.nav.width)<=1,'Article names must share the navigation column width.');
  const point=await visiblePoint(entry);
  const state=await observeStartup(page,async()=>{
    await Promise.all([page.waitForURL(target,{waitUntil:'commit'}),options.touch?page.touchscreen.tap(point.x,point.y):page.mouse.click(point.x,point.y)]);
  });
  const selected=await checkOpenResult(page,before,name,state,target);
  const lineage=await checkOpeningSource(page,source);
  const current=await checkCurrentEntry(page,options.touch),history=await checkOpenedHistory(page,sourceUrl,target,before,state.final,source);
  return {from:new URL(sourceUrl).pathname+new URL(sourceUrl).search+new URL(sourceUrl).hash,target:new URL(target).pathname+new URL(target).search+new URL(target).hash,before,name,source,lineage,selected,...state,current,history};
}

export async function check({page,context,baseUrl,options}) {
  const widths=options.widths.split(',').map(Number);
  if(options.drag) {
    assert.ok(options.touch,'--drag requires --touch.');
    assert.ok(options.pan===undefined||options.pan===false,'--drag cannot be combined with --pan.');
    assert.ok(widths.every(width=>width<=430),'--drag requires widths <= 430.');
    assert.ok(options.drag<=Math.min(...widths)-50,'--drag must keep the gesture inside every viewport (width - 50).');
    assert.equal(context.browser().browserType().name(),'chromium','Native dragging requires Chromium.');
  }
  const cases=[];
  for(const width of widths) {
    await page.setViewportSize({width,height:900});
    const response=await page.goto(baseUrl+options.from,{waitUntil:'load'});
    assert.ok(response?.ok(),'Source collection must return a successful response.');await waitForBrowse(page);await afterPaint(page);
    const initial=await readCanvas(page);assert.equal(initial.canvasOffsetX,0,'A direct source visit must start at the canvas origin.');
    const entry=await articleLink(page,options.page);await centerVertically(entry);
    const left=await entry.evaluate(node=>getComputedStyle(document.documentElement).direction==='rtl'
      ?document.documentElement.clientWidth-node.getBoundingClientRect().right-scrollX:node.getBoundingClientRect().left+scrollX);
    const pan=options.drag?0:typeof options.pan==='number'?options.pan:(width<=430?Math.min(initial.maxX,Math.max(0,left-width/5)):0);
    assert.ok(pan<=initial.maxX,'--pan must stay within the source canvas scroll range.');
    await panCanvas(page,pan);await afterPaint(page);await waitForCanvasX(page,pan);
    let drag;
    if(options.drag) {
      assert.ok(await page.evaluate(()=>navigator.maxTouchPoints>0),'Native dragging requires a touch context.');
      assert.equal(await page.evaluate(()=>sessionStorage.getItem('banyan:canvas-navigation')),null,'Source sorting must not create a pending navigation.');
      const sourceUrl=page.url(),cdp=await context.newCDPSession(page),documents=[];
      const record=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents.push(request.url());};
      page.on('request',record);
      try {drag=await touchDrag(page,cdp,{x:initial.direction===-1?40:width-40,dx:-options.drag*initial.direction});}
      finally {page.off('request',record);await cdp.detach();}
      assert.equal(page.url(),sourceUrl,'Dragging the source must not activate a link.');
      assert.deepEqual(documents,[],'Dragging the source must not request a new document.');
      assert.equal(drag.after.y,drag.before.y,'Horizontal dragging must preserve the source reading position.');
      assert.ok(drag.after.x>0,'Real touch input must pan the source canvas.');
    }
    if(width<=430)assert.ok((await readCanvas(page)).canvasOffsetX>0,'Narrow opening checks must exercise a panned source.');
    cases.push({width,...(drag?{drag}:{}),...await checkOpening({page,options})});
  }
  return {from:options.from,page:options.page,cases};
}
