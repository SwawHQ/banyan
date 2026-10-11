import assert from 'node:assert/strict';
import {waitForBrowse,afterPaint} from '../../../../_shared/browser/viewport.mjs';
import {readColumns,selectColumn,columnLocator,openPage,columnSort} from '../_shared/page.mjs';

function sourceLink(column,article,origin) {
  const rows=column.rows.filter(row=>row.key===article);
  assert.equal(rows.length,1,'Source column '+column.href+' must link to the requested article exactly once: '+article);
  const url=new URL(rows[0].href);
  assert.equal(url.origin,origin,'Source article must stay within the local site.');
  assert.equal(url.searchParams.get('from'),column.source.logical_path.replace(/^\/+|\/+$/g,''),'Article link must retain its declared column source.');
  return url.href;
}

export async function check({page,baseUrl,options}) {
  assert.notEqual(new URL(options.page,baseUrl).pathname,options.article,'Choose another article, not the current page.');
  const context=await page.context().browser().newContext({javaScriptEnabled:false,serviceWorkers:'block'});
  context.setDefaultTimeout(options.timeout||15000);context.setDefaultNavigationTimeout(options.timeout||15000);
  let raw;
  try {
    const staticPage=await context.newPage(),response=await staticPage.goto(baseUrl+options.page,{waitUntil:'load'});
    assert.ok(response?.ok(),'Static page must return a successful response.');
    const column=await selectColumn(staticPage,options.column);raw=sourceLink(column,options.article,baseUrl);
    const rawHref=await columnLocator(staticPage,options.column).locator('[data-collection-entry]').evaluateAll((nodes,target)=>nodes.find(node=>node.href===target)?.getAttribute('href'),raw);
    await columnLocator(staticPage,options.column).locator('[data-collection-entry][href='+JSON.stringify(rawHref)+']').click();
    await staticPage.waitForURL(raw);
  } finally {await context.close();}
  await openPage(page,baseUrl+options.page);
  const column=await selectColumn(page,options.column),target=sourceLink(column,options.article,baseUrl);
  assert.equal(new URL(target).searchParams.get('from'),new URL(raw).searchParams.get('from'),'Runtime initialization must preserve the static article source.');
  if(column.toggle)assert.equal(new URL(target).searchParams.get('sort')||column.source.default_sort,columnSort(column),
    'Runtime article link must carry the column sort.');
  const href=await columnLocator(page,options.column).locator('[data-collection-entry]').evaluateAll((nodes,target)=>nodes.find(node=>node.href===target)?.getAttribute('href'),target);
  await columnLocator(page,options.column).locator('[data-collection-entry][href='+JSON.stringify(href)+']').click();await page.waitForURL(target);
  await waitForBrowse(page);await afterPaint(page);
  assert.equal(page.url(),target,'Clicking must preserve the complete source link URL and sorting state.');
  const selected=await readColumns(page);
  assert.ok(selected.some(column=>column.href===options.column),'The opened article must retain its source column.');
  const current=columnLocator(page,options.column).locator('[data-collection-entry][aria-current="page"]');
  assert.equal(await current.count(),1,'Source column must mark the opened article as current.');
  assert.equal(await current.evaluate(node=>new URL(node.href).pathname),options.article,'Current source row must identify the opened article.');
  await page.reload();await waitForBrowse(page);await afterPaint(page);
  assert.equal(page.url(),target,'Reload must preserve the source and sorting URL.');
  assert.ok((await readColumns(page)).some(column=>column.href===options.column),'Reload must retain the source column.');
  assert.equal(await current.evaluate(node=>new URL(node.href).pathname),options.article,'Reload must retain the current article selection.');
  return {page:options.page,column:options.column,article:options.article,raw,target};
}
