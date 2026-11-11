import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';
import {panCanvas} from '../_shared/state.mjs';
import {checkColumnFocus} from '../../nav/keyboard/check.mjs';

const read=page=>page.evaluate(()=>{
  const root=document.documentElement,direction=root.dir==='rtl'?-1:1;
  const edge=parseFloat(getComputedStyle(document.body).paddingInlineStart);
  return {x:scrollX*direction,max:document.scrollingElement.scrollWidth-root.clientWidth,width:root.clientWidth,
    y:document.querySelector('.page-content')?.scrollTop??0,mode:root.dataset.canvasWheel,key:window.__swbanKeyboardEvent,
    aligned:[...document.querySelectorAll('.page-column')].some(node=>{
      const box=node.getBoundingClientRect();return box.width&&Math.abs((direction<0?root.clientWidth-box.right:box.left)-edge)<=1;
    })};
});

export async function checkFirstKeyboardWheel(page,url) {
  const point=await page.locator('.page-content').evaluate(node=>{
    node.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'});
    const box=node.getBoundingClientRect();
    return {x:(Math.max(0,box.left)+Math.min(innerWidth,box.right))/2,y:Math.min(innerHeight/2,box.bottom-40)};
  });
  // Place the cursor before navigation so the new document receives no mouse input.
  await page.goto('about:blank');await page.mouse.move(point.x,point.y);
  await page.goto(url,{waitUntil:'load'});await waitForBrowse(page);
  await page.locator('.page-content').evaluate(node=>{
    node.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'});node.scrollTop=100;
  });
  await page.locator('#main').evaluate(node=>node.focus({preventScroll:true}));
  await page.evaluate(()=>{
    window.__swbanFirstKeyboardWheel=[];
    window.addEventListener('wheel',event=>window.__swbanFirstKeyboardWheel.push({
      trusted:event.isTrusted,prevented:event.defaultPrevented,pointer:document.documentElement.dataset.canvasPointer
    }),{passive:true});
  });
  await page.keyboard.press(await page.evaluate(()=>document.documentElement.dir==='rtl'?'ArrowRight':'ArrowLeft'));
  await page.waitForTimeout(250);
  const before=await read(page);
  assert.equal(before.mode,'locked','Keyboard input must enter horizontal mode.');
  assert.equal(await page.locator('html').getAttribute('data-canvas-pointer'),null,'This check must reach the first wheel without prior mouse input.');
  await page.mouse.wheel(0,80);
  await page.waitForFunction(()=>window.__swbanFirstKeyboardWheel.length>0);await afterPaint(page);
  const first=await page.evaluate(()=>window.__swbanFirstKeyboardWheel[0]),after=await read(page);
  assert.equal(first.trusted,true,'The first wheel must be native browser input.');
  assert.equal(first.prevented,true,'The first wheel after keyboard locking must scroll the canvas.');
  assert.equal(first.pointer,'mouse','The accepted wheel must identify mouse input.');
  assert.ok(after.x>before.x+1&&after.y===before.y,'The first locked wheel must pan horizontally without scrolling the article.');
  await page.keyboard.press('Escape');const released=await read(page);
  await page.mouse.wheel(0,80);
  await page.waitForFunction(y=>document.querySelector('.page-content').scrollTop>y+1,released.y);
  const vertical=await read(page);
  assert.equal(vertical.mode,'ready','Escape must restore native vertical scrolling.');
  assert.ok(Math.abs(vertical.x-released.x)<=1,'Native vertical scrolling must preserve the canvas position.');
  return {before,after,first};
}

export async function checkKeyboardFallback(page,selector) {
  const cases=[];
  for(const key of ['Home','End','PageUp','PageDown']) {
    await page.keyboard.press('Escape');
    await page.locator(selector).evaluate(node=>{
      if(node===document.body)document.activeElement.blur();else node.focus({preventScroll:true});
    });
    const max=(await read(page)).max;
    await panCanvas(page,key==='Home'||key==='PageUp'?max:0);await afterPaint(page);
    const before=await read(page);
    await page.evaluate(()=>window.addEventListener('keydown',event=>{window.__fallbackPrevented=event.defaultPrevented;},{once:true}));
    await page.keyboard.press(key);await afterPaint(page);
    const state=await read(page);
    assert.ok(state.mode==='locked'&&Math.abs(state.y-before.y)<=1,
      'Fallback '+key+' must enter horizontal mode without changing the reading position.');
    assert.equal(await page.evaluate(()=>window.__fallbackPrevented),true,'Fallback keys must suppress their native action.');
    assert.ok(key==='Home'||key==='PageUp'?state.x<before.x-1:state.x>before.x+1,'Fallback keys must move the canvas in their logical direction.');
    cases.push({key,x:state.x});
  }
  await page.keyboard.press('Escape');return cases;
}

export async function checkKeyboard(page) {
  const forward=await page.evaluate(()=>document.documentElement.dir==='rtl'?'ArrowLeft':'ArrowRight');
  const backward=forward==='ArrowLeft'?'ArrowRight':'ArrowLeft';
  await page.evaluate(()=>window.addEventListener('keydown',event=>{
    window.__swbanKeyboardEvent={key:event.key,prevented:event.defaultPrevented,repeat:event.repeat};
  }));
  const press=async key=>{await page.keyboard.press(key);await afterPaint(page);return read(page);};
  const focusMain=()=>page.locator('#main').evaluate(node=>node.focus({preventScroll:true}));
  const position=async x=>{await panCanvas(page,x);await afterPaint(page);};
  const enter=async()=>{
    await focusMain();await position((await read(page)).max/2);
    const before=await read(page);await page.keyboard.press(forward);
    await page.waitForFunction(x=>scrollX*(document.documentElement.dir==='rtl'?-1:1)>x+1
      &&document.documentElement.dataset.canvasWheel==='locked',before.x);
    await page.waitForTimeout(250);
    const state=await read(page);
    assert.equal(state.key.prevented,false,'Left/right canvas motion must remain native.');
    return state;
  };
  const initial=await read(page);
  assert.ok(initial.max>40,'Keyboard checks need a horizontally overflowing canvas.');
  const fallback=await checkKeyboardFallback(page,'body');
  const toggle=page.locator('#document-aside-toggle');
  if(await toggle.count())await toggle.evaluate(node=>node.click());
  const columns=await checkColumnFocus(page);
  if(await toggle.count())await toggle.evaluate(node=>node.click());
  await focusMain();
  for(const key of ['Home','End','PageUp','PageDown']) {
    await page.locator('.page-content').evaluate((node,key)=>{node.scrollTop=key==='Home'||key==='PageUp'?0:node.scrollHeight;},key);
    const before=await read(page),state=await press(key);
    assert.ok(state.mode==='ready'&&!state.key.prevented&&Math.abs(state.x-before.x)<=1,
      'Reaching a vertical boundary must not turn '+key+' into horizontal navigation.');
  }
  await page.locator('.page-content').evaluate(node=>{node.scrollTop=100;});
  const nativeBefore=await read(page);await press('PageDown');
  await page.waitForFunction(y=>document.querySelector('.page-content').scrollTop>y+1,nativeBefore.y);
  assert.equal((await read(page)).key.prevented,false,'PageDown must remain native before horizontal mode.');
  await enter();const readingY=(await read(page)).y;
  const home=await press('Home');
  assert.ok(home.x<=1&&home.key.prevented,'Locked Home must reach the logical canvas start.');
  const pages=[];
  for(const key of ['PageDown','PageUp']) {
    const limit=await page.locator('.page-column').count()+Math.ceil(home.max/home.width)+2;
    for(let index=0;index<limit;index++) {
      const before=await read(page);
      await page.keyboard.down(key);await afterPaint(page);
      const state=await read(page);pages.push({key,x:state.x});
      assert.equal(state.key.prevented,true,'Locked page keys must suppress native vertical paging.');
      assert.equal(state.key.repeat,index>0,'Held page keys must keep handling repeat events.');
      assert.ok(Math.abs(state.y-readingY)<=1,'Horizontal paging must preserve the reading position.');
      assert.ok(Math.abs(state.x-before.x)<=state.width+1,'A page key must not skip a viewport of wide content.');
      const end=key==='PageDown'?Math.abs(state.x-state.max)<=1:state.x<=1;
      if(end)break;
      assert.ok(key==='PageDown'?state.x>before.x+1:state.x<before.x-1,'Each page key must advance toward its canvas edge.');
      assert.ok(state.aligned||Math.abs(Math.abs(state.x-before.x)-state.width)<=1,
        'Paging must align a column or advance one viewport inside wide content.');
      assert.notEqual(index,limit-1,'Repeated paging must reach both canvas ends.');
    }
    await page.keyboard.up(key);
  }
  const end=await press('End');assert.ok(Math.abs(end.x-end.max)<=1&&end.key.prevented,'Locked End must reach the logical canvas end.');
  const beforeBack=await read(page);await page.keyboard.press(backward);await page.waitForTimeout(250);
  assert.ok((await read(page)).x<beforeBack.x-1,'The opposite arrow must keep native horizontal motion.');

  for(const key of ['ArrowUp','ArrowDown','Escape','Tab','Shift+Tab','Enter']) {
    await enter();const state=await press(key);
    assert.equal(state.mode,'ready',key+' must leave horizontal mode.');
    assert.equal(state.key.prevented,false,key+' must retain its native action.');
  }
  await focusMain();await page.locator('.page-content').evaluate(node=>{node.scrollTop=100;});
  await enter();const beforeDown=await read(page);await press('ArrowDown');
  await page.waitForFunction(y=>document.querySelector('.page-content').scrollTop>y+1,beforeDown.y);

  for(const key of ['Space','Shift+Space']) {
    await page.locator('.page-content').evaluate(node=>{node.scrollTop=200;});
    await enter();const before=await read(page);await press(key);
    await page.waitForFunction(({y,up})=>up?document.querySelector('.page-content').scrollTop<y-1
      :document.querySelector('.page-content').scrollTop>y+1,{y:before.y,up:key==='Shift+Space'});
    const state=await read(page);
    assert.ok(state.mode==='ready'&&!state.key.prevented,'Space must leave horizontal mode and retain native paging.');
    assert.ok(Math.abs(state.x-before.x)<=1,'Native Space paging must preserve the canvas position.');
  }
  if(await toggle.count())for(const key of ['Enter','Space']) {
    await enter();const expanded=await toggle.getAttribute('aria-expanded');
    await toggle.evaluate(node=>node.focus({preventScroll:true}));
    const state=await press(key);
    assert.equal(state.mode,'ready','Activation keys must leave horizontal mode.');
    assert.equal(state.key.prevented,false,'Activation keys must retain their native action.');
    assert.notEqual(await toggle.getAttribute('aria-expanded'),expanded,key+' must still activate the focused button.');
  }

  for(const selector of ['.prose pre','.prose table']) {
    const node=page.locator(selector).first();
    assert.ok(await node.count(),'Keyboard checks need code and table samples.');
    await press('Escape');
    await node.evaluate(node=>{node.tabIndex=-1;node.focus({preventScroll:true});node.scrollLeft=0;});
    const innerForward=await node.evaluate(node=>getComputedStyle(node).direction==='rtl'?'ArrowLeft':'ArrowRight');
    const before=await read(page);await page.keyboard.press(innerForward);
    await page.waitForFunction(selector=>Math.abs(document.querySelector(selector).scrollLeft)>1,selector);
    assert.equal((await read(page)).mode,'ready','An inner horizontal scroller must not enter canvas mode.');
    assert.ok(Math.abs((await read(page)).x-before.x)<=1,'Native inner scrolling must preserve the canvas position.');
    await enter();await node.evaluate(node=>node.focus({preventScroll:true}));
    const excluded=await node.evaluate(node=>['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].map(key=>{
      const event=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true});node.dispatchEvent(event);return event.defaultPrevented;
    }));
    assert.deepEqual(excluded,[false,false,false,false,false,false],'Inner scrolling keys must remain native even after programmatic focus during canvas mode.');
    await press('Escape');await node.evaluate(node=>{node.scrollLeft=node.scrollWidth*(getComputedStyle(node).direction==='rtl'?-1:1);});
    await press(innerForward);
    assert.equal((await read(page)).mode,'ready','Reaching an inner scroll boundary must not enter canvas mode.');
  }

  const guards=await page.evaluate(()=>{
    const main=document.querySelector('#main'),shell=document.querySelector('.page-shell'),root=document.documentElement;
    const key=(node,value,extra={})=>{
      const event=new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra});node.dispatchEvent(event);return event.defaultPrevented;
    };
    const controls=['input','textarea','select','button','summary','div'].map(tag=>{
      const node=document.createElement(tag);if(tag==='div')node.contentEditable='true';main.appendChild(node);return node;
    });
    try {
      for(const mode of ['ready','locked'])for(const node of controls) {
        key(shell,'Escape');if(mode==='locked')key(shell,'ArrowRight');
        for(const value of ['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown']) {
          if(key(node,value)||root.dataset.canvasWheel!==mode)return false;
        }
      }
      for(const extra of [{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{isComposing:true}]) {
        key(shell,'Escape');key(shell,'ArrowRight',extra);
        if(root.dataset.canvasWheel!=='ready')return false;
        key(shell,'ArrowRight');
        for(const value of ['Home','End','PageUp','PageDown'])if(key(shell,value,extra))return false;
      }
      key(shell,'Escape');shell.addEventListener('keydown',event=>event.preventDefault(),{once:true});key(shell,'ArrowRight');
      return root.dataset.canvasWheel==='ready';
    } finally {controls.forEach(node=>node.remove());}
  });
  assert.equal(guards,true,'Controls, modifiers, composition and handled keys must retain their keyboard behavior.');

  await enter();await page.mouse.move(20,100);
  const beforeWheel=await read(page);await page.mouse.wheel(0,40);
  await page.waitForFunction(x=>scrollX*(document.documentElement.dir==='rtl'?-1:1)>x+1,beforeWheel.x);
  assert.equal((await read(page)).mode,'locked','Keyboard and mouse must share horizontal mode.');
  const wheelEnd=await press('End');assert.ok(Math.abs(wheelEnd.x-wheelEnd.max)<=1,'Mouse input must retain horizontal keyboard paging.');
  await press('Escape');

  await page.locator('.page-content').evaluate(node=>{node.style.inlineSize='200vw';});
  await enter();await press('Home');
  const wide=[];
  for(let index=0;index<await page.locator('.page-column').count()+5;index++) {
    const before=await read(page),state=await press('PageDown');wide.push({from:before.x,to:state.x,width:state.width});
    if(Math.abs(state.x-state.max)<=1)break;
    assert.ok(state.x>before.x+1&&state.x-before.x<=state.width+1,'Paging must reveal a wide column without skipping content.');
  }
  assert.ok(wide.some(step=>Math.abs(step.to-step.from-step.width)<=1),'The wide-column sample must exercise viewport-sized paging.');
  await page.locator('.page-content').evaluate(node=>{node.style.inlineSize='';});
  await enter();
  await page.evaluate(()=>{
    const shell=document.querySelector('.page-shell');shell.replaceChildren();
    shell.style.cssText='inline-size:100%;min-inline-size:0;padding:0';
  });
  const noOverflow=await press('Home');
  assert.ok(noOverflow.max<=1&&!noOverflow.key.prevented&&noOverflow.mode==='ready',
    'A canvas that stops overflowing must release mode and leave keys native.');
  return {fallback,columns,pages,wide};
}
