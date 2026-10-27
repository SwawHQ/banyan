import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse,visiblePoint} from '../../_shared/viewport.mjs';
import {touchDrag} from '../_shared/touch.mjs';

export async function check({page,context,baseUrl,options}) {
  await page.setViewportSize({width:390,height:900});
  await page.addInitScript(()=>{
    const trace=window.__swbanTouchSnap={points:0,end:null,calls:[],ends:0,release:null};
    for(const name of ['touchstart','touchmove','touchend','touchcancel'])
      window.addEventListener(name,event=>{
        trace.points=event.touches.length;
        if(name==='touchend')trace.release={x:window.visualViewport?.pageLeft??scrollX,trusted:event.isTrusted};
      },{capture:true,passive:true});
    const ended=event=>{
      if(event.target!==document&&event.target!==window.visualViewport)return;
      trace.end=event;trace.ends++;
    };
    document.addEventListener('scrollend',ended,true);
    window.visualViewport?.addEventListener('scrollend',ended,true);
    const native=Element.prototype.scrollIntoView;window.__swbanTouchNativeView=native;
    Element.prototype.scrollIntoView=function(options) {
      if(this.matches('.page-column'))trace.calls.push({x:window.visualViewport?.pageLeft??scrollX,
        points:trace.points,inEnd:!!trace.end&&trace.end.eventPhase!==Event.NONE,trustedEnd:trace.end?.isTrusted});
      return native.call(this,options);
    };
  });
  const url=baseUrl+options.page,response=await page.goto(url,{waitUntil:'load'});
  assert.ok(response?.ok(),'The touch article must return a successful response.');
  await waitForBrowse(page);await afterPaint(page);
  const read=()=>page.evaluate(()=>{
    const view=window.visualViewport,edge=parseFloat(getComputedStyle(document.body).paddingInlineStart);
    return {x:view?.pageLeft??scrollX,y:document.querySelector('.page-content').scrollTop,
      width:view?.width??innerWidth,mode:document.documentElement.dataset.canvasWheel,
      snap:getComputedStyle(document.documentElement).scrollSnapType,
      columns:[...document.querySelectorAll('.page-column')].filter(node=>node.getBoundingClientRect().width).map(node=>({
        x:node.getBoundingClientRect().left+scrollX-edge,width:node.getBoundingClientRect().width,
        align:getComputedStyle(node).scrollSnapAlign}))};
  });
  const cdp=await context.newCDPSession(page),cases=[];
  const swipe=async({x,dx=0,dy=0,y=700})=>{
    const drag=await touchDrag(page,cdp,{x,dx,dy,y}),after=await read();
    assert.equal(after.snap,'none','Touch scrolling must retain native free positioning.');
    assert.ok(after.columns.every(column=>column.align==='none'),'Touch columns must not expose paging stops.');
    assert.equal(page.url(),url,'A touch gesture must not activate a link.');
    assert.notEqual(after.mode,'locked','Native touch input must not enter mouse wheel mode.');
    if(!dy)assert.equal(drag.after.y,drag.before.y,'Horizontal touch input must preserve article reading progress.');
    cases.push(drag);return after;
  };
  try {
    const initial=await read();assert.equal(initial.x,0,'The touch sample must start at the canvas origin.');
    const first=initial.columns.find(column=>column.x>1)?.x;
    assert.ok(first,'The touch sample must include a second column.');
    const partial=await swipe({x:280,dx:-90});
    assert.ok(partial.x>1&&partial.x<first-1,'A short drag must stop between column edges.');
    assert.ok(partial.columns.every(column=>Math.abs(partial.x-column.x)>1),'Free touch scrolling must not force column alignment.');
    await page.waitForTimeout(250);
    assert.ok(Math.abs((await read()).x-partial.x)<=1,'A resting touch position must not snap later.');

    await page.locator('.page-rail').evaluate(node=>node.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'}));await afterPaint(page);
    await page.evaluate(()=>{window.__swbanTouchSnap.calls=[];});
    const point=x=>({x,y:700,id:1});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(300)]});
    for(let step=1;step<=12;step++) {
      await page.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(300-210*step/12)]});
    }
    await page.waitForTimeout(250);
    const held=await read(),heldDistance=first-held.x;
    assert.ok(heldDistance>0&&heldDistance<=64,'The held gesture must approach a column edge within 64 pixels: '+JSON.stringify({first,held}));
    assert.deepEqual(await page.evaluate(()=>window.__swbanTouchSnap.calls),[],
      'Holding a touch near an edge must not align while the finger is down.');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(x=>Math.abs((window.visualViewport?.pageLeft??scrollX)-x)<=1,first);
    const approached=await read(),approachCalls=await page.evaluate(()=>window.__swbanTouchSnap.calls);
    assert.equal(approachCalls.length,1,'A finished native gesture must align once.');
    assert.ok(approachCalls[0].inEnd&&approachCalls[0].trustedEnd&&approachCalls[0].points===0,
      'Touch alignment must run from native scrollend after all fingers are released: '+JSON.stringify(approachCalls));

    const boundaries=await page.evaluate(()=>{
      const shell=document.querySelector('.page-shell'),column=document.querySelector('.path-column');
      const edge=parseFloat(getComputedStyle(document.body).paddingInlineStart);
      const target=column.getBoundingClientRect().left+scrollX-edge,trace=window.__swbanTouchSnap;
      const position=x=>{
        const previous=column.style.scrollMarginInlineStart;
        column.style.scrollMarginInlineStart=column.getBoundingClientRect().left+scrollX-x+'px';
        window.__swbanTouchNativeView.call(column,{inline:'start',block:'nearest',behavior:'instant'});
        column.style.scrollMarginInlineStart=previous;
      };
      const touch=(name,points)=>shell.dispatchEvent(new TouchEvent(name,{bubbles:true,
        touches:points.map((x,index)=>new Touch({identifier:index,target:shell,clientX:x,clientY:700})),
        changedTouches:points.map((x,index)=>new Touch({identifier:index,target:shell,clientX:x,clientY:700}))}));
      const results=[];
      for(const direction of [1,-1])for(const distance of [-4,64,65]) {
        position(target-direction*(distance+4));trace.calls=[];
        touch('touchstart',[250]);touch('touchmove',[250-direction*20]);
        position(target-direction*distance);
        document.dispatchEvent(new Event('scroll',{bubbles:true}));window.visualViewport?.dispatchEvent(new Event('scroll'));
        const before=window.visualViewport?.pageLeft??scrollX;
        touch('touchend',[]);document.dispatchEvent(new Event('scrollend'));
        window.visualViewport?.dispatchEvent(new Event('scrollend'));
        results.push({direction,distance,target,before,after:window.visualViewport?.pageLeft??scrollX,calls:trace.calls.length});
      }
      for(const cancel of ['multitouch','touchcancel','mouse','wheel','keyboard','resize']) {
        position(target-68);trace.calls=[];
        touch('touchstart',[250]);touch('touchmove',[230]);
        position(target-64);document.dispatchEvent(new Event('scroll',{bubbles:true}));window.visualViewport?.dispatchEvent(new Event('scroll'));
        if(cancel==='multitouch')touch('touchstart',[230,280]);
        else if(cancel==='touchcancel')touch('touchcancel',[]);
        else if(cancel==='mouse')shell.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0}));
        else if(cancel==='wheel')shell.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:1}));
        else if(cancel==='keyboard')window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
        else window.dispatchEvent(new Event('resize'));
        const before=window.visualViewport?.pageLeft??scrollX;
        touch('touchend',[]);document.dispatchEvent(new Event('scrollend'));
        window.visualViewport?.dispatchEvent(new Event('scrollend'));
        results.push({cancel,before,after:window.visualViewport?.pageLeft??scrollX,calls:trace.calls.length});
      }
      position(target);return results;
    });
    for(const result of boundaries) {
      if(result.distance===64) {
        assert.ok(Math.abs(result.after-result.target)<=1,'An edge exactly 64 pixels ahead must align: '+JSON.stringify(result));
        assert.equal(result.calls,1,'Root and visual viewport scrollend must not align twice: '+JSON.stringify(result));
      } else {
        assert.ok(Math.abs(result.after-result.before)<=1,'An outside-range or cancelled gesture must retain its position: '+JSON.stringify(result));
        assert.equal(result.calls,0,'An outside-range or cancelled gesture must not align.');
      }
    }

    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
    const zoom=await page.evaluate(()=>{
      const shell=document.querySelector('.page-shell'),column=document.querySelector('.path-column');
      const edge=parseFloat(getComputedStyle(document.body).paddingInlineStart);
      const target=column.getBoundingClientRect().left+scrollX-edge,trace=window.__swbanTouchSnap;
      const position=x=>{
        const previous=column.style.scrollMarginInlineStart;
        column.style.scrollMarginInlineStart=column.getBoundingClientRect().left+scrollX-x+'px';
        window.__swbanTouchNativeView.call(column,{inline:'start',block:'nearest',behavior:'instant'});
        column.style.scrollMarginInlineStart=previous;
      };
      const touch=(name,x)=>shell.dispatchEvent(new TouchEvent(name,{bubbles:true,
        touches:x===null?[]:[new Touch({identifier:1,target:shell,clientX:x,clientY:700})]}));
      position(target-68);trace.calls=[];
      touch('touchstart',250);touch('touchmove',230);position(target-64);
      document.dispatchEvent(new Event('scroll',{bubbles:true}));window.visualViewport.dispatchEvent(new Event('scroll'));
      const before=window.visualViewport.pageLeft;touch('touchend',null);
      document.dispatchEvent(new Event('scrollend'));window.visualViewport.dispatchEvent(new Event('scrollend'));
      return {scale:window.visualViewport.scale,before,after:window.visualViewport.pageLeft,calls:trace.calls.length};
    });
    assert.equal(zoom.scale,2,'The zoom exclusion must exercise a magnified visual viewport.');
    assert.equal(zoom.after,zoom.before,'A zoomed touch gesture must retain native positioning.');
    assert.equal(zoom.calls,0,'A zoomed viewport must not receive touch alignment.');
    await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await afterPaint(page);

    await page.locator('.page-rail').evaluate(node=>node.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'}));await afterPaint(page);
    await page.evaluate(()=>{window.__swbanTouchSnap.calls=[];window.__swbanTouchSnap.ends=0;window.__swbanTouchSnap.release=null;});
    // Input timestamps keep flick velocity independent of Node scheduling.
    const flickAt=Date.now()/1000;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(300)],timestamp:flickAt});
    for(let step=1;step<=6;step++) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(300-140*step/6)],timestamp:flickAt+step/120});
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[],timestamp:flickAt+7/120});
    const release=await page.evaluate(()=>window.__swbanTouchSnap.release);
    assert.equal(release?.trusted,true,'A native flick must release a trusted touch gesture.');
    await page.waitForFunction(()=>window.__swbanTouchSnap.ends>0);await page.waitForTimeout(80);
    const inertia=await read(),inertiaCalls=await page.evaluate(()=>window.__swbanTouchSnap.calls);
    assert.ok(inertia.x>release.x+1,'Native inertia must continue a fast flick after release: '+JSON.stringify({release,inertia}));
    assert.notEqual(inertia.mode,'locked','Native inertia must not enter mouse wheel mode.');
    assert.ok(inertiaCalls.length<=1,'One native flick must align at most once.');
    assert.ok(inertiaCalls.every(call=>call.inEnd&&call.trustedEnd&&call.points===0),
      'A flick must retain native inertia until the browser reports scrollend.');

    const content=page.locator('.page-content');
    await content.evaluate(node=>node.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'}));await afterPaint(page);
    const verticalBefore=await read(),vertical=await swipe({x:250,dy:-100});
    assert.ok(vertical.y>verticalBefore.y,'Vertical native touch input must scroll the article.');
    assert.ok(Math.abs(vertical.x-verticalBefore.x)<=1,'Vertical reading must preserve the canvas position.');
    await content.evaluate(node=>{node.scrollTop=0;});await afterPaint(page);
    const code=page.locator('.prose pre').first();await code.evaluate(node=>{node.scrollLeft=0;});
    const codePoint=await visiblePoint(code),nestedBefore=await read();
    await swipe({x:Math.min(280,codePoint.x),y:codePoint.y,dx:-80});
    assert.ok(await code.evaluate(node=>node.scrollLeft>0),'Native code scrolling must remain available inside a column.');
    assert.ok(Math.abs((await read()).x-nestedBefore.x)<=1,'Nested code scrolling must preserve the canvas position.');

    // A wide final column must remain reachable without a native snap point pulling it back.
    await content.evaluate(node=>{node.style.inlineSize='700px';node.style.maxInlineSize='none';
      node.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'});});await afterPaint(page);
    const wideStart=await read();
    assert.ok(wideStart.columns.at(-1).width>wideStart.width,'The final column must exceed the visible viewport.');
    const right=()=>content.evaluate(node=>node.getBoundingClientRect().right-(window.visualViewport?.offsetLeft??0));
    for(let attempt=0;attempt<6&&(await right())>wideStart.width-8;attempt++)
      await swipe({x:330,dx:-180});
    const wideEnd=await read();
    assert.ok(wideEnd.x>wideStart.x+200,'Touch scrolling must move into the wide final column.');
    assert.ok((await right())<=wideEnd.width-8,'Touch scrolling must expose the right edge of the wide final column.');
    await page.waitForTimeout(250);
    assert.ok(Math.abs((await read()).x-wideEnd.x)<=1,'The wide column must not rebound to its left edge.');
    return {initial,partial,held,approached,boundaries,zoom,release,inertia,inertiaCalls,cases,wideStart,wideEnd};
  } finally {await cdp.detach();}
}
