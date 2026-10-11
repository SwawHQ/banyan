import {afterPaint} from '../../../../_shared/browser/viewport.mjs';

export const touchPosition=page=>page.evaluate(()=>({
  x:window.visualViewport?.pageLeft??scrollX,y:document.querySelector('.page-content').scrollTop
}));

// Native CDP input; DOM dispatchEvent and scrollTo do not exercise touch scrolling.
export async function touchDrag(page,cdp,{x,y=180,dx,dy=0}) {
  const before=await touchPosition(page),point=(x,y)=>({x,y,id:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(x,y)]});
  const steps=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/20);
  for(let step=1;step<=steps;step++) {
    await page.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x+dx*step/steps,y+dy*step/steps)]});
  }
  // Pause before release so inertia does not hide the final position.
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await afterPaint(page);
  return {x,y,dx,dy,before,after:await touchPosition(page)};
}
