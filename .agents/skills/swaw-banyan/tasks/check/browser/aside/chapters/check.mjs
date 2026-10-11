import assert from 'node:assert/strict';
import {activate,waitForBrowse} from '../../../../_shared/browser/viewport.mjs';
import {openArticle,openAside} from '../_shared/page.mjs';

export async function check({page,baseUrl,options}) {
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[],url=baseUrl+options.page;
  for(const width of options.widths.split(',').map(Number)) {
    await page.setViewportSize({width,height:800});await openArticle(page,url);
    const structure=await page.evaluate(()=>({
      label:document.querySelector('.document-toc')?.getAttribute('aria-label'),
      headings:[...document.querySelectorAll('.prose :is(h2,h3)[id]')].map(node=>({id:node.id,text:node.textContent.trim()})),
      entries:[...document.querySelectorAll('.document-toc a[href]')].map(node=>({id:decodeURIComponent(node.hash.slice(1)),text:node.querySelector('.collection-item-title').textContent.trim()})),
      nested:document.querySelectorAll('.document-toc ul ul').length
    }));
    assert.ok(structure.headings.length>=2,'Chapter checks need at least two h2/h3 headings.');
    assert.deepEqual(structure.entries[0],{id:'main',text:structure.label},'The chapter list must begin with the article-start link.');
    assert.deepEqual(structure.entries.slice(1),structure.headings,'Chapter entries must match published headings in order.');
    assert.equal(structure.nested,0,'H2 and H3 must form one flat chapter list.');
    await openAside(page);
    const id=structure.headings[Math.floor(structure.headings.length/2)].id;
    const link=page.locator('.document-toc a').filter({has:page.locator('.collection-item-title')}).nth(Math.floor(structure.headings.length/2)+1);
    const assertTarget=async()=>{
      await page.waitForFunction(id=>{
        const target=document.getElementById(id),content=document.querySelector('.page-content');
        const active=document.querySelector('.document-toc [aria-current="location"]');
        if(!target||!active)return false;
        const box=target.getBoundingClientRect(),main=content.getBoundingClientRect(),view=window.visualViewport;
        return box.top>=main.top-1&&box.top<=main.top+24
          &&main.left-(view?.offsetLeft||0)>=-1&&main.right-(view?.offsetLeft||0)<=(view?.width||innerWidth)+1
          &&decodeURIComponent(active.hash.slice(1))===id;
      },id);
    };
    await activate(page,link);await page.waitForURL(target=>decodeURIComponent(target.hash.slice(1))===id);await assertTarget();
    assert.equal(await page.locator('#document-aside-toggle').getAttribute('aria-expanded'),'true','Selecting a chapter must keep the aside open.');
    assert.equal(new URL(page.url()).search,new URL(url).search,'Chapter activation must preserve source parameters.');
    await activate(page,link);await assertTarget();
    await page.reload({waitUntil:'load'});await waitForBrowse(page);await assertTarget();
    await openAside(page);
    const before=await page.evaluate(()=>({hash:location.hash,aside:document.querySelector('#document-aside').scrollTop}));
    await page.locator('.page-content').evaluate(node=>{node.scrollTop=100000;});
    await page.waitForFunction(()=>document.querySelector('.document-toc a:last-of-type')
      &&[...document.querySelectorAll('.document-toc a')].at(-1)?.getAttribute('aria-current')==='location');
    assert.deepEqual(await page.evaluate(()=>({hash:location.hash,aside:document.querySelector('#document-aside').scrollTop})),before,
      'Reading progress must update the highlight without rewriting the URL or scrolling the aside.');
    await page.goto('about:blank');await page.goBack({waitUntil:'load'});await waitForBrowse(page);await assertTarget();
    const direct=new URL(url);direct.hash=encodeURIComponent(id);
    await page.goto(direct.href,{waitUntil:'load'});await waitForBrowse(page);await assertTarget();
    await openAside(page);
    assert.ok(await page.locator('#document-aside').evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Long chapter titles must wrap inside the aside.');
    await activate(page,page.locator('.document-toc a[href="#main"]'));await page.waitForURL(target=>target.hash==='#main');
    await page.waitForFunction(()=>document.querySelector('.page-content').scrollTop===0);
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('.page-content').scrollTop===0);
    results.push({width,headings:structure.headings.length,chapter:id});
  }
  const plain=await page.context().browser().newContext({javaScriptEnabled:false,serviceWorkers:'block',viewport:{width:390,height:800}});
  plain.setDefaultTimeout(options.timeout??15000);
  try {
    const document=await plain.newPage();await document.goto(url,{waitUntil:'load'});
    assert.equal(await document.locator('#document-aside-toggle').isVisible(),false,'The toggle must be absent without JS.');
    assert.equal(await document.locator('#document-aside-close').isVisible(),false);assert.equal(await document.locator('#document-aside').isVisible(),true);
    await document.locator('.document-toc a').last().click();
    assert.ok(await document.locator('.page-content').evaluate(node=>node.scrollTop>0),'Native chapter links must work without JS.');
    await document.locator('.document-toc a[href="#main"]').click();
    assert.equal(await document.locator('.page-content').evaluate(node=>node.scrollTop),0,'Native article-start links must work without JS.');
  } finally {await plain.close();}
  return {page:options.page,cases:results,noScript:true};
}
