import assert from 'node:assert/strict';
import {setTheme} from '../../../../_shared/browser/theme.mjs';
import {afterPaint,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';

async function visit(page,url) {
  const response=await page.goto(url,{waitUntil:'load'});
  assert.ok(response?.ok(),'Page must return a successful response.');await waitForBrowse(page);await afterPaint(page);
}

async function readPaint(locator) {
  assert.equal(await locator.count(),1,'Choose a page with the required collection control.');
  return locator.evaluate(async node=>{
    getComputedStyle(node).color;
    await Promise.all(node.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));
    const style=getComputedStyle(node),state=getComputedStyle(node,'::before');
    return {color:style.color,background:style.backgroundColor,stateBackground:state.backgroundColor,stateShadow:state.boxShadow,stateRadius:state.borderRadius};
  });
}

async function readHover(locator) {
  assert.equal(await locator.count(),1,'Choose a page with another collection row for hover checks.');
  await locator.hover();return readPaint(locator);
}

async function readFocus(page,locator) {
  assert.equal(await locator.count(),1,'Choose a page with the required collection control.');
  await page.keyboard.press('Tab');await locator.focus();
  return locator.evaluate(node=>{
    const style=getComputedStyle(node),probe=document.createElement('span');probe.style.color='var(--focus-ring)';node.append(probe);
    const ring=getComputedStyle(probe).color;probe.remove();
    return {visible:node.matches(':focus-visible'),color:style.outlineColor,width:style.outlineWidth,style:style.outlineStyle,ring,tag:node.tagName};
  });
}

async function clearInput(page) {await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement?.blur());}

function checkPaint(state,selected) {
  assert.equal(state.background,'rgba(0, 0, 0, 0)','Collection controls must keep the element background transparent.');
  assert.ok(state.stateBackground!=='rgba(0, 0, 0, 0)'||state.stateShadow!=='none','Collection state must have a visible background or ring.');
  if(selected)assert.ok(state.stateBackground!=='rgba(0, 0, 0, 0)'&&state.stateShadow!=='none','Selected collection controls must retain their state background and ring.');
}

function checkFocus(state,tag) {
  assert.equal(state.tag,tag,'Collection controls must retain native link/button semantics.');
  assert.ok(state.visible&&state.style==='dashed'&&state.width==='2px'&&state.color===state.ring,'Collection controls must use the visible 2px dashed focus ring.');
}

const rootCurrent=page=>page.locator('[data-root-navigation] [data-root-href].is-current');
const rootOther=page=>page.locator('[data-root-navigation] [data-root-href]:not(.is-current)').first();

export async function check({page,baseUrl,options}) {
  await page.emulateMedia({reducedMotion:'reduce'});const cases=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:900});
    for(const theme of ['light','dark']) {
      await visit(page,baseUrl+options.choices);
      const choice=page.locator('[data-theme-choice='+JSON.stringify(theme)+']');
      assert.equal(await choice.count(),1,'Choose an appearance page with light and dark buttons.');
      await choice.click();await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);
      await setTheme(page,theme);await clearInput(page);
      assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),theme,'HTML color-scheme must follow the selected theme.');
      const selected=await readPaint(rootCurrent(page)),choiceSelected=await readPaint(choice);
      checkPaint(selected,true);assert.deepEqual(choiceSelected,selected,'Choice buttons must reuse root selection styles.');
      const hover=await readHover(rootOther(page)),choiceHover=await readHover(page.locator('[data-theme-choice]:not(.is-current)').first());
      checkPaint(hover,false);assert.deepEqual(choiceHover,hover,'Choice buttons must reuse root hover styles.');
      const rootFocus=await readFocus(page,rootCurrent(page)),choiceFocus=await readFocus(page,choice);
      checkFocus(rootFocus,'A');checkFocus(choiceFocus,'BUTTON');

      await visit(page,baseUrl+options.page);await setTheme(page,theme);await clearInput(page);
      const current=page.locator('.slot-breadcrumb .collection-item-link.is-current').first(),other=page.locator('.slot-breadcrumb .collection-item-link:not(.is-current)').first();
      const pathSelected=await readPaint(current),pathRootSelected=await readPaint(rootCurrent(page));
      assert.deepEqual(pathRootSelected,selected,'Article root selection must reuse the settings-page style.');
      assert.deepEqual(pathSelected,selected,'Path rows must reuse root selection styles.');
      const pathHover=await readHover(other);assert.deepEqual(pathHover,hover,'Path rows must reuse root hover styles.');
      const pathFocus=await readFocus(page,current);checkFocus(pathFocus,'A');

      await visit(page,baseUrl+options.collection);await setTheme(page,theme);await clearInput(page);
      const row=page.locator('.slot-main .collection-list .collection-item-link').first();
      const mainHover=await readHover(row);assert.deepEqual(mainHover,hover,'Main collection rows must reuse root hover styles.');
      const mainFocus=await readFocus(page,row);checkFocus(mainFocus,'A');
      for(const focus of [choiceFocus,pathFocus,mainFocus])assert.deepEqual({...focus,tag:'A'},rootFocus,'All collection controls must share keyboard focus styles.');
      cases.push({width,theme,selected,hover,choiceSelected,choiceHover,pathSelected,pathHover,mainHover,rootFocus,choiceFocus,pathFocus,mainFocus});
    }
  }
  return {page:options.page,collection:options.collection,choices:options.choices,cases};
}
