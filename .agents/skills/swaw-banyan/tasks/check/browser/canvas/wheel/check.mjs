import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse,visiblePoint,activate} from '../../_shared/viewport.mjs';
import {assertCanvasEnd,panCanvas} from '../_shared/state.mjs';

const read=page=>page.evaluate(()=>({x:scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1),maxX:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,y:document.querySelector('.page-content').scrollTop,
  mode:document.documentElement.dataset.canvasWheel,pointer:document.documentElement.dataset.canvasPointer}));

const hint=page=>page.evaluate(()=>{
  const node=document.querySelector('[data-canvas-wheel-hint]');
  if(!node)return {visible:false};
  const style=getComputedStyle(node),box=node.getBoundingClientRect();
  return {visible:!node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&node.getClientRects().length>0,
    pointerEvents:style.pointerEvents,ariaHidden:node.getAttribute('aria-hidden'),transform:style.transform,
    left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:document.documentElement.clientWidth,height:document.documentElement.clientHeight};
});

async function checkHint(page,visible,message) {
  await afterPaint(page);const state=await hint(page);
  assert.equal(state.visible,visible,message);
  if(visible) {
    assert.equal(state.pointerEvents,'none','The wheel marker must not intercept links or hit testing.');
    assert.equal(state.ariaHidden,'true','The decorative wheel marker must stay outside the accessibility tree.');
    assert.ok(state.left>=0&&state.right<=state.width+1&&state.top>=0&&state.bottom<=state.height+1,
      'The wheel marker must remain above the native scrollbar and inside the visible page.');
  }
  return state;
}

async function checkStatus(page,message) {
  await afterPaint(page);
  const state=await page.locator('[data-canvas-wheel-status]').evaluate(node=>{
    const style=getComputedStyle(node),box=node.getBoundingClientRect();
    return {visible:!node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0&&box.width>0,
      text:node.textContent,mode:document.documentElement.dataset.canvasWheel,pointer:document.documentElement.dataset.canvasPointer,screen:matchMedia('screen').matches,
      automatic:document.documentElement.hasAttribute('data-auto-scrollbar'),scrolling:document.documentElement.hasAttribute('data-scrolling'),
      hover:document.documentElement.hasAttribute('data-scrollbar-hover'),
      role:node.getAttribute('role'),background:style.backgroundColor,backgroundImage:style.backgroundImage,opacity:style.opacity,
      borders:[style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth].map(parseFloat),
      padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft].map(parseFloat),textAlign:style.textAlign,
      columnsBottom:Math.max(...[...document.querySelectorAll('.page-column')].map(column=>column.getBoundingClientRect().bottom)),
      edge:parseFloat(getComputedStyle(document.body).paddingInlineStart),rtl:getComputedStyle(node).direction==='rtl',
      pointerEvents:style.pointerEvents,position:style.position,left:box.left,right:box.right,top:box.top,bottom:box.bottom,
      width:document.documentElement.clientWidth,height:document.documentElement.clientHeight};
  });
  assert.equal(state.automatic,true,'The canvas scrollbar must initialize before checking its help.');
  assert.equal(state.visible,state.screen&&state.pointer==='mouse'&&(state.scrolling||state.hover||state.mode==='locked'),message);
  assert.ok(state.text.trim(),'Scrollbar help must contain the static instruction.');
  if(state.visible) {
    assert.equal(state.role,'status','The wheel state must be available to assistive technology.');
    assert.equal(state.pointerEvents,'none','The bottom status must not intercept page or scrollbar input.');
    assert.equal(state.position,'fixed','The bottom status must remain in the visible viewport.');
    assert.ok(state.left>=0&&state.right<=state.width+1&&state.bottom<=state.height+1,'The status must fit the visible viewport.');
    assert.ok(Math.abs(state.columnsBottom-state.height)<=1,'Reading columns must retain their full height without a footer reserve.');
    assert.doesNotMatch(state.background,/^(?:transparent|rgba\(0, 0, 0, 0\))$/,'The status must have a background behind its text.');
    assert.equal(state.opacity,'1','Only the background may be translucent; the instruction text must remain opaque.');
    assert.equal(state.backgroundImage,'none','The status must not have a background image.');
    assert.ok(state.borders.every(value=>value===0),'The status must not have a border.');
    assert.ok(state.padding.every(value=>value===0),'The status must not have padding.');
    assert.equal(state.textAlign,'start','The status text must align to the logical start.');
    assert.ok(Math.abs((state.rtl?state.width-state.right:state.left)-state.edge)<=1,
      'The status must align with the navigation start edge in the visible viewport.');
  }
  return state;
}

async function checkHintWork(page) {
  return page.evaluate(async()=>{
    const node=document.querySelector('[data-canvas-wheel-hint]'),shell=document.querySelector('.page-shell');
    const nativeFrame=window.requestAnimationFrame.bind(window),nativeHit=document.elementFromPoint.bind(document);
    const nativeRect=Element.prototype.getBoundingClientRect;
    const calls={requested:0,fired:0,writes:0,hits:0,rects:0};
    const observer=new MutationObserver(records=>{calls.writes+=records.length;});observer.observe(node,{attributes:true,attributeFilter:['style']});
    window.requestAnimationFrame=callback=>{calls.requested++;return nativeFrame(time=>{calls.fired++;callback(time);});};
    document.elementFromPoint=(...args)=>{calls.hits++;return nativeHit(...args);};
    Element.prototype.getBoundingClientRect=function(){if(this.classList.contains('page-column'))calls.rects++;return nativeRect.call(this);};
    const frame=()=>new Promise(resolve=>nativeFrame(resolve));
    try {
      for(let index=0;index<100;index++)shell.dispatchEvent(new PointerEvent('pointermove',
        {bubbles:true,pointerType:'mouse',clientX:120+index/10,clientY:160+index/10}));
      await frame();await frame();
      const moving={...calls,transform:getComputedStyle(node).transform};
      await new Promise(resolve=>setTimeout(resolve,100));await frame();
      const idle={...calls},cancelled=[];
      for(const type of ['leave','hidden']) {
        const before={...calls},descriptor=Object.getOwnPropertyDescriptor(document,'hidden');
        try {
          shell.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:150,clientY:180}));
          if(type==='leave')document.documentElement.dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));
          else {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}
          await frame();await frame();
          cancelled.push({type,requested:calls.requested-before.requested,fired:calls.fired-before.fired,writes:calls.writes-before.writes,
            hidden:node.hidden});
        } finally {
          if(type==='hidden'){if(descriptor)Object.defineProperty(document,'hidden',descriptor);else delete document.hidden;}
        }
        shell.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:140,clientY:170}));
        await frame();await frame();
      }
      return {moving,idle,cancelled};
    } finally {observer.disconnect();window.requestAnimationFrame=nativeFrame;document.elementFromPoint=nativeHit;Element.prototype.getBoundingClientRect=nativeRect;}
  });
}

const columnEdge=locator=>locator.evaluate(node=>{
  const box=node.getBoundingClientRect(),rtl=getComputedStyle(document.documentElement).direction==='rtl';
  return (rtl?innerWidth-box.right-scrollX:box.left+scrollX)-parseFloat(getComputedStyle(document.body).paddingInlineStart);
});

async function visit(page,url) {
  const response=await page.goto(url,{waitUntil:'load'});
  assert.ok(response?.ok(),'Wheel pages must return successful responses.');
  await waitForBrowse(page);await afterPaint(page);
  await page.waitForFunction(()=>document.documentElement.dataset.canvasWheel==='ready');
  const toggle=page.locator('#document-aside-toggle');
  if(await toggle.count()&&await toggle.getAttribute('aria-expanded')==='true')await activate(page,toggle);
  await afterPaint(page);
}

async function reveal(page,locator) {
  await locator.evaluate(node=>node.scrollIntoView({block:'center',inline:'start',behavior:'instant'}));
  await afterPaint(page);await page.waitForTimeout(250);
  const point=await visiblePoint(locator);await page.mouse.move(point.x,point.y);return point;
}

async function gapPoint(page) {
  return page.evaluate(()=>{
    const root=document.querySelector('.page-rail').getBoundingClientRect();
    const gap=parseFloat(getComputedStyle(document.querySelector('.page-shell')).columnGap);
    const point={x:getComputedStyle(document.documentElement).direction==='rtl'?root.left-gap/2:root.right+gap/2,y:Math.min(120,innerHeight/2)};
    if(point.x<0||point.x>=innerWidth)throw new Error('The root navigation gap must be visible.');
    if(document.elementFromPoint(point.x,point.y)?.closest('.page-column'))throw new Error('The wheel start point must be a column gap.');
    return point;
  });
}

async function enter(page) {
  const gap=await gapPoint(page);await page.mouse.move(gap.x,gap.y);
  const before=await read(page);
  await page.mouse.wheel(0,160);
  await page.waitForFunction(x=>document.documentElement.dataset.canvasWheel==='locked'&&scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)>x+1,before.x);
  return gap;
}

async function positionCanvas(page,x) {
  await panCanvas(page,x);await afterPaint(page);
}

async function waitCanvasIdle(page) {
  await afterPaint(page);await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-scrolling'));
}

async function settledWheel(page,delta) {
  await page.mouse.wheel(0,delta);await page.waitForTimeout(300);
}

async function checkNativeScrollbar(page,url) {
  await visit(page,url);
  const geometry=await page.evaluate(()=>({width:document.documentElement.clientWidth,height:document.documentElement.clientHeight,
    gutter:innerHeight-document.documentElement.clientHeight,rtl:getComputedStyle(document.documentElement).direction==='rtl',
    supportsColor:CSS.supports('scrollbar-color','auto')}));
  if(geometry.gutter<=0)return {...geometry,skipReason:'The browser has no native horizontal scrollbar gutter; native track input was not exercised.'};
  const point={x:geometry.width/2,y:geometry.height+geometry.gutter/2};
  await page.mouse.move(point.x,point.y);await page.waitForTimeout(600);
  await checkHint(page,false,'Hovering the native horizontal track must not show the locked wheel marker.');
  const hovered=await checkStatus(page,'Native-track help must follow scrollbar hover activity.');
  assert.equal(hovered.visible,true,'Hovering the native scrollbar must reveal its help.');
  assert.equal(hovered.mode,'ready','Native scrollbar hover must not enter wheel mode.');
  const guards=await page.evaluate(point=>{
    const root=document.documentElement,states=[];
    for(const modifiers of [{ctrlKey:true},{metaKey:true},{buttons:1},{buttons:4}]) {
      const before=scrollX,allowed=root.dispatchEvent(new WheelEvent('wheel',
        {bubbles:true,cancelable:true,clientX:point.x,clientY:point.y,deltaY:40,...modifiers}));
      states.push({modifiers,allowed,before,after:scrollX,mode:root.dataset.canvasWheel});
    }
    return states;
  },point);
  for(const state of guards) {
    assert.equal(state.allowed,true,'Native-track zoom and held-button wheel input must remain native.');
    assert.equal(state.mode,'ready','Native-track modifiers must not enter custom horizontal mode.');
    assert.equal(state.after,state.before,'Native-track modifiers must not move the canvas through JavaScript.');
  }
  const shiftBefore=await read(page);
  await page.keyboard.down('Shift');
  try {
    await settledWheel(page,geometry.rtl?-80:80);await waitCanvasIdle(page);
  } finally {await page.keyboard.up('Shift');}
  const shifted=await read(page);
  assert.ok(Math.abs(shifted.x-shiftBefore.x-80)<=1,'Native Shift wheel input must pan once, without a second site conversion.');
  assert.equal(shifted.mode,'ready','Native Shift wheel input must not enter custom wheel mode.');
  await checkHint(page,false,'Native Shift wheel input must not show the custom locked marker.');
  await positionCanvas(page,0);await waitCanvasIdle(page);
  const before=await read(page);await page.mouse.wheel(0,80);
  await page.waitForFunction(x=>document.documentElement.dataset.canvasWheel==='locked'
    &&scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)>x+1,before.x);
  const wheel={before,after:await read(page)};
  await checkHint(page,true,'Native-track locking must keep the marker above the scrollbar.');
  const lockedHelp=await checkStatus(page,'Native-track help must remain visible while wheel mode is locked.');
  assert.equal(lockedHelp.text,hovered.text,'Wheel locking must not change scrollbar instructions.');
  await page.mouse.move(geometry.width/2,100);await page.waitForTimeout(600);
  const paused=await page.evaluate(()=>({mode:document.documentElement.dataset.canvasWheel,
    scrolling:document.documentElement.hasAttribute('data-scrolling'),color:getComputedStyle(document.documentElement).scrollbarColor}));
  assert.equal(paused.mode,'locked','A native-track wheel pause must retain horizontal mode.');
  assert.equal(paused.scrolling,false,'The native-track pause must outlast the scrollbar activity timer.');
  if(geometry.supportsColor)assert.equal(paused.color,'auto','Locked mode must keep native scrollbar colors visible after a pause.');
  await checkStatus(page,'Native-track help must remain visible after a locked pause.');
  await page.mouse.move(point.x,point.y);await page.keyboard.press('Escape');
  const ready=await checkStatus(page,'Native-track hover must keep help visible after Escape.');
  assert.equal(ready.text,hovered.text,'Escape must not change scrollbar instructions.');
  assert.equal((await read(page)).mode,'ready','Escape on the native track must exit horizontal mode.');
  await checkHint(page,false,'Escape must hide the wheel marker even while the scrollbar stays hovered.');
  await page.mouse.move((ready.left+ready.right)/2,(ready.top+ready.bottom)/2);
  await checkStatus(page,'Hovering the former help position must follow scrollbar activity.');
  assert.equal((await read(page)).mode,'ready','Hovering the former native-track help position must retain ready mode.');
  await page.mouse.move(point.x,point.y);
  const suspended=await page.evaluate(point=>{
    const root=document.documentElement;
    root.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:1,clientX:point.x,clientY:point.y}));
    root.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'mouse',button:1,clientX:point.x,clientY:point.y}));
    const before=scrollX,allowed=root.dispatchEvent(new WheelEvent('wheel',
      {bubbles:true,cancelable:true,clientX:point.x,clientY:point.y,deltaY:40}));
    return {allowed,before,after:scrollX,mode:root.dataset.canvasWheel};
  },point);
  assert.deepEqual(suspended,{allowed:true,before:suspended.before,after:suspended.before,mode:'suspended'},
    'Native-track wheel input must respect middle-button suspension.');
  await checkHint(page,false,'Middle-button suspension must hide the native-track marker.');
  await checkStatus(page,'Middle-button suspension must retain help while the native scrollbar is hovered.');
  await page.keyboard.press('Escape');await positionCanvas(page,0);
  const thumbX=geometry.rtl?geometry.width-geometry.gutter-4:geometry.gutter+4;
  await page.mouse.move(thumbX,point.y);await page.mouse.down();
  await page.mouse.move(thumbX+(geometry.rtl?-60:60),point.y,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>Math.abs(scrollX)>1);
  const dragged=await read(page);
  assert.equal(dragged.mode,'ready','Dragging the native scrollbar thumb must not enter wheel mode.');
  await positionCanvas(page,0);
  await page.mouse.click(geometry.rtl?geometry.gutter*2:geometry.width-geometry.gutter*2,point.y);
  await page.waitForFunction(()=>Math.abs(scrollX)>1);
  const clicked=await read(page);
  assert.equal(clicked.mode,'ready','Clicking the native scrollbar track must not enter wheel mode.');
  return {...geometry,shifted,wheel,guards,paused,suspended,dragged,clicked};
}

async function tailState(page) {
  return page.evaluate(()=>{
    const shell=document.querySelector('.page-shell'),style=getComputedStyle(shell),group=shell.querySelector('.reading-group');
    const rtl=style.direction==='rtl',rect=node=>{
      const box=node.getBoundingClientRect();
      return {x:rtl?innerWidth-box.right:box.left,right:rtl?innerWidth-box.left:box.right};
    };
    const lastRight=Math.max(...[...document.querySelectorAll('.page-column')].filter(node=>node.getClientRects().length)
      .map(node=>rect(node).right+scrollX*(rtl?-1:1)));
    const readingColumns=[...shell.querySelectorAll('.page-content,.document-aside')].filter(node=>node.getClientRects().length);
    const tail=rect(group).right-rect(readingColumns.at(-1)).right;
    return {tail,padding:parseFloat(style.paddingInlineEnd),edge:parseFloat(style.getPropertyValue('--page-edge-inline')),
      width:document.querySelector('.page').getBoundingClientRect().width,
      scrollWidth:document.scrollingElement.scrollWidth,lastRight,
      rtl,readingWidth:rect(readingColumns.at(-1)).right-rect(readingColumns[0]).x,
      snap:getComputedStyle(document.documentElement).scrollSnapType,
      align:[...document.querySelectorAll('.page-column')].map(node=>getComputedStyle(node).scrollSnapAlign)};
  });
}

export async function check({page,baseUrl,options}) {
  assert.notEqual(new URL(options.page,baseUrl).pathname,new URL(options.short,baseUrl).pathname,
    '--short must select a different article.');
  const cases=[];let stage='layout';
  try {
  for(const width of options.widths.split(',').map(Number)) {
    stage=width+' layout';
    await page.setViewportSize({width,height:900});await visit(page,baseUrl+options.page);
    await page.setViewportSize({width:width+160,height:900});await afterPaint(page);
    const resized=await tailState(page);
    assert.ok(Math.abs(resized.tail-Math.max(0,resized.width-resized.readingWidth))<=1,'Resizing must update the tail space.');
    await page.setViewportSize({width,height:900});await afterPaint(page);
    const geometry=await tailState(page);
    assert.ok(Math.abs(geometry.tail-Math.max(0,geometry.width-geometry.readingWidth))<=1,
      'Tail space must equal the canvas width minus the final reading columns, with a zero minimum.');
    assert.ok(Math.abs(geometry.padding-geometry.edge)<=1,'Canvas padding must retain only the page edge.');
    assert.ok(geometry.scrollWidth+1>=geometry.lastRight+geometry.tail,'The document scroll range must include the full tail space.');
    assert.equal(geometry.snap,'none','Normal browsing must retain native scrolling without added snapping.');
    assert.ok(geometry.align.every(value=>value==='none'),'Normal columns must retain native scrollIntoView alignment.');
    stage=width+' native horizontal scrollbar';
    const nativeScrollbar=await checkNativeScrollbar(page,baseUrl+options.page);
    await visit(page,baseUrl+options.page);
    await assertCanvasEnd(page);await positionCanvas(page,0);
    const gap=await gapPoint(page);await page.mouse.move(gap.x,gap.y);
    const readyCursor=await page.evaluate(({x,y})=>getComputedStyle(document.elementFromPoint(x,y)).cursor,gap);
    assert.ok(!readyCursor.includes('url('),'Column gaps must retain a native cursor.');
    await checkHint(page,false,'Column gaps must not show a horizontal wheel marker before scrolling.');
    await checkStatus(page,'Column-gap help must follow scrollbar activity.');
    stage=width+' bottom hover help';
    const bottomY=await page.evaluate(()=>document.documentElement.clientHeight-8);
    await page.mouse.move(gap.x,bottomY);
    await checkHint(page,false,'Bottom-page hover must not show the locked wheel marker.');
    await checkStatus(page,'Bottom-page hover help must follow scrollbar activity.');
    const bottomStart=await read(page);await page.mouse.wheel(0,40);
    await page.waitForFunction(x=>document.documentElement.dataset.canvasWheel==='locked'
      &&scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)>x+1,bottomStart.x);
    const bottomStatus=await checkStatus(page,'Wheel input in the bottom gap must reveal scrollbar help.');
    await checkHint(page,true,'Wheel input in the bottom gap must show the locked wheel marker.');
    await page.keyboard.press('Escape');
    await checkHint(page,false,'Escape must immediately hide the bottom wheel marker.');
    await checkStatus(page,'After Escape, help must follow remaining scrollbar activity.');
    await waitCanvasIdle(page);
    const idleHelp=await checkStatus(page,'The scrollbar activity timer must hide help after Escape.');
    assert.equal(idleHelp.visible,false,'The instruction must hide after activity stops outside the native scrollbar.');
    assert.equal(idleHelp.text,bottomStatus.text,'Leaving wheel mode must not change scrollbar instructions.');
    assert.equal(idleHelp.columnsBottom,bottomStatus.columnsBottom,'Showing or hiding help must not resize the reading columns.');
    await page.mouse.move((bottomStatus.left+bottomStatus.right)/2,(bottomStatus.top+bottomStatus.bottom)/2);
    await checkStatus(page,'Hovering where help was displayed must not reveal it again after activity stops.');
    assert.equal((await read(page)).mode,'ready','Hovering the former message position must not change wheel mode.');
    await positionCanvas(page,0);
    await page.mouse.move(gap.x,gap.y);
    await checkHint(page,false,'Leaving the bottom area must hide the ready marker.');
    await checkStatus(page,'Leaving the bottom area must keep help synchronized with scrollbar activity.');
    stage=width+' ready marker bounds';
    await positionCanvas(page,(await read(page)).maxX);
    const stationary=await page.evaluate(({x,y})=>({
      cursor:getComputedStyle(document.elementFromPoint(x,y)).cursor
    }),gap);
    assert.ok(!stationary.cursor.includes('url('),'Tail space under a stationary mouse must keep a native cursor.');
    await checkHint(page,false,'Scrolling a gap away must hide its marker under a stationary mouse.');
    await page.evaluate(()=>scrollTo({left:0,top:0,behavior:'instant'}));await afterPaint(page);
    await checkHint(page,false,'Scrolling a gap back under a stationary mouse must keep its ready marker hidden.');
    const blankPoints=await page.evaluate(()=>{
      const rail=document.querySelector('.page-rail').getBoundingClientRect();
      if(rail.bottom+10>=innerHeight)throw new Error('Choose a root navigation that leaves blank space below it.');
      return [{name:'below navigation',x:(rail.left+rail.right)/2,y:rail.bottom+10},
        {name:'page edge',x:getComputedStyle(document.documentElement).direction==='rtl'?innerWidth-2:2,y:100}];
    });
    for(const point of blankPoints) {
      await page.mouse.move(point.x,point.y);
      const cursor=await page.evaluate(({x,y})=>getComputedStyle(document.elementFromPoint(x,y)).cursor,point);
      assert.ok(!cursor.includes('url('),point.name+' must keep a native cursor.');
      await checkHint(page,false,point.name+' must not advertise horizontal wheel mode before scrolling.');
    }
    await positionCanvas(page,(await read(page)).maxX);
    if(geometry.tail>1) {
      const tailX=width-geometry.edge-geometry.tail/2;
      const tailPoint={x:geometry.rtl?width-tailX:tailX,y:100};await page.mouse.move(tailPoint.x,tailPoint.y);
      const tailCursor=await page.evaluate(({x,y})=>{
        const rtl=getComputedStyle(document.documentElement).direction==='rtl';
        const lastRight=Math.max(...[...document.querySelectorAll('.page-column')].filter(node=>node.getClientRects().length)
          .map(node=>rtl?innerWidth-node.getBoundingClientRect().left:node.getBoundingClientRect().right));
        if((rtl?innerWidth-x:x)<=lastRight)throw new Error('The tail cursor point must lie after the last visible column.');
        return getComputedStyle(document.elementFromPoint(x,y)).cursor;
      },tailPoint);
      assert.ok(!tailCursor.includes('url('),'Tail space must keep a native cursor.');
      await checkHint(page,false,'Tail space must not advertise horizontal wheel mode before scrolling.');
    }
    await page.evaluate(()=>scrollTo({left:0,top:0,behavior:'instant'}));await afterPaint(page);
    const nativeArticleCursor=await page.locator('.page-content p').first().evaluate(node=>{node.style.cursor='text';return getComputedStyle(node).cursor;});
    const nativeLinkCursor=await page.locator('[data-root-navigation] a').first().evaluate(node=>{node.style.cursor='pointer';return getComputedStyle(node).cursor;});
    stage=width+' gap and continuous mode';await enter(page);
    const content=page.locator('.page-content');await reveal(page,content);
    const before=await read(page);
    await page.mouse.wheel(0,-120);
    await page.waitForFunction(x=>scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)<x-1,before.x);
    const locked=await read(page);
    assert.equal(locked.y,before.y,'Horizontal wheel mode must preserve the article reading position.');
    const lockedCursor=await content.evaluate(node=>getComputedStyle(node.querySelector('p')??node).cursor);
    assert.equal(lockedCursor,nativeArticleCursor,'Locked mode must retain the article text cursor.');
    assert.equal(await page.locator('[data-root-navigation] a').first().evaluate(node=>getComputedStyle(node).cursor),nativeLinkCursor,
      'Locked mode must retain native link cursors.');
    await checkHint(page,true,'Locked mode must show its marker across reading columns.');
    await checkStatus(page,'Locked mode must show scrollbar help across reading columns.');
    await page.waitForTimeout(400);
    assert.equal((await read(page)).mode,'locked','A pause must not exit horizontal wheel mode.');
    await checkStatus(page,'Scrollbar help must remain visible after locked wheel input stops.');
    await page.setViewportSize({width:width+160,height:900});await afterPaint(page);
    const lockedResize=await tailState(page);
    assert.ok(Math.abs(lockedResize.tail-Math.max(0,lockedResize.width-lockedResize.readingWidth))<=1,
      'Locked resizing must preserve the reading group tail space.');
    assert.ok((await read(page)).maxX>1,'Reading columns must remain horizontally reachable after resizing.');
    assert.equal((await read(page)).mode,'locked','Resizing must preserve horizontal wheel mode.');
    await checkHint(page,true,'Resizing must preserve the locked wheel marker.');
    await checkStatus(page,'Resizing must preserve locked scrollbar help.');
    await page.setViewportSize({width,height:900});await afterPaint(page);
    const markerWork=await checkHintWork(page);
    assert.equal(markerWork.moving.requested,1,'A burst of pointer events must request at most one marker frame.');
    assert.equal(markerWork.moving.fired,1,'A burst of pointer events must execute one marker frame.');
    assert.equal(markerWork.moving.writes,1,'A pointer burst must move only the marker once per frame.');
    assert.equal(markerWork.moving.hits,0,'Locked pointer movement must not run ready-area hit tests.');
    assert.equal(markerWork.moving.rects,0,'Locked pointer movement must not scan column rectangles.');
    assert.notEqual(markerWork.moving.transform,'none','The marker must follow pointer coordinates.');
    for(const key of ['requested','fired','writes'])assert.equal(markerWork.idle[key],markerWork.moving[key],'An idle pointer must stop marker work: '+key);
    for(const cancelled of markerWork.cancelled) {
      assert.equal(cancelled.requested,1,'A moved marker must first request one frame: '+cancelled.type);
      assert.equal(cancelled.fired,0,'Leaving or hiding the page must cancel the pending marker frame: '+cancelled.type);
      assert.equal(cancelled.writes,0,'A cancelled marker frame must not update styles: '+cancelled.type);
      assert.equal(cancelled.hidden,true,'Leaving or hiding the page must hide the marker: '+cancelled.type);
    }
    const snap=await page.evaluate(()=>getComputedStyle(document.documentElement).scrollSnapType);
    assert.equal(snap,'none','Locked mode must not add native snapping.');
    assert.ok(await page.locator('.page-column').evaluateAll(nodes=>nodes.every(node=>
      getComputedStyle(node).scrollSnapAlign==='none')),'Locked columns must not expose snap points.');
    stage=width+' light snapping';
    const edgeX=await columnEdge(page.locator('.path-column').first());
    const snapY=(await read(page)).y;
    const maxX=(await read(page)).maxX;
    assert.ok(edgeX>=73&&edgeX+73<=maxX,'The path column must allow both approach directions.');
    for(const direction of [1,-1]) {
      await positionCanvas(page,edgeX-direction*72);await settledWheel(page,direction*8);
      assert.ok(Math.abs((await read(page)).x-edgeX)<=1,'A column edge exactly 64 pixels ahead must align after wheel idle.');
      for(const step of [4,8]) {
        await settledWheel(page,direction*4);
        assert.ok(Math.abs((await read(page)).x-edgeX-direction*step)<=1,'Small wheel steps must leave an aligned edge without snapping backward.');
      }
      await positionCanvas(page,edgeX-direction*73);await settledWheel(page,direction*8);
      assert.ok(Math.abs((await read(page)).x-(edgeX-direction*65))<=1,'An edge 65 pixels away must remain outside the fixed snap range.');
    }
    const mainEdge=await columnEdge(content);
    await positionCanvas(page,mainEdge-72);await settledWheel(page,8);
    assert.ok(Math.abs((await read(page)).x-mainEdge)<=1,'Reading columns must use the same fixed snap range as navigation.');
    await positionCanvas(page,edgeX-24);
    const activeX=await page.evaluate(async()=>{
      const shell=document.querySelector('.page-shell');
      const wheel=deltaY=>shell.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY}));
      wheel(8);await new Promise(resolve=>setTimeout(resolve,120));wheel(4);
      await new Promise(resolve=>setTimeout(resolve,120));return scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1);
    });
    assert.ok(Math.abs(activeX-(edgeX-12))<=1,'Continued wheel input must postpone alignment until the latest input stops.');
    await page.waitForTimeout(100);
    assert.ok(Math.abs((await read(page)).x-edgeX)<=1,'Mouse alignment must complete after the 180-millisecond idle interval.');
    assert.equal((await read(page)).mode,'locked','Snapping must retain horizontal wheel mode.');
    assert.equal((await read(page)).y,snapY,'Snapping must preserve the article reading position.');
    await checkStatus(page,'Canvas movement must keep scrollbar help aligned to the viewport start edge.');
    stage=width+' cancel pending snap';
    for(const cancel of ['Escape','middle','touch','horizontal','zoom','external','blur']) {
      await page.keyboard.press('Escape');await positionCanvas(page,edgeX-24);await page.mouse.move(20,100);
      const cancelledX=await page.evaluate(cancel=>{
        const shell=document.querySelector('.page-shell');
        shell.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:8}));
        if(cancel==='Escape')window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
        else if(cancel==='middle'||cancel==='touch')shell.dispatchEvent(new PointerEvent('pointerdown',
          {bubbles:true,cancelable:true,pointerType:cancel==='touch'?'touch':'mouse',button:1}));
        else if(cancel==='horizontal'||cancel==='zoom')shell.dispatchEvent(new WheelEvent('wheel',
          {bubbles:true,cancelable:true,deltaX:cancel==='horizontal'?8:0,deltaY:cancel==='zoom'?8:0,ctrlKey:cancel==='zoom'}));
        else if(cancel==='external')scrollBy({left:getComputedStyle(document.documentElement).direction==='rtl'?-12:12,top:0,behavior:'instant'});
        else window.dispatchEvent(new Event('blur'));
        return scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1);
      },cancel);
      await page.waitForTimeout(300);
      assert.ok(Math.abs((await read(page)).x-cancelledX)<=1,cancel+' must cancel pending alignment.');
    }
    await page.mouse.move(20,100);
    await page.evaluate(()=>document.querySelector('.page-shell').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:40})));
    const resumedBefore=await read(page);await page.mouse.wheel(0,200);
    await page.waitForFunction(x=>scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)>x+1,resumedBefore.x);
    const resumed=await read(page);
    assert.equal(resumed.mode,'locked','A wheel event after a pause must retain horizontal mode.');
    assert.equal(resumed.y,resumedBefore.y,'Resumed horizontal scrolling must preserve reading progress.');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.documentElement.dataset.canvasWheel==='ready');
    await checkStatus(page,'After Escape, help must follow scrollbar activity outside the native track.');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollSnapType),'none',
      'Normal mode must retain native scrolling without snapping.');

    stage=width+' vertical article';const articlePoint=await reveal(page,content);
    const articleCursor=await content.evaluate(node=>getComputedStyle(node.querySelector('p')??node).cursor);
    assert.equal(articleCursor,nativeArticleCursor,'An article must keep its normal cursor before horizontal wheel mode starts.');
    await checkHint(page,false,'A vertically scrollable article must not show a ready marker.');
    const articleBottom=await content.evaluate(node=>{
      const box=node.getBoundingClientRect(),width=document.documentElement.clientWidth;
      const point={x:(Math.max(0,box.left)+Math.min(width,box.right))/2,y:box.bottom-8};
      if(document.elementFromPoint(point.x,point.y)?.closest('.page-content')!==node)
        throw new Error('The bottom article sample must hit the vertically scrollable content column.');
      return point;
    });
    await page.mouse.move(articleBottom.x,articleBottom.y);
    await checkHint(page,false,'The bottom of a vertically scrollable article must not advertise horizontal wheel input.');
    await checkStatus(page,'Article-bottom help must follow canvas scrollbar activity.');
    await page.mouse.move(articlePoint.x,articlePoint.y);
    await content.evaluate(node=>{node.scrollTop=0;});await afterPaint(page);
    const verticalBefore=await read(page);
    assert.ok(await content.evaluate(node=>node.scrollHeight>node.clientHeight+1),'Choose a long article that scrolls vertically.');
    await page.mouse.wheel(0,180);
    await page.waitForFunction(y=>document.querySelector('.page-content').scrollTop>y,verticalBefore.y);
    const vertical=await read(page);
    assert.equal(vertical.mode,'ready','A vertically scrolling article must not enter horizontal mode.');
    assert.ok(Math.abs(vertical.x-verticalBefore.x)<=1,'Vertical article scrolling must preserve the canvas position.');
    await content.evaluate(node=>{node.scrollTop=node.scrollHeight;});await afterPaint(page);
    const bottomBefore=await read(page);await page.mouse.wheel(0,180);await afterPaint(page);
    const bottom=await read(page);
    assert.equal(bottom.mode,'ready','Reaching a column boundary must not enter horizontal mode.');
    assert.ok(Math.abs(bottom.x-bottomBefore.x)<=1,'A vertical column boundary must not redirect the wheel horizontally.');

    const nested=[];
    for(const selector of ['.prose pre','.prose table:not(.chroma)']) {
      stage=width+' nested '+selector;
      const node=page.locator(selector).first();
      assert.equal(await node.count(),1,'Choose an article with prose code and a table.');
      await reveal(page,node);
      const overflow=await node.evaluate(element=>({width:element.clientWidth,scroll:element.scrollWidth}));
      assert.ok(overflow.scroll>overflow.width+1,'Code and table samples must overflow horizontally: '+selector+' '+JSON.stringify(overflow));
      await node.evaluate(element=>{element.scrollLeft=0;});
      const nestedBefore=await read(page),direction=await node.evaluate(node=>getComputedStyle(node).direction==='rtl'?-1:1);
      await page.mouse.wheel(120*direction,0);
      await page.waitForFunction(selector=>Math.abs(document.querySelector(selector).scrollLeft)>0,selector);
      await page.mouse.wheel(0,100);await afterPaint(page);
      const state=await read(page);
      assert.equal(state.mode,'ready','Nested code and tables must not activate canvas wheel mode.');
      assert.ok(Math.abs(state.x-nestedBefore.x)<=1,'Nested scrolling must preserve the canvas position.');
      nested.push({selector,...state});
    }

    stage=width+' metadata';
    if(await page.locator('#document-aside-toggle').count()) {
      if(await page.locator('#document-aside-toggle').getAttribute('aria-expanded')!=='true')await activate(page,page.locator('#document-aside-toggle'));
      assert.equal(await page.locator('#document-aside-toggle').getAttribute('aria-expanded'),'true');
      await afterPaint(page);
      const aside=await tailState(page);
      assert.ok(Math.abs(aside.tail-Math.max(0,aside.width-aside.readingWidth))<=1,'Metadata tail space must subtract both reading columns and their gap.');
      await assertCanvasEnd(page);
      const groupGap=await page.evaluate(()=>{
        const content=document.querySelector('.page-content'),aside=document.querySelector('.document-aside');
        const middle=()=>getComputedStyle(content).direction==='rtl'
          ?(content.getBoundingClientRect().left+aside.getBoundingClientRect().right)/2
          :(content.getBoundingClientRect().right+aside.getBoundingClientRect().left)/2;
        scrollBy({left:middle()-innerWidth/2,top:0,behavior:'instant'});
        const point={x:middle(),y:120};
        if(document.elementFromPoint(point.x,point.y)!==document.querySelector('.reading-group'))throw new Error('The reading-column gap must hit the reading group.');
        return point;
      });
      await afterPaint(page);await page.mouse.move(groupGap.x,groupGap.y);
      await checkHint(page,false,'The gap inside the reading group must not show a ready marker.');
      await checkStatus(page,'Reading-group gap help must follow canvas scrollbar activity.');
      const asideEdge=await columnEdge(page.locator('.document-aside'));
      await positionCanvas(page,asideEdge-20);await page.mouse.move(20,100);
      await page.evaluate(()=>document.querySelector('.page-shell').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:8})));
      await page.waitForTimeout(300);
      const asideX=(await read(page)).x;
      const maxAsideX=(await read(page)).maxX;
      const expectedAsideX=asideEdge<=maxAsideX?asideEdge:Math.min(maxAsideX,asideEdge-12);
      assert.ok(Math.abs(asideX-expectedAsideX)<=1,'Metadata alignment must stay within the native scroll range: '+JSON.stringify({target:asideEdge,max:maxAsideX,actual:asideX}));
      await activate(page,page.locator('#document-aside-toggle'));await afterPaint(page);
      assert.ok(Math.abs((await tailState(page)).tail-geometry.tail)<=1,'Closing metadata must restore the single-column tail space.');
      await assertCanvasEnd(page);
    }

    stage=width+' short article and left click';await visit(page,baseUrl+options.short);
    const short=page.locator('.page-content');await reveal(page,short);
    const shortCursor=await short.evaluate(node=>getComputedStyle(node.querySelector('p')??node).cursor);
    assert.ok(!shortCursor.includes('url('),'A short article must keep its normal cursor until its first wheel event.');
    await checkHint(page,false,'A short article must show no marker until its first wheel event.');
    assert.ok(await short.evaluate(node=>node.scrollHeight<=node.clientHeight+1),'Choose a short article that fits at 900 pixels high.');
    const shortBefore=await read(page);stage=width+' short article';
    await page.mouse.wheel(0,-120);
    await page.waitForFunction(x=>document.documentElement.dataset.canvasWheel==='locked'&&scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)<x-1,shortBefore.x);
    const shortState=await read(page);
    await page.waitForTimeout(400);
    const shortResumedBefore=await read(page);stage=width+' short article after pause';
    await page.mouse.wheel(0,-120);
    await page.waitForFunction(x=>scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)<x-1,shortResumedBefore.x);
    assert.equal((await read(page)).mode,'locked','A short column must resume horizontal scrolling after a pause.');
    stage=width+' left click';
    const href=await page.locator('main a[href]').evaluateAll(nodes=>nodes.find(node=>node.origin===location.origin
      &&node.pathname!==location.pathname&&(!node.target||node.target==='_self'))?.getAttribute('href'));
    assert.ok(href,'The short article must link to a different local page.');
    const link=page.locator('main a[href='+JSON.stringify(href)+']').first();await reveal(page,link);
    const target=await link.evaluate(node=>node.href);
    await page.evaluate(()=>window.addEventListener('pointerdown',event=>{
      window.__swbanWheelLeftDown={mode:document.documentElement.dataset.canvasWheel,prevented:event.defaultPrevented};
    },{once:true}));
    await page.mouse.down();
    assert.deepEqual(await page.evaluate(()=>window.__swbanWheelLeftDown),{mode:'ready',prevented:false},
      'Left click must exit horizontal mode and retain its native action.');
    await Promise.all([page.waitForURL(target),page.mouse.up()]);await waitForBrowse(page);
    assert.equal(page.url(),target,'The first left click must follow the link.');

    const buttons=[];
    for(const button of ['middle','right']) {
      stage=width+' '+button+' click';
      await visit(page,baseUrl+options.page);const point=await enter(page);
      await page.evaluate(()=>{
        window.__swbanWheelButtons=[];
        for(const type of ['pointerdown','mousedown','auxclick','contextmenu'])
          window.addEventListener(type,event=>window.__swbanWheelButtons.push({type,button:event.button,prevented:event.defaultPrevented}));
      });
      await page.mouse.move(point.x,point.y);await page.mouse.down({button});await afterPaint(page);
      assert.equal((await read(page)).mode,button==='middle'?'suspended':'ready','Any mouse button must exit horizontal mode.');
      if(button==='middle') {
        const heldWheel=await page.evaluate(()=>document.querySelector('.page-shell').dispatchEvent(
          new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120,buttons:4})));
        assert.equal(heldWheel,true,'A wheel event with the middle button held must remain native.');
        await page.mouse.move(point.x+10,point.y);await afterPaint(page);
        assert.equal((await read(page)).mode,'suspended','Middle-button mouse movement must not activate custom horizontal wheel mode.');
      }
      await page.mouse.up({button});await afterPaint(page);
      if(button==='middle') {
        const released=await page.evaluate(()=>{
          const shell=document.querySelector('.page-shell'),before=scrollX;
          const allowed=shell.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120}));
          return {allowed,before,after:scrollX,mode:document.documentElement.dataset.canvasWheel,cursor:getComputedStyle(shell).cursor};
        });
        assert.equal(released.mode,'suspended','Releasing the initial middle click must keep custom wheel handling suspended.');
        assert.equal(released.allowed,true,'Wheel input after middle release must remain native.');
        assert.equal(released.after,released.before,'Suspended wheel handling must not move the canvas through JavaScript.');
        assert.ok(!released.cursor.includes('url('),'Suspended mode must keep a native cursor.');
        await checkHint(page,false,'Native middle-button scrolling must hide the marker.');
        await checkStatus(page,'Middle-button scrolling must keep help synchronized with canvas scrollbar activity.');
        await page.evaluate(()=>scrollTo({left:0,top:0,behavior:'instant'}));await afterPaint(page);
        const resumePoint=await gapPoint(page);await page.mouse.click(resumePoint.x,resumePoint.y);
        assert.equal((await read(page)).mode,'ready','Another click must resume normal wheel handling.');
        const resumedX=(await read(page)).x;await page.mouse.wheel(0,40);
        await page.waitForFunction(x=>document.documentElement.dataset.canvasWheel==='locked'&&scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)>x+1,resumedX);
        const releaseOnly=await page.evaluate(()=>{
          const shell=document.querySelector('.page-shell'),results=[];
          const emit=(type,button)=>shell.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'mouse',button}));
          for(const button of [0,1]) {
            emit('pointerdown',1);emit('pointerup',1);emit('pointerup',button);
            results.push(document.documentElement.dataset.canvasWheel);
          }
          emit('pointerdown',1);emit('pointerup',1);
          return results;
        });
        assert.deepEqual(releaseOnly,['ready','ready'],'A native-consumed cancel click must resume handling when only pointerup reaches the page.');
      }
      const events=await page.evaluate(()=>window.__swbanWheelButtons);
      assert.ok(events.some(event=>event.type==='pointerdown'),'Mouse buttons must produce real pointer input.');
      assert.ok(events.every(event=>!event.prevented),'Middle and right clicks must retain their native actions.');
      await page.keyboard.press('Escape');
      assert.equal((await read(page)).mode,'ready','Escape must resume normal wheel handling.');
      buttons.push({button,events});
    }

    stage=width+' touch and native wheel guards';await visit(page,baseUrl+options.page);await enter(page);
    const touch=await page.evaluate(()=>{
      const target=document.querySelector('.page-shell');
      const allowed=target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:7,pointerType:'touch',isPrimary:true}));
      return {allowed,pointer:document.documentElement.dataset.canvasPointer,mode:document.documentElement.dataset.canvasWheel};
    });
    assert.equal(touch.allowed,true,'Touch input must not be cancelled by mouse wheel handling.');
    assert.equal(touch.mode,'ready','Touch input must clear mouse wheel mode.');
    assert.notEqual(touch.pointer,'mouse','Touch input must clear the mouse input marker.');
    await checkHint(page,false,'Touch input must hide the mouse-only marker.');
    assert.equal((await checkStatus(page,'Touch input must hide mouse instructions.')).visible,false);
    const touchWheel=await page.evaluate(()=>document.querySelector('.page-shell').dispatchEvent(
      new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120})));
    assert.equal(touchWheel,true,'Wheel conversion must require mouse pointer input.');
    const point=await gapPoint(page);await page.mouse.move(point.x,point.y);
    const passthrough=await page.evaluate(()=>[new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:120}),
      new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:120})].map(event=>document.querySelector('.page-shell').dispatchEvent(event)));
    assert.deepEqual(passthrough,[true,true],'Zoom and horizontal wheel input must remain native.');
    assert.equal((await read(page)).mode,'ready','Native wheel input must not activate horizontal conversion.');
    stage=width+' no horizontal overflow';
    await page.evaluate(()=>{
      const shell=document.querySelector('.page-shell'),group=shell.querySelector('.reading-group'),content=document.createElement('div');
      content.className='page-column page-content';content.textContent='No overflow';
      content.style.cssText='inline-size:100px;block-size:80px;padding:0';group.replaceChildren(content);shell.replaceChildren(group);
      shell.style.cssText='inline-size:100%;min-inline-size:0;padding:0;column-gap:0';
      scrollTo({left:0,top:0,behavior:'instant'});
    });await afterPaint(page);await page.mouse.move(40,await page.evaluate(()=>document.documentElement.clientHeight-8));
    const noOverflow=await page.evaluate(()=>({
      maxX:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,
      allowed:document.querySelector('.page-content').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120})),
      mode:document.documentElement.dataset.canvasWheel
    }));
    assert.ok(noOverflow.maxX<=1,'The no-overflow sample must fit the viewport.');
    assert.equal(noOverflow.allowed,true,'A page without horizontal overflow must not cancel the wheel event.');
    assert.equal(noOverflow.mode,'ready','A page without horizontal overflow must not enter horizontal mode.');
    await checkHint(page,false,'A page without horizontal overflow must not show the ready marker.');
    await waitCanvasIdle(page);
    assert.equal((await checkStatus(page,'An idle page without horizontal overflow must not show scrollbar help.')).visible,false);
    stage=width+' print help';await visit(page,baseUrl+options.page);await enter(page);
    await page.emulateMedia({media:'print'});
    await checkHint(page,false,'The decorative wheel marker must not print.');
    await checkStatus(page,'Scrollbar help must not print.');
    await page.emulateMedia({media:'screen'});
    assert.equal((await read(page)).mode,'locked','A print round trip must preserve the screen wheel mode.');
    await checkStatus(page,'Returning from print must restore active scrollbar help.');
    cases.push({width,geometry,nativeScrollbar,locked,lockedResize,markerWork,edgeX,resumed,vertical,bottom,nested,short:shortState,buttons,touch,passthrough,noOverflow});
  }
  } catch(error) {error.message=stage+': '+error.message;throw error;}
  return {page:options.page,short:options.short,cases};
}
