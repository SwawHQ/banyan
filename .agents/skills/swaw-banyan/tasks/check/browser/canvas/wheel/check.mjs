import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse,visiblePoint,activate} from '../../_shared/viewport.mjs';
import {assertCanvasEnd,panCanvas} from '../_shared/state.mjs';

const read=page=>page.evaluate(()=>({x:scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1),maxX:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,y:document.querySelector('.page-content').scrollTop,
  mode:document.documentElement.dataset.canvasWheel,pointer:document.documentElement.dataset.canvasPointer}));

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

async function settledWheel(page,delta) {
  await page.mouse.wheel(0,delta);await page.waitForTimeout(300);
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
    await assertCanvasEnd(page);await positionCanvas(page,0);
    const gap=await gapPoint(page);await page.mouse.move(gap.x,gap.y);
    const readyCursor=await page.evaluate(({x,y})=>getComputedStyle(document.elementFromPoint(x,y)).cursor,gap);
    assert.ok(!['auto','default','text','pointer'].includes(readyCursor),'Column gaps must show a horizontal wheel cursor.');
    stage=width+' ready cursor bounds';
    await positionCanvas(page,(await read(page)).maxX);
    const stationary=await page.evaluate(({x,y})=>({
      gap:document.documentElement.hasAttribute('data-canvas-wheel-gap'),
      cursor:getComputedStyle(document.elementFromPoint(x,y)).cursor
    }),gap);
    assert.equal(stationary.gap,false,'Scrolling a gap out from under a stationary mouse must clear its cursor hint.');
    assert.notEqual(stationary.cursor,readyCursor,'Tail space under a stationary mouse must keep its normal cursor.');
    await page.evaluate(()=>scrollTo({left:0,top:0,behavior:'instant'}));await afterPaint(page);
    assert.equal(await page.evaluate(({x,y})=>getComputedStyle(document.elementFromPoint(x,y)).cursor,gap),readyCursor,
      'Scrolling a gap back under a stationary mouse must restore its cursor hint.');
    const blankPoints=await page.evaluate(()=>{
      const rail=document.querySelector('.page-rail').getBoundingClientRect();
      if(rail.bottom+10>=innerHeight)throw new Error('Choose a root navigation that leaves blank space below it.');
      return [{name:'below navigation',x:(rail.left+rail.right)/2,y:rail.bottom+10},
        {name:'page edge',x:getComputedStyle(document.documentElement).direction==='rtl'?innerWidth-2:2,y:100}];
    });
    for(const point of blankPoints) {
      await page.mouse.move(point.x,point.y);
      const cursor=await page.evaluate(({x,y})=>getComputedStyle(document.elementFromPoint(x,y)).cursor,point);
      assert.notEqual(cursor,readyCursor,point.name+' must not advertise horizontal wheel mode before scrolling.');
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
      assert.notEqual(tailCursor,readyCursor,'Tail space must not advertise horizontal wheel mode before scrolling.');
    }
    await page.evaluate(()=>scrollTo({left:0,top:0,behavior:'instant'}));await afterPaint(page);
    stage=width+' gap and continuous mode';await enter(page);
    const content=page.locator('.page-content');await reveal(page,content);
    const before=await read(page);
    await page.mouse.wheel(0,-120);
    await page.waitForFunction(x=>scrollX*(getComputedStyle(document.documentElement).direction==='rtl'?-1:1)<x-1,before.x);
    const locked=await read(page);
    assert.equal(locked.y,before.y,'Horizontal wheel mode must preserve the article reading position.');
    const lockedCursor=await content.evaluate(node=>getComputedStyle(node.querySelector('p')??node).cursor);
    assert.notEqual(lockedCursor,readyCursor,'Locked mode must have a distinct cursor across the columns.');
    await page.waitForTimeout(400);
    assert.equal((await read(page)).mode,'locked','A pause must not exit horizontal wheel mode.');
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
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollSnapType),'none',
      'Normal mode must retain native scrolling without snapping.');

    stage=width+' vertical article';await reveal(page,content);
    const articleCursor=await content.evaluate(node=>getComputedStyle(node.querySelector('p')??node).cursor);
    assert.notEqual(articleCursor,readyCursor,'An article must keep its normal cursor before horizontal wheel mode starts.');
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
      assert.equal(await page.evaluate(({x,y})=>getComputedStyle(document.elementFromPoint(x,y)).cursor,groupGap),readyCursor,
        'The gap inside the reading group must show the same horizontal wheel cursor.');
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
    assert.notEqual(shortCursor,readyCursor,'A short article must keep its normal cursor until its first wheel event.');
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
        assert.ok(['auto','default'].includes(released.cursor),'Suspended mode must hide the custom cursor.');
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
    });await afterPaint(page);await page.mouse.move(40,40);
    const noOverflow=await page.evaluate(()=>({
      maxX:document.scrollingElement.scrollWidth-document.scrollingElement.clientWidth,
      allowed:document.querySelector('.page-content').dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:120})),
      mode:document.documentElement.dataset.canvasWheel
    }));
    assert.ok(noOverflow.maxX<=1,'The no-overflow sample must fit the viewport.');
    assert.equal(noOverflow.allowed,true,'A page without horizontal overflow must not cancel the wheel event.');
    assert.equal(noOverflow.mode,'ready','A page without horizontal overflow must not enter horizontal mode.');
    cases.push({width,geometry,locked,edgeX,resumed,vertical,bottom,nested,short:shortState,buttons,touch,passthrough,noOverflow});
  }
  } catch(error) {error.message=stage+': '+error.message;throw error;}
  return {page:options.page,short:options.short,cases};
}
