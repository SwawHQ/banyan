export function parseWidths(value) {
  const parts=value.split(',');
  if (!parts.length || parts.some(part=>!/^\d+$/.test(part)||Number(part)<320||Number(part)>3840)
      || new Set(parts.map(Number)).size!==parts.length) throw new Error('--widths must contain distinct integers from 320 to 3840, separated by commas.');
  return parts.map(Number).join(',');
}

export const afterPaint = page => page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

export async function waitForBrowse(page) {
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-entry-breadcrumb-pending')
    &&!document.documentElement.hasAttribute('data-breadcrumb-sort-pending'));
}

export async function visiblePoint(locator) {
  return locator.evaluate(node=>{
    const box=node.getBoundingClientRect(),view=window.visualViewport;
    const left=Math.max(0,box.left-(view?.offsetLeft||0)),right=Math.min(view?.width||innerWidth,box.right-(view?.offsetLeft||0));
    const top=Math.max(0,box.top-(view?.offsetTop||0)),bottom=Math.min(view?.height||innerHeight,box.bottom-(view?.offsetTop||0));
    if(right<=left||bottom<=top)throw new Error('The control must be visible before activation.');
    return {x:(left+right)/2,y:(top+bottom)/2};
  });
}

export async function clickVisible(page,locator,touch=false) {
  const point=await visiblePoint(locator);
  if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
  await afterPaint(page);
}

export async function activate(page,locator,touch=false) {
  await locator.evaluate(node=>node.scrollIntoView({inline:'nearest',block:'nearest',behavior:'instant'}));
  await afterPaint(page);
  await clickVisible(page,locator,touch);
}
