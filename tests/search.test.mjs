import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {loadChromium} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';

test('reference search: isolated assets, CSP, live results, history, languages and subdirectory',async()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/search-tests');fs.mkdirSync(parent,{recursive:true});
  const work=fs.mkdtempSync(path.join(parent,'run-')),output=path.join(work,'site');
  let server,browser;
  try {
    const build=spawnSync(process.execPath,['.agents/skills/swaw-banyan/tasks/build/entry.mjs','--destination',output,'--baseURL','http://localhost/sub/'],
      {env:fixtureEnvironment(work),encoding:'utf8',windowsHide:true});
    assert.equal(build.status,0,build.stdout+build.stderr);
    assert(!fs.existsSync(path.join(output,'site/search-index.json')));
    for(const relative of fs.readdirSync(output,{recursive:true}).filter(file=>file.endsWith('.html'))){
      assert(!fs.readFileSync(path.join(output,relative),'utf8').includes('data-pagefind-'));
    }
    server=await createStaticSiteServer(output);await server.start();
    const chromium=loadChromium();browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),base=server.getBaseUrl();
    const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.goto(base+'/sub/zh/p/glossary/');
    const originalWidth=(await page.locator('.page-content').boundingBox()).width;
    assert.equal(requests.some(url=>/pagefind|\/search\//.test(url)),false);
    const normal=await context.request.get(base+'/sub/zh/p/glossary/');
    assert(!normal.headers()['content-security-policy'].includes('wasm-unsafe-eval'));
    await page.locator('[data-root-href$="/search/"]').click();
    const input=page.locator('[data-search-input]');await input.waitFor();
    const historyLength=await page.evaluate(()=>history.length);
    assert.equal((await page.locator('.page-content').boundingBox()).width,originalWidth);
    await input.fill('配置');await page.locator('.search-result').first().waitFor();
    assert.equal(new URL(page.url()).search,'');
    assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('q'),'配置');
    assert.equal(await page.evaluate(()=>history.length),historyLength);
    const first=page.locator('.search-result a').first();
    assert.equal(await first.evaluate(e=>getComputedStyle(e).fontWeight),'700');
    assert.equal(await first.locator('.search-excerpt').count(),1);
    await first.hover();
    const resultHover=await first.evaluate(e=>({background:getComputedStyle(e,'::before').backgroundColor,ring:getComputedStyle(e,'::before').boxShadow,decoration:getComputedStyle(e).textDecorationLine}));
    const rootItem=page.locator('[data-root-navigation] a.item-control').first();
    await rootItem.hover();
    const rootHover=await rootItem.evaluate(e=>({background:getComputedStyle(e,'::before').backgroundColor,ring:getComputedStyle(e,'::before').boxShadow}));
    assert.equal(resultHover.background,rootHover.background);
    assert.equal(resultHover.ring,rootHover.ring);
    assert.equal(resultHover.decoration,'none');
    assert.equal(await page.locator('.search-result').count(),15);
    await page.locator('.search-more').click();
    await page.waitForFunction(()=>document.querySelectorAll('.search-result').length>15);
    assert(!await page.locator('.search-result a[href*="/_res/"]').count());
    assert(!await page.locator('.search-result a[href*="/powered-by/"]').count());
    await input.press('Escape');await page.waitForURL('**/sub/zh/p/glossary/');
    await page.locator('[data-root-href$="/search/"]').click();await input.waitFor();
    assert.equal(await input.inputValue(),'配置');
    assert.deepEqual(await input.evaluate(e=>[document.activeElement===e,e.selectionStart,e.selectionEnd]),[true,0,2]);
    await first.waitFor();
    await input.evaluate(e=>e.blur());await page.waitForURL('**/sub/zh/p/glossary/');
    await page.locator('[data-root-href$="/search/"]').click();await first.waitFor();
    await first.click();await page.waitForURL(url=>!url.pathname.endsWith('/search/'));
    assert.notEqual(new URL(page.url()).pathname,'/sub/zh/');
    for(const [lang,query] of [['en','Hugo'],['ar','المقال']]){
      const prefix=lang==='en'?'':lang+'/';
      await page.goto(base+'/sub/'+prefix+'search/');assert.equal(await input.inputValue(),'');
      await input.fill(query);await first.waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'),lang);
      const links=await page.locator('.search-result a').evaluateAll(nodes=>nodes.map(n=>n.pathname));
      assert(links.every(link=>link.startsWith('/sub/'+prefix)));
    }
    await page.goto(base+'/sub/zh/search/');await input.fill('zzzz_no_matching_page_1298');
    await page.waitForFunction(()=>document.querySelector('.search-status').textContent==='没有找到结果。');
    await input.fill('build');await first.waitFor();
    const excerpts=await page.locator('.search-excerpt').allTextContents();
    assert(excerpts.some(text=>text.includes('<build>')));
    assert(!excerpts.some(text=>text.includes('&lt;build&gt;')));
    await input.fill('配置');await first.waitFor();
    await page.setViewportSize({width:390,height:844});
    assert((await page.locator('.page-content').boundingBox()).width<=390);
    await page.goto(base+'/sub/zh/search/#q=配置&keep=value');
    await first.waitFor();assert.equal(await input.inputValue(),'配置');
    await page.reload();await first.waitFor();assert.equal(await input.inputValue(),'配置');
    const requestCount=requests.length;
    await page.evaluate(()=>{location.hash='q=Hugo&keep=value';});
    await page.waitForFunction(()=>document.querySelector('[data-search-input]').value==='Hugo');
    await first.waitFor();
    await page.goBack();
    await page.waitForFunction(()=>document.querySelector('[data-search-input]').value==='配置');
    await first.waitFor();
    await input.fill('中文 العربية + & # = /');await input.press('Enter');
    assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('q'),'中文 العربية + & # = /');
    await page.reload();assert.equal(await input.inputValue(),'中文 العربية + & # = /');
    await input.fill('');await input.press('Enter');
    assert.equal(new URL(page.url()).hash,'#keep=value');
    assert.equal(await page.locator('.search-result').count(),0);
    assert(!requests.slice(requestCount).some(url=>new URL(url).searchParams.has('q')));
    await page.goto(base+'/sub/zh/search/?q=配置');
    assert.equal(await input.inputValue(),'');
    assert.equal(await page.locator('.search-result').count(),0);
    assert.deepEqual(errors,[]);
    await context.close();
    const missingLanguage=await browser.newPage();
    const languageRequests=[];missingLanguage.on('request',r=>languageRequests.push(r.url()));
    await missingLanguage.route('**/pagefind-entry.json',route=>route.fulfill({json:{languages:{zh:{page_count:23}}}}));
    await missingLanguage.goto(base+'/sub/ar/search/#q=Hugo');
    await missingLanguage.waitForFunction(()=>document.querySelector('.search-status').textContent==='لا توجد نتائج.');
    assert.equal(await missingLanguage.locator('.search-result').count(),0);
    assert(!languageRequests.some(url=>url.endsWith('/pagefind.js')));
    await missingLanguage.close();
    const escapedPage=await browser.newPage();
    await escapedPage.route('**/pagefind/pagefind.js',route=>route.fulfill({contentType:'text/javascript',body:
      'export async function search(){return {results:[{data:async()=>({url:"/sub/zh/p/glossary/",meta:{title:"test"},plain_excerpt:"&lt;img src=x onerror=alert(1)&gt; &amp;lt;literal&amp;gt;"})}]}}'}));
    await escapedPage.goto(base+'/sub/zh/search/#q=test');
    await escapedPage.locator('.search-result').first().waitFor();
    assert.equal(await escapedPage.locator('.search-excerpt').textContent(),'<img src=x onerror=alert(1)> &lt;literal&gt;');
    assert.equal(await escapedPage.locator('.search-excerpt img').count(),0);
    await escapedPage.close();
    for(const mode of ['supported','unsupported','throws']) {
      const keyboardPage=await browser.newPage();
      const keyboardErrors=[];keyboardPage.on('pageerror',e=>keyboardErrors.push(e.message));
      await keyboardPage.addInitScript(mode=>{
        Object.defineProperty(navigator,'virtualKeyboard',{configurable:true,value:mode==='unsupported'?undefined:{show(){
          window.keyboardFocused=document.activeElement?.matches('[data-search-input]');
          if(mode==='throws')throw new Error('Keyboard unavailable');
        }}});
      },mode);
      await keyboardPage.goto(base+'/sub/zh/search/#q=配置');
      await keyboardPage.locator('.search-result').first().waitFor();
      if(mode!=='unsupported')assert.equal(await keyboardPage.evaluate(()=>window.keyboardFocused),true);
      assert.deepEqual(keyboardErrors,[]);
      await keyboardPage.close();
    }
    const content=path.join(work,'content');fs.cpSync('content',content,{recursive:true});
    for(const file of fs.readdirSync(path.join(content,'search'))){
      const target=path.join(content,'search',file);
      if(file.endsWith('.md'))fs.writeFileSync(target,fs.readFileSync(target,'utf8').replace('source: rss','source: ["p/", "search/**/*.html"]'));
    }
    const selected=spawnSync(process.execPath,['.agents/skills/swaw-banyan/tasks/build/entry.mjs','--destination',path.join(work,'selector-site')],
      {env:{...fixtureEnvironment(work),HUGO_CONTENTDIR:content},encoding:'utf8',windowsHide:true});
    assert.equal(selected.status,0,selected.stdout+selected.stderr);
    assert(!fs.existsSync(path.join(work,'selector-site/site/search-index.json')));
    assert.match(selected.stdout,/p\/\*\*\/\*\.html/);
    assert.match(selected.stdout,/Indexed 3 languages/);
    for(const file of fs.readdirSync(path.join(content,'search'))){
      const target=path.join(content,'search',file);
      if(file.endsWith('.md'))fs.writeFileSync(target,fs.readFileSync(target,'utf8').replace('source: ["p/", "search/**/*.html"]','source: "**/*.html"'));
    }
    const globbed=spawnSync(process.execPath,['.agents/skills/swaw-banyan/tasks/build/entry.mjs','--destination',path.join(work,'glob-site')],
      {env:{...fixtureEnvironment(work),HUGO_CONTENTDIR:content},encoding:'utf8',windowsHide:true});
    assert.equal(globbed.status,0,globbed.stdout+globbed.stderr);
    assert.match(globbed.stdout,/Indexed 3 languages/);
    for(const directory of ['articles','products','search'])for(const file of fs.readdirSync(path.join(content,directory))){
      if(!file.startsWith('_index')||!file.endsWith('.md'))continue;
      const target=path.join(content,directory,file);
      fs.writeFileSync(target,fs.readFileSync(target,'utf8').replaceAll('layout: page-article-rss','layout: page-article-norss').replace('source: "**/*.html"','source: rss'));
    }
    const empty=spawnSync(process.execPath,['.agents/skills/swaw-banyan/tasks/build/entry.mjs','--destination',output,'--baseURL','http://localhost/sub/'],
      {env:{...fixtureEnvironment(work),HUGO_CONTENTDIR:content},encoding:'utf8',windowsHide:true});
    assert.equal(empty.status,0,empty.stdout+empty.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output,'pagefind/pagefind-entry.json'),'utf8')),{languages:{}});
    assert(!fs.existsSync(path.join(output,'pagefind/pagefind.js')));
    const emptyPage=await browser.newPage();
    await emptyPage.goto(base+'/sub/zh/search/#q=Hugo');
    await emptyPage.waitForFunction(()=>document.querySelector('.search-status').textContent==='没有找到结果。');
    assert.equal(await emptyPage.locator('.search-result').count(),0);await emptyPage.close();
  } finally {
    await browser?.close();await server?.stop();
    assert.equal(path.dirname(fs.realpathSync(work)),fs.realpathSync(parent));fs.rmSync(work,{recursive:true,force:true});
  }
});
