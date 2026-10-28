import assert from 'node:assert/strict';
import {openArticle,openAside} from '../_shared/page.mjs';

export async function check({page,baseUrl,options}) {
  const results=[];
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:300});await openArticle(page,baseUrl+options.page);await openAside(page);
    const state=await page.evaluate(()=>{
      const main=document.querySelector('.page-content'),aside=document.querySelector('#document-aside'),right=aside.getBoundingClientRect();
      const stage=getComputedStyle(main.parentElement);
      return {sibling:main.parentElement===aside.parentElement,followsMain:main.nextElementSibling===aside,
        gap:stage.direction==='rtl'?main.getBoundingClientRect().left-right.right:right.left-main.getBoundingClientRect().right,expectedGap:parseFloat(stage.columnGap),
        asideWidth:right.width,topDifference:right.top-document.querySelector('[data-root-navigation]').getBoundingClientRect().top,
        overflow:aside.scrollWidth-aside.clientWidth};
    });
    assert.ok(state.sibling&&state.followsMain,'Aside must be the column immediately after the reading column.');
    assert.ok(Math.abs(state.gap-state.expectedGap)<=1,'Aside spacing must match the declared column gap.');
    assert.ok(state.asideWidth>0&&state.asideWidth<=width+1,'Aside must fit the viewport.');
    assert.ok(Math.abs(state.topDifference)<=1&&state.overflow<=1,'Aside must align with navigation and wrap its contents.');
    results.push({width,...state});
  }
  return {page:options.page,cases:results};
}
