import assert from 'node:assert/strict';
import {setTheme} from '../../_shared/theme.mjs';
import {activate,clickVisible,afterPaint} from '../../_shared/viewport.mjs';
import {openArticle,openAside,readingState} from '../_shared/page.mjs';

export async function check({page,baseUrl,options}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[],results=[];
  const record=error=>errors.push(error.message);page.on('pageerror',record);
  // Keep the controller pending until the server-rendered collapsed state is observed.
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const controller='**/js/document/aside.*.js';
  const hold=async route=>{await gate;await route.continue();};
  await page.route(controller,hold);
  try {
    await page.setViewportSize({width:Number(options.widths.split(',')[0]),height:844});
    const response=await page.goto(baseUrl+options.page,{waitUntil:'commit'});
    assert.ok(response?.ok(),'Article must return a successful response.');
    await page.locator('#document-aside-toggle').waitFor({state:'attached'});
    assert.equal(await page.locator('#document-aside-toggle').count(),1,'Article must have one aside toggle.');
    await afterPaint(page);
    assert.equal(await page.locator('#document-aside').isVisible(),false,'Aside must be collapsed before its controller loads.');
    assert.equal(await page.locator('#document-aside-toggle').getAttribute('aria-expanded'),'false');
  } finally {
    release();
    // Finish the held request before removing its handler.
    await page.waitForLoadState('load');await page.unroute(controller,hold);
  }
  try {
    for(const width of options.widths.split(',').map(Number)) {
      // Start each mobile width without the previous document's retained scale.
      await page.goto('about:blank');
      await page.setViewportSize({width,height:844});
      await openArticle(page,baseUrl+options.page);
      await page.locator('.page-shell').evaluate(node=>node.scrollIntoView({inline:'end',block:'nearest',behavior:'instant'}));
      await afterPaint(page);
      const collapsed=await readingState(page),toggle=page.locator('#document-aside-toggle'),close=page.locator('#document-aside-close');
      assert.ok(collapsed.left>=-1&&collapsed.right<=collapsed.viewport+1,'Reading column must fit in the viewport. '+JSON.stringify(collapsed));
      assert.equal(await toggle.getAttribute('aria-controls'),'document-aside');
      assert.equal(await close.getAttribute('aria-controls'),'document-aside');
      let progress;
      for(const theme of ['light','dark']) {
        await setTheme(page,theme);
        const before=await readingState(page);
        await clickVisible(page,toggle,options.touch);
        assert.equal(await toggle.getAttribute('aria-expanded'),'true','Pointer activation must open the aside.');
        assert.equal(await page.locator('#document-aside').isVisible(),true);
        const opened=await readingState(page);
        for(const key of ['width','height','x','left','y'])assert.equal(opened[key],before[key],'Opening must preserve reading geometry and position: '+key);
        assert.equal(await page.locator('#document-aside').evaluate(node=>node.contains(document.activeElement)),false,'Pointer activation must not move focus into the aside.');
        await clickVisible(page,toggle,options.touch);
        assert.equal(await toggle.getAttribute('aria-expanded'),'false');
        assert.equal(await page.locator('#document-aside').isVisible(),false);
        assert.deepEqual(await readingState(page),before,'Closing from the title control must preserve reading state.');
        await openAside(page,options.touch);
        progress=await page.locator('.page-content').evaluate(node=>{node.scrollTop=700;return node.scrollTop;});
        assert.ok(progress>0,'Toggle checks need a scrollable article.');
        await page.locator('#document-aside a').first().evaluate(node=>node.focus({preventScroll:true}));
        const escapeBefore=await readingState(page);
        await page.keyboard.press('Escape');await afterPaint(page);
        assert.equal(await toggle.getAttribute('aria-expanded'),'false','Escape must close the aside.');
        const escaped=await readingState(page);
        for(const key of ['width','height','x','left','y'])assert.equal(escaped[key],escapeBefore[key],'Escape must preserve reading state: '+key);
        assert.equal(escaped.canvasWidth,collapsed.canvasWidth,'Closing must remove the aside column.');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'main','Focus must leave the hidden aside.');
        await page.locator('.page-content').evaluate(node=>{node.scrollTop=0;});
      }
      await page.locator('.page-content').evaluate(node=>{
        node.style.scrollMarginInlineStart='40px';node.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'});node.style.scrollMarginInlineStart='';
      });
      await afterPaint(page);
      const partial=await readingState(page);
      await clickVisible(page,toggle,options.touch);await clickVisible(page,toggle,options.touch);
      assert.equal((await readingState(page)).x,partial.x,'Toggling a partly visible article must not realign it.');
      // Exercise native clamping only when this page has room beyond the closed edge.
      const boundary=partial.canvasWidth-partial.viewport;
      await openAside(page,options.touch);
      const available=await readingState(page);
      if(available.canvasWidth-available.viewport>boundary+90) {
        await page.locator('.page-content').evaluate((node,x)=>{
          node.style.scrollMarginInlineStart=`${node.getBoundingClientRect().left+scrollX-x}px`;
          node.scrollIntoView({inline:'start',block:'nearest',behavior:'instant'});node.style.scrollMarginInlineStart='';
        },boundary+100);
        await afterPaint(page);
        const beyond=await readingState(page);
        assert.ok(beyond.x>boundary+90,'Exercise a position beyond the closed canvas edge.');
        await activate(page,close,options.touch);
        const closed=await readingState(page);
        assert.equal(closed.x,boundary,'Closing must let the browser clamp to the new canvas edge.');
        assert.equal(closed.y,beyond.y);assert.equal(closed.canvasWidth,partial.canvasWidth);
      } else {await activate(page,close,options.touch);}
      await toggle.evaluate(node=>node.focus({preventScroll:true}));
      const beforeKeyboard=await readingState(page);
      for(const [key,expanded] of [['Enter','true'],['Escape','false'],['Space','true'],['Space','false'],['Enter','true']]) {
        await page.keyboard.press(key);await afterPaint(page);
        assert.equal(await toggle.getAttribute('aria-expanded'),expanded,'Keyboard control must respond to '+key);
        assert.equal((await readingState(page)).x,beforeKeyboard.x,'Keyboard toggling must preserve horizontal position.');
      }
      await close.evaluate(node=>node.focus({preventScroll:true}));await page.keyboard.press('Enter');await afterPaint(page);
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
      results.push({width,collapsed,progress});
    }
    assert.deepEqual(errors,[],'Aside interactions must not raise JS errors.');
    return {page:options.page,touch:options.touch,cases:results};
  } finally {page.off('pageerror',record);}
}
