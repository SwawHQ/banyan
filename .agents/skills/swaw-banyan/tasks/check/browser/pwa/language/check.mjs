import assert from 'node:assert/strict';
import {active,waiting} from '../_shared/state.mjs';
import {builds,visit,update,observe,quiet} from '../_shared/update.mjs';

async function links(page) {
  return page.locator('[data-language-settings] [data-language-choice]').evaluateAll(nodes=>nodes.map(node=>({
    code:node.dataset.languageChoice,tag:node.tagName,href:node.href,disabled:Boolean(node.disabled),current:node.getAttribute('aria-current')
  })));
}

export async function check({page,server,baseUrl,options}) {
  const pair=await builds(options),href=new URL(options.page,baseUrl).href,events=observe(page);
  try {
    await server.setRoot(pair.old);await visit(page,href,options.timeout);
    await page.waitForSelector('[data-language-settings] [aria-current="page"]');
    const before=await links(page);
    assert.ok(before.length>1&&before.every(link=>link.tag==='A'&&link.href&&!link.disabled),'Language choices must be usable native links.');
    const index=before.findIndex(link=>link.code===options.to&&link.current!=='page');
    assert.ok(index>=0,'--to must select another published language.');
    await server.setRoot(pair.next);await update(page,options.timeout);
    assert.deepEqual(await links(page),before,'A waiting update must not replace or disable language links.');
    await page.locator('[data-language-settings] [data-language-choice]').nth(index).click();
    await page.waitForURL(before[index].href,{waitUntil:'load'});await active(page,options.timeout);
    await waiting(page,options.timeout);
    await page.waitForSelector('[data-language-settings] [aria-current="page"]');
    const current=(await links(page)).filter(link=>link.current==='page');
    assert.deepEqual(current.map(link=>link.code),[options.to],'The destination must select its language.');
    quiet(events);return {page:options.page,to:options.to,before,target:page.url()};
  }finally{events.stop();}
}
