import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse,visiblePoint} from '../../_shared/viewport.mjs';
import {readCanvas,waitForCanvasX} from '../_shared/state.mjs';
import {touchDrag,touchPosition} from '../_shared/touch.mjs';
import {openAside} from '../../aside/_shared/page.mjs';

export async function check({page,context,baseUrl,options}) {
  await page.setViewportSize({width:390,height:900});
  assert.notEqual(options.page,options.next,'--next must select a different page.');
  await page.addInitScript(()=>{
    window.__swbanTouchStarts=[];
    document.addEventListener('touchstart',event=>window.__swbanTouchStarts.push({trusted:event.isTrusted,
      region:event.target.closest('[data-root-navigation]')?'root':event.target.closest('.prose')?'prose':
        event.target.closest('.document-aside')?'aside':'column'}),{passive:true});
  });
  const url=baseUrl+options.page,response=await page.goto(url,{waitUntil:'load'});
  assert.ok(response?.ok(),'Article must return a successful response.');await waitForBrowse(page);await afterPaint(page);
  const initial=await readCanvas(page),width=initial.viewport;
  assert.equal(initial.canvasOffsetX,0,'A direct visit must start at the canvas origin.');
  assert.ok(await page.evaluate(()=>navigator.maxTouchPoints>0),'The browser context must support native touch input.');
  assert.ok(initial.nav.x>=0&&initial.nav.right<=width,'Root navigation must be visible before dragging.');
  const cdp=await context.newCDPSession(page),drags=[],documents=[];
  const record=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())documents.push(request.url());};
  page.on('request',record);
  try {
    const swipe=async(x,dx,dy=0,y=180)=>{
      const drag=await touchDrag(page,cdp,{x,dx,dy,y});drags.push(drag);
      if(!dy)assert.equal(drag.after.y,drag.before.y,'Horizontal touch input must preserve the vertical reading position.');
      assert.equal(page.url(),url,'Dragging a navigation link must not activate it.');
      assert.deepEqual(documents,[],'Dragging must not request a new document.');
      return drag;
    };
    const root=await visiblePoint(page.locator('[data-root-navigation] [data-root-href]').first());
    await swipe(root.x,-Math.min(180,root.x-15),0,root.y);
    assert.ok((await touchPosition(page)).x>0,'A leftward drag on a root link must move the canvas.');
    const limit=Math.ceil(initial.maxX/(width-90))+4;
    for(let attempt=0;attempt<limit&&(await readCanvas(page)).main.x>16;attempt++)
      await swipe(width-40,-Math.min(width-90,(await readCanvas(page)).main.x));
    const reading=await readCanvas(page);
    assert.ok(reading.main.x>=0&&reading.main.x<=16&&reading.main.right<=width+1,'Native dragging must reveal the reading column.');
    await swipe(50,120);await swipe(width-90,-120);
    await openAside(page,true);
    const asideBounds=()=>page.locator('.document-aside').evaluate(node=>{
      const box=node.getBoundingClientRect(),offset=window.visualViewport?.offsetLeft||0;
      return {x:box.x-offset,right:box.right-offset};
    });
    for(let attempt=0;attempt<limit&&(await asideBounds()).right>width;attempt++)
      await swipe(width-40,-Math.min(width-90,Math.max(40,(await asideBounds()).right-width)));
    const aside=await asideBounds();
    assert.ok(aside.x>=0&&aside.right<=width+1,'Native dragging must reveal the metadata column.');
    for(let attempt=0;attempt<limit&&(await readCanvas(page)).main.x<0;attempt++)
      await swipe(width-90,Math.min(width-90,16-(await readCanvas(page)).main.x));
    const returned=await readCanvas(page);
    assert.ok(returned.main.x>=0&&returned.main.right<=width+1,'A rightward metadata drag must restore the reading column.');
    await swipe(210,0,-120);await swipe(50,180);
    const position=await touchPosition(page);
    assert.ok(position.x>0&&position.x<reading.canvasOffsetX&&position.y>0,'Native gestures must set a partial canvas position and scroll the long article vertically.');
    const events=await page.evaluate(()=>window.__swbanTouchStarts);
    for(const region of ['root','prose','aside'])assert.ok(events.some(event=>event.trusted&&event.region===region),'Native touch must reach '+region+'.');
    assert.ok(events.every(event=>event.trusted),'All observed touch starts must be browser input.');
    page.off('request',record);
    assert.equal(await page.evaluate(()=>history.scrollRestoration),'auto','The browser must own history restoration.');
    await page.waitForLoadState('networkidle');
    const next=await page.goto(baseUrl+options.next,{waitUntil:'load'});
    assert.ok(next?.ok(),'Next page must return a successful response.');
    await page.goBack();assert.equal(page.url(),url,'Back must restore the article URL.');
    await waitForBrowse(page);await waitForCanvasX(page,position.x,'Back after real touch input');
    return {page:options.page,next:options.next,initial,reading,aside,returned,drags,events,position,restored:await touchPosition(page)};
  } finally {page.off('request',record);await cdp.detach();}
}
