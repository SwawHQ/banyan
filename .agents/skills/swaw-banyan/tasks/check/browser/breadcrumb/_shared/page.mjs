import assert from 'node:assert/strict';
import {afterPaint,waitForBrowse} from '../../_shared/viewport.mjs';

export const columnsSelector='[data-slot=breadcrumb] [data-collection-column]';
export const columnLocator=(page,href)=>page.locator(columnsSelector+'[data-breadcrumb-collection-href='+JSON.stringify(href)+']');

export function columnSort(column) {
  const url=new URL(column.toggle),depth=column.source.logicalPath.split('/').filter(Boolean).length;
  const lineage=(new URLSearchParams(url.hash.slice(1)).get('from')||column.source.logicalPath).split('/').filter(Boolean).length;
  const tokens=(new URLSearchParams(url.hash.slice(1)).get('sorts')||'').split(',');
  const slots=[...Array(Math.max(0,lineage-tokens.length)).fill('_'),...tokens];
  const next=slots[depth-1],token=next&&next!=='_'?next:column.source.defaultSort;
  return token.replace(/-(asc|desc)$/,'')+'-'+(column.indicator==='↑'?'asc':'desc');
}

export async function openPage(page,url) {
  const response=await page.goto(url,{waitUntil:'load'})||await page.reload({waitUntil:'load'});
  assert.ok(response?.ok(),'Page must return a successful response.');
  await waitForBrowse(page);await afterPaint(page);
}

export const readColumns=page=>page.evaluate(selector=>{
  const sources=JSON.parse(document.body.dataset.entryBreadcrumbSources||'[]');
  const registry=sources.flatMap(source=>[source.currentColumn?.source,...(source.columns||[]).map(column=>column.source)]).filter(Boolean);
  return [...document.querySelectorAll(selector)].map(column=>{
    const href=column.dataset.breadcrumbCollectionHref,source=registry.find(source=>source.href===href);
    const toggle=column.querySelector('[data-collection-sort-toggle]');
    return {href,source,toggle:toggle?.href,indicator:toggle?.querySelector('[data-sort-indicator]')?.textContent.trim(),
      field:toggle?.querySelector('.path-sort-label')?.textContent.trim(),y:column.scrollTop,
      rows:[...column.querySelectorAll('[data-list-entry]')].map(link=>({
        key:new URL(link.href).pathname,href:link.href,text:link.textContent.trim()
      }))};
  });
},columnsSelector);

export async function selectColumn(page,wanted) {
  const columns=await readColumns(page);
  const selected=wanted?columns.find(column=>column.href===wanted):columns.find(column=>column.toggle);
  assert.ok(selected,'Page must contain the requested breadcrumb column.');
  assert.ok(selected.source?.logicalPath,'Column must have declared collection source metadata.');
  return selected;
}

// Capture SSR nodes before the external controller can sort or rebuild them.
export async function observeColumns(page,url) {
  await page.goto('about:blank');
  await page.addInitScript(selector=>{
    const observer=new MutationObserver(()=>{
      if(!document.getElementById('main'))return;
      window.__swbanParsedColumns=[...document.querySelectorAll(selector)].map(column=>({
        column,href:column.dataset.breadcrumbCollectionHref,
        nodes:[...column.querySelectorAll('[data-list-header],[data-list-item],[data-item-field],.item-icon')]
      }));
      observer.disconnect();
    });
    observer.observe(document,{childList:true,subtree:true});
  },columnsSelector);
  let release;
  const gate=new Promise(resolve=>{release=resolve;}),held=[];
  const handler=route=>{
    if(route.request().resourceType()!=='script')return route.continue();
    const request=gate.then(()=>route.continue());held.push(request);return request;
  };
  await page.route('**/*',handler);
  let initial;
  try {
    const response=await page.goto(url,{waitUntil:'commit'});
    assert.ok(response?.ok(),'Page must return a successful response.');
    await page.waitForFunction(()=>!!window.__swbanParsedColumns
      &&[...document.querySelectorAll('link[rel="stylesheet"]')].every(link=>link.disabled||link.sheet));
    await afterPaint(page);initial={columns:await readColumns(page),sourcePending:await page.evaluate(()=>document.documentElement.hasAttribute('data-entry-breadcrumb-pending'))};
  } finally {
    release();try {await Promise.all(held);}finally {await page.unroute('**/*',handler);}
  }
  await page.waitForLoadState('load');await waitForBrowse(page);await afterPaint(page);
  return initial;
}
