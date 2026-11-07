import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteMounts,fixtureDelivery,serviceWorkerPolicy,directoryPage} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {runScenarioSuite} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/suite.mjs';
import {loadWebkit} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {visit} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/_shared/update.mjs';
import {afterPaint,waitForBrowse} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/viewport.mjs';
import {readNavigationFragment} from '../.agents/skills/swaw-banyan/tasks/_shared/html/breadcrumb.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {extractStartTags,extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-nav-fragments');
const article='/p/example-product/',slowSource='/products/examples/',fastSource='/articles-all/';
let work,output;
const publishedColumns=new Map();
const publishedHrefs=new Map();
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function routeFor(source){return article+'#from='+source.split('/').filter(Boolean).join('/');}
async function pathData(page,logicalPath){
  const data=await page.evaluate(logicalPath=>{
    const navigation=JSON.parse(document.body.dataset.navigation);
    const terminal=logicalPath===null?navigation.default:logicalPath;
    const segments=terminal.split('/').filter(Boolean),paths=segments.map((_,index)=>'/'+segments.slice(0,index+1).join('/')+'/');
    if(!paths.every(key=>navigation.columns[key]))throw new Error('Fixture column is missing '+terminal);
    const url=key=>navigation.resources+navigation.columns[key]+'.txt';
    const columnUrls=paths.map(url);
    return {urls:[...new Set(columnUrls)],columnUrls,
      all:Object.keys(navigation.columns).map(url),paths,error:navigation.error};
  },logicalPath);
  return {...data,hrefs:data.columnUrls.map(url=>publishedHrefs.get(url)||'')};
}
const sourceData=(page,logicalPath)=>pathData(page,logicalPath);
const defaultData=page=>pathData(page,null);
async function snapshot(page){return page.evaluate(()=>({
  x:document.getElementById('main').getBoundingClientRect().x,
  scrollX,
  widths:[...document.querySelectorAll('[data-slot=breadcrumb] > .path-column')].map(node=>node.getBoundingClientRect().width),
  columns:[...document.querySelectorAll('[data-slot=breadcrumb] > .path-column[data-navigation-column]')].map(node=>({
    path:node.dataset.navigationColumn,href:node.dataset.breadcrumbCollectionHref||'',failed:node.hasAttribute('data-navigation-failed'),
    entries:[...node.querySelectorAll('[data-list-entry]')].map(link=>({href:link.getAttribute('href'),current:link.getAttribute('aria-current')}))
  }))
}));}
function fragmentPath(request){const pathname=new URL(request.url()).pathname;return pathname.startsWith('/site/navigation/')?pathname:'';}
function fragmentLogicalPath(request){return publishedColumns.get(fragmentPath(request))||'';}
function checkResult(result){assert.equal(result.totals.failed,0,JSON.stringify(result.scenarios));}

before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));output=path.join(work,'public');
  const assets=path.join(work,'assets'),content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  write(path.join(content,'products/examples/other/_index.md'),'---\ntitle: Other products\n---\n');
  write(path.join(content,'products/another/_index.md'),'---\ntitle: Another product source\n---\n');
  write(path.join(content,'products/another/_map.toml'),'refs = ["/articles/category1/example"]\n');
  write(path.join(content,'articles/category1/nested/_index.md'),'---\ntitle: Nested category\n---\n');
  for(const [suffix,section,titles] of [['','Another category',['Browser cache and requests','Navigation and sorting']],
    ['.zh','另一分类',['浏览器缓存与请求测试','栏目导航和排序说明']]]){
    write(path.join(content,'articles/navigation-example/_index'+suffix+'.md'),'---\ntitle: '+section+'\n---\n');
    for(const [index,title] of titles.entries())write(path.join(content,'articles/category1/navigation-extra-'+index+'/index'+suffix+'.md'),
      '---\ntitle: '+title+'\nurl: p/navigation-extra-'+index+'/\ndate: 2026-10-01\n---\nNavigation fixture.');
  }
  write(path.join(content,'plain/_index.md'),directoryPage('Plain directory'));
  write(path.join(content,'plain/aggregate/_index.md'),'---\ntitle: Aggregate directory\nlayout: page-collection-directory-all\nparams:\n  aggregate: /articles\n  slots: [breadcrumb]\n---\n');
  write(path.join(content,'plain/names/_index.md'),'---\ntitle: Names\nlayout: page-collection-directory-name-only\nparams:\n  slots: [breadcrumb]\n---\n');
  for(const [name,title] of [['a','Alpha'],['z','Zulu']])write(path.join(content,'plain/names/'+name+'/index.md'),
    '---\ntitle: '+title+'\nurl: p/fragment-mixed-'+name+'/\ndate: 2026-10-01\n---\nMixed-default sorting fixture.');
  write(path.join(content,'plain/readonly/_index.md'),'---\ntitle: Readonly ancestor\nlayout: page-article-norss\nparams:\n  slots: [breadcrumb]\n---\nReadonly ancestor.');
  for(const name of ['a','b'])write(path.join(content,'plain/readonly/'+name+'/index.md'),
    '---\ntitle: Readonly '+name+'\nurl: p/fragment-readonly-'+name+'/\ndate: 2026-10-01\n---\nReadonly article.');
  write(path.join(content,'plain/中文/_index.md'),directoryPage('中文栏目'));
  for(const name of ['a','b'])write(path.join(content,'plain/中文/'+name+'/index.md'),
    '---\ntitle: 中文 '+name+'\nurl: p/fragment-unicode-'+name+'/\ndate: 2026-10-01\n---\nUnicode directory article.');
  write(path.join(content,'articles/category1/fragment-root-only/index.md'),
    '---\ntitle: Root-only article\nurl: p/fragment-root-only/\nparams:\n  slots: []\n---\nRoot navigation without path columns.');
  write(path.join(assets,'site/delivery.toml'),fixtureDelivery(serviceWorkerPolicy('enable')));
  write(config,[['content',content],['content','content'],['assets','assets'],['assets',assets]].map(([target,source])=>
    '[[module.mounts]]\nsource = '+JSON.stringify(source.replaceAll('\\','/'))+'\ntarget = "'+target+'"\n').join('')+fixtureSiteMounts);
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  for(const name of fs.readdirSync(path.join(output,'site/navigation'))){
    assert.match(name,/^[a-f0-9]{64}\.txt$/,'The fixture must publish flat content-addressed HTML fragment files.');
    const payload=readNavigationFragment(fs.readFileSync(path.join(output,'site/navigation',name),'utf8'));
    publishedColumns.set('/site/navigation/'+name,payload.logicalPath);
    publishedHrefs.set('/site/navigation/'+name,payload.href);
  }
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('default path HTML contains prefix resources without routes or sibling rows',()=>{
  const html=fs.readFileSync(path.join(output,article,'index.html'),'utf8');
  const navigation=extractBlocks(html,'nav',tag=>extractTagAttribute(tag,'data-slot')==='breadcrumb');
  assert.equal(navigation.length,1);
  assert.doesNotMatch(navigation[0].html,/\bdata-list-entry\b/,'Path rows must be supplied by HTML fragments.');
  const body=extractStartTags(html,'body')[0];
  const data=JSON.parse(extractTagAttribute(body,'data-navigation')),segments=data.default.split('/').filter(Boolean);
  assert.ok(segments.length>=2);assert.ok(Object.values(data.columns).every(hash=>/^[a-f0-9]{64}$/.test(hash)));
  assert.equal(data.home,'/');assert.equal(data.resources,'/site/navigation/');
  for(const key of ['routes','from','paths'])assert.equal(data[key],undefined);
  assert.equal(extractTagAttribute(body,'data-default-breadcrumb-columns'),'');
  assert.ok(extractStartTags(html,'a').some(tag=>extractTagAttribute(tag,'data-root-href')),'Root navigation remains in HTML.');
  assert.ok(extractBlocks(html,'main')[0].inner.trim(),'The article remains in HTML.');
  const inline=text=>[...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([,attrs])=>!extractTagAttribute(attrs,'src')).map(([,attrs,code])=>code);
  const startup=inline(html).filter(code=>code.includes('defaultRootHref'));
  assert.equal(startup.length,1,'Path pages must have one root-selection startup.');
  assert.ok(startup[0].includes('page-column path-column'),'Root selection and path reservation must share the same startup bundle.');
  const rootOnly=fs.readFileSync(path.join(output,'p/fragment-root-only/index.html'),'utf8');
  assert.equal(inline(rootOnly).filter(code=>code.includes('defaultRootHref')).length,1,'Root-only pages still need early source selection.');
  assert.ok(inline(rootOnly).every(code=>!code.includes('page-column path-column')),'Disabled breadcrumb must not include path reservation code.');
  assert.ok(extractStartTags(rootOnly,'script').every(tag=>!extractTagAttribute(tag,'src').includes('/browse/path-entry.')),
    'Disabled breadcrumb must not load the path controller.');
});

test('external navigation handles slow, stale, failed and offline column requests',{timeout:120000},async()=>{
  const scenarios=[{id:'default-columns-load-from-fragments',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[],responses=[];
    page.on('response',response=>{if(fragmentPath(response.request()))responses.push(response.headers()['content-type']);});
    await page.route('**/site/navigation/**',async route=>{requests.push(fragmentPath(route.request()));assert.ok(!route.request().headers().accept?.includes('text/html'),'Fragments must remain asset requests in the service worker.');await gate;await route.continue();});
    try{
      await page.goto(baseUrl+article,{waitUntil:'domcontentloaded'});
      const expected=await defaultData(page);assert.ok(expected.hrefs.length>=2);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-entry-breadcrumb-pending'));
      await page.evaluate(()=>{window.reservedDefaultColumns=[...document.querySelector('[data-slot=breadcrumb]').children];});
      await afterPaint(page);const held=await snapshot(page);
      assert.equal(await page.locator('[data-slot=breadcrumb] [data-list-entry]').count(),0,
        'Default path rows must not be embedded in HTML or rendered before their fragments loads.');
      assert.equal(held.widths.length,expected.hrefs.length);
      assert.ok(await page.locator('[data-root-navigation] a').count());
      assert.ok(await page.locator('main').isVisible());
      release();await waitForBrowse(page);await afterPaint(page);const ready=await snapshot(page);
      assert.equal(ready.x,held.x);assert.equal(ready.scrollX,held.scrollX);assert.deepEqual(ready.widths,held.widths);
      assert.equal(await page.evaluate(()=>window.reservedDefaultColumns.every((node,index)=>
        node===document.querySelector('[data-slot=breadcrumb]').children[index])),true);
      assert.deepEqual([...requests].sort(),expected.urls.sort(),'Default paths must load only their own HTML columns, once each.');
      assert.deepEqual(ready.columns.map(column=>column.href),expected.hrefs);
      assert.ok(ready.columns.some(column=>column.entries.length>1),'Loaded HTML must supply the siblings absent from HTML.');
      assert.equal(responses.length,expected.urls.length);assert.ok(responses.every(type=>type.startsWith('text/plain')),'The browser must parse HTML fragments served as plain text.');
      return {columns:expected.urls.length};
    }finally{release();}
  }},{id:'default-column-failures-keep-reserved-containers',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;});
    await page.route('**/site/navigation/**',async route=>{await gate;return route.fulfill({status:404,contentType:'text/plain',body:'{}'});});
    let held;
    try{
      await page.goto(baseUrl+article,{waitUntil:'domcontentloaded'});await afterPaint(page);held=await snapshot(page);
      await page.evaluate(()=>{window.reservedFailedColumns=[...document.querySelector('[data-slot=breadcrumb]').children];});
    }finally{release();}
    await waitForBrowse(page);await afterPaint(page);
    const expected=await defaultData(page),failed=await snapshot(page);
    assert.deepEqual(failed.columns.map(column=>column.path),expected.paths);
    assert.equal(failed.widths.length,expected.paths.length);assert.ok(failed.widths.every(width=>width>0));
    assert.equal(failed.x,held.x);assert.equal(failed.scrollX,held.scrollX);assert.deepEqual(failed.widths,held.widths);
    assert.equal(await page.evaluate(()=>window.reservedFailedColumns.every((node,index)=>
      node===document.querySelector('[data-slot=breadcrumb]').children[index])),true);
    assert.equal(await page.locator('[data-slot=breadcrumb]').getAttribute('aria-hidden'),null);
    const columns=await page.locator('[data-slot=breadcrumb] > .path-column').evaluateAll(columns=>columns.map(column=>({
      links:column.querySelectorAll('a').length,text:column.textContent.trim(),
      failed:column.hasAttribute('data-navigation-failed')
    })));
    for(const column of columns){
      assert.equal(column.links,0);assert.equal(column.failed,true);assert.ok(column.text.includes(expected.error));
    }
    assert.ok(await page.locator('[data-root-navigation] a').count());assert.ok(await page.locator('main').isVisible());
    const response=await page.request.get(baseUrl+expected.hrefs[0]);assert.ok(response.ok(),'Collection HTML remains available independently of its fragment.');
    return {columns:columns.length};
  }},{id:'readonly-column-retry-on-sort-state',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let failing=true,attempts=0;
    await page.route('**/site/navigation/**',async route=>{
      if(fragmentLogicalPath(route.request())==='/plain/readonly/'){
        attempts++;
        if(failing)return route.fulfill({status:404,contentType:'text/plain',body:'{}'});
      }
      await route.continue();
    });
    await page.goto(baseUrl+'/p/fragment-readonly-a/',{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const column=page.locator('.path-column[data-navigation-column="/plain/readonly/"]');
    assert.equal(await column.locator('[data-list-entry]').count(),0);
    assert.notEqual(await column.getAttribute('data-navigation-failed'),null);
    assert.equal(await column.locator('[data-collection-sort-toggle]').count(),0,'The ancestor must not expose a sort toggle.');
    failing=false;
    await page.evaluate(()=>{location.hash='sorts=name-desc';});
    await page.waitForFunction(()=>document.querySelector('.path-column[data-navigation-column="/plain/readonly/"]')
      &&!document.querySelector('.path-column[data-navigation-column="/plain/readonly/"]').hasAttribute('data-navigation-failed'));
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(await column.locator('[data-list-entry]').count(),2,'A non-sortable column must also restore its complete rows after retry.');
    assert.equal(await column.locator('[data-collection-sort-toggle]').count(),0);
    assert.equal(attempts,2,'The sort-state change must retry the failed column once.');
    return {attempts,entries:2};
  }},{id:'unicode-default-columns-load-fragments',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    const requests=[],responses=[];page.on('request',request=>{const pathname=fragmentPath(request);if(pathname)requests.push(pathname);});
    page.on('response',response=>{const pathname=fragmentPath(response.request());if(pathname)responses.push({path:pathname,status:response.status()});});
    await page.goto(baseUrl+'/p/fragment-unicode-a/',{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const expected=await defaultData(page),href=expected.hrefs.at(-1);
    const column=page.locator('[data-breadcrumb-collection-href='+JSON.stringify(href)+']');
    const metadata=await page.evaluate(()=>JSON.parse(document.body.dataset.navigation));
    const resources=expected.urls.map(url=>({url,logicalPath:publishedColumns.get(url),
      exists:fs.existsSync(path.join(output,url.slice(1)))}));
    assert.equal(await column.locator('[data-list-entry]').count(),2,
      'A real Unicode directory must load both HTML entries. '+JSON.stringify({requests,responses,metadata,resources}));
    assert.equal(await column.getAttribute('data-navigation-failed'),null);
    assert.deepEqual([...requests].sort(),expected.urls.sort(),'Unicode logical paths must resolve the published fragment URL.');
    assert.equal(await column.locator('[aria-current=page]').count(),1);
    return {href,requests:requests.length};
  }},...['/products/examples/','/products/'].map(delayed=>({
    id:delayed===slowSource?'slow-terminal-keeps-first-column-visible':'slow-ancestor-keeps-last-column-visible',
    kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[];
    await page.route('**/site/navigation/**',async route=>{
      requests.push(fragmentPath(route.request()));
      if(fragmentLogicalPath(route.request())===delayed)await gate;
      await route.continue();
    });
    try{
      await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'domcontentloaded'});
      const expected=await sourceData(page,slowSource);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-entry-breadcrumb-pending'));
      const firstReady=expected.paths.find(key=>key!==delayed);
      await page.waitForFunction(key=>{
        const column=document.querySelector('.path-column[data-navigation-column="'+key+'"]');
        return column?.querySelector('[data-list-entry]')&&getComputedStyle(column).opacity==='1'
          &&getComputedStyle(column).pointerEvents!=='none';
      },firstReady);
      await afterPaint(page);const held=await snapshot(page);
      assert.ok(await page.locator('main').isVisible(),'The article must remain visible while columns load.');
      assert.equal(held.widths.length,expected.hrefs.length,'All path columns must be reserved before fragments arrive.');
      assert.equal(await page.locator('[data-slot=breadcrumb] > .path-column').nth(expected.paths.indexOf(delayed))
        .locator('[data-list-entry]').count(),0,'Only the unfinished column may remain empty.');
      assert.equal(await page.locator('[data-slot=breadcrumb]').getAttribute('aria-hidden'),null);
      const visible=page.locator('.path-column[data-navigation-column="'+firstReady+'"]');
      const fields=new URLSearchParams(new URL(await visible.locator('[data-collection-sort-toggle]').getAttribute('href'),baseUrl).hash.slice(1));
      assert.equal(fields.get('from'),'products/examples');
      assert.equal(fields.get('sorts').split(',').length,2,'An early header must already use the complete source lineage.');
      await visible.evaluate(column=>{window.earlyColumnList=column.firstElementChild;});
      await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]+'&sorts=name-desc,name-desc');
      await page.waitForFunction(key=>document.querySelector('.path-column[data-navigation-column="'+key+'"] [data-sort-indicator]')?.textContent==='↓',firstReady);
      release();await waitForBrowse(page);await afterPaint(page);
      const ready=await snapshot(page);
      assert.equal(ready.x,held.x,'Filling columns must keep the article at its reserved position.');
      assert.equal(ready.scrollX,held.scrollX);assert.deepEqual(ready.widths,held.widths);
      assert.deepEqual([...requests].sort(),expected.urls.sort(),'Only the selected source columns must load, once each.');
      assert.deepEqual(ready.columns.map(column=>column.href),expected.hrefs);
      assert.equal(await visible.evaluate(column=>column.firstElementChild===window.earlyColumnList),true,
        'Completing or sorting another column must preserve the already visible list.');
      assert.deepEqual(await page.locator('[data-slot=breadcrumb] [data-sort-indicator]').allTextContents(),['↓','↓'],
        'A late column must render the current sort state, not the state when its request started.');
      return {columns:expected.urls.length,firstReady,delayed};
    }finally{release();}
  }})),{id:'source-race-and-cache',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[];
    await page.route('**/site/navigation/**',async route=>{
      const pathname=fragmentPath(route.request());requests.push(pathname);
      if(fragmentLogicalPath(route.request()).startsWith('/products/'))await gate;
      await route.continue();
    });
    try{
      await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'domcontentloaded'});
      const slow=await sourceData(page,slowSource),fast=await sourceData(page,fastSource);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-entry-breadcrumb-pending'));
      await page.evaluate(hash=>{location.hash=hash;},routeFor(fastSource).split('#')[1]);
      await waitForBrowse(page);
      assert.deepEqual((await snapshot(page)).columns.map(column=>column.href),fast.hrefs);
      const finished=page.waitForResponse(response=>new URL(response.url()).pathname===slow.urls.at(-1));
      release();await finished;
      await afterPaint(page);
      assert.deepEqual((await snapshot(page)).columns.map(column=>column.href),fast.hrefs,'An older response must not replace the new source.');
      await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]);
      await waitForBrowse(page);await afterPaint(page);
      assert.deepEqual((await snapshot(page)).columns.map(column=>column.href),slow.hrefs);
      for(const url of new Set([...slow.urls,...fast.urls]))assert.equal(requests.filter(value=>value===url).length,1,
        'A shared or previously loaded column must reuse the same request.');
      return {requests:requests.length};
    }finally{release();}
  }},{id:'shared-ancestor-updates-selection',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    const next='/products/another/',requests=[];
    let release;const gate=new Promise(resolve=>{release=resolve;});
    await page.route('**/site/navigation/**',async route=>{
      requests.push(fragmentPath(route.request()));
      if(fragmentLogicalPath(route.request())===next)await gate;
      await route.continue();
    });
    try{
      await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'load'});await waitForBrowse(page);
      const ancestor=page.locator('.path-column[data-navigation-column="/products/"]');
      await ancestor.locator('[data-collection-sort-toggle]').focus();
      await ancestor.evaluate(node=>{window.sharedList=node.firstElementChild;window.sharedFocus=document.activeElement;});
      const held=await snapshot(page);
      await page.evaluate(hash=>{location.hash=hash;},routeFor(next).split('#')[1]);
      await page.waitForFunction(path=>{
        const link=document.querySelector('.path-column[data-navigation-column="/products/"] [aria-current=page]');
        return link&&new URL(link.href).pathname===path;
      },next);
      assert.equal(await ancestor.locator('[aria-current=page]').count(),1);
      assert.equal(await ancestor.locator('[data-list-entry].is-current').count(),1);
      assert.equal(await ancestor.evaluate(node=>node.firstElementChild===window.sharedList&&document.activeElement===window.sharedFocus),true);
      const header=new URL(await ancestor.locator('[data-collection-sort-toggle]').getAttribute('href'),baseUrl);
      assert.equal(new URLSearchParams(header.hash.slice(1)).get('from'),'products/another',
        'The preserved ancestor header must follow the new lineage before its terminal arrives.');
      assert.equal(await page.locator('[data-slot=breadcrumb] > .path-column').last().locator('[data-list-entry]').count(),0);
      release();await waitForBrowse(page);await afterPaint(page);
      const ready=await snapshot(page);
      assert.deepEqual(ready.columns.map(column=>column.path),['/products/',next]);
      assert.equal(ready.x,held.x);assert.equal(ready.scrollX,held.scrollX);assert.deepEqual(ready.widths,held.widths);
      assert.equal(await ancestor.evaluate(node=>node.firstElementChild===window.sharedList&&document.activeElement===window.sharedFocus),true);
      assert.equal(ready.columns.at(-1).entries.filter(entry=>entry.current==='page').length,1);
      await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]);await waitForBrowse(page);
      await page.waitForFunction(path=>{
        const link=document.querySelector('.path-column[data-navigation-column="/products/"] [aria-current=page]');
        return link&&new URL(link.href).pathname===path;
      },slowSource);
      assert.equal(new URL(await ancestor.locator('[aria-current=page]').getAttribute('href'),baseUrl).pathname,slowSource);
      assert.equal(await ancestor.evaluate(node=>node.firstElementChild===window.sharedList),true);
      assert.equal(requests.length,3,'The two routes must share one ancestor request and reuse it on return.');
      return {requests:requests.length,from:slowSource,to:next};
    }finally{release();}
  }},{id:'default-path-after-source-change',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    const sorts='sorts=name-asc,name-asc';
    await page.goto(baseUrl+article+'#'+sorts,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-slot=breadcrumb] [data-sort-indicator]')]
      .every(node=>node.textContent==='↑'));
    const expected=(await snapshot(page)).columns;
    assert.ok(expected.length>0,'The fixture needs a default directory path.');
    for(const hash of [sorts,'from=missing&'+sorts,'from=articles&'+sorts]){
      await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]);await waitForBrowse(page);
      await page.evaluate(hash=>{location.hash=hash;},hash);await waitForBrowse(page);await afterPaint(page);
      assert.deepEqual((await snapshot(page)).columns,expected,
        'Clearing or invalidating the source must restore the sorted default rows and their link state.');
    }
    return {columns:expected.length};
  }}];
  scenarios.push({id:'missing-terminal-skips-candidate-request',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    const requests=[];page.on('request',request=>{const pathname=fragmentPath(request);if(pathname)requests.push(pathname);});
    await page.goto(baseUrl+article+'?keep=%2F+value#anchor=reading&from=missing&sorts=name-asc,name-asc',{waitUntil:'load'});
    await waitForBrowse(page);await afterPaint(page);
    const expected=await defaultData(page),url=new URL(page.url()),fields=new URLSearchParams(url.hash.slice(1));
    assert.deepEqual((await snapshot(page)).columns.map(column=>column.path),expected.paths);
    assert.deepEqual(requests.sort(),expected.urls.sort(),'An unknown terminal must request only the default prefixes.');
    assert.equal(fields.has('from'),false,'An unknown source must be removed without changing the remaining URL state.');
    assert.equal(url.search,'?keep=%2F+value');assert.equal(fields.get('anchor'),'reading');assert.equal(fields.get('sorts'),'name-asc,name-asc');
    return {requests:requests.length};
  }},{id:'existing-ancestor-validates-before-default',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[];
    await page.route('**/site/navigation/**',async route=>{
      requests.push(fragmentPath(route.request()));
      if(fragmentLogicalPath(route.request())==='/products/')await gate;
      await route.continue();
    });
    try{
      await page.goto(baseUrl+article+'?keep=%2F+value#anchor=reading&from=products&sorts=name-asc,name-asc',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-entry-breadcrumb-pending'));
      await afterPaint(page);
      const candidate=await sourceData(page,'/products/');
      assert.deepEqual(requests,candidate.urls,'An existing terminal must be checked before its candidate is rejected.');
      assert.equal((await snapshot(page)).widths.length,1,'The candidate may reserve its own prefix count before validation.');
      assert.equal(await page.locator('[data-root-navigation] .is-current').getAttribute('data-root-href'),'/products/');
      release();await waitForBrowse(page);await afterPaint(page);
      const expected=await defaultData(page),ready=await snapshot(page),url=new URL(page.url()),fields=new URLSearchParams(url.hash.slice(1));
      assert.deepEqual(ready.columns.map(column=>column.path),expected.paths);
      assert.equal(ready.widths.length,expected.paths.length,'An invalid ancestor must restore the default prefix count.');
      assert.ok(ready.columns.every(column=>!column.failed));
      assert.deepEqual(requests.sort(),[...new Set([...candidate.urls,...expected.urls])].sort(),'An invalid existing candidate must then load only the default prefixes.');
      assert.equal(await page.locator('[data-root-navigation] .is-current').getAttribute('data-root-href'),'/articles/');
      assert.equal(fields.has('from'),false,'A checked source without the current article must be removed.');
      assert.equal(url.search,'?keep=%2F+value');assert.equal(fields.get('anchor'),'reading');assert.equal(fields.get('sorts'),'name-asc,name-asc');
      return {candidate:candidate.paths,default:expected.paths};
    }finally{release();}
  }},{id:'collection-sorting-keeps-source-free-urls',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    const requests=[];page.on('request',request=>{const pathname=fragmentPath(request);if(pathname)requests.push(pathname);});
    for(const [collection,parent,articleSource] of [['/articles/category1/','/articles/',null],['/plain/aggregate/','/plain/','plain/aggregate']]){
      for(const hash of ['','#from='+collection.slice(1,-1)]){
        await page.goto('about:blank');
        requests.length=0;
        await page.goto(baseUrl+collection+hash,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
        assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).has('from'),false,'Collections must use their own path without from.');
        const expected=await defaultData(page);
        assert.deepEqual((await snapshot(page)).columns.map(column=>column.path),expected.paths);
        const warm=await page.locator('head link[rel=prefetch]').getAttribute('href');
        assert.deepEqual(requests.filter(url=>url!==warm).sort(),expected.urls.sort());
        assert.ok(requests.filter(url=>url===warm).length<=1,'The current collection may only prefetch its shared fragment once.');
        const initialRequests=[...requests].sort();
        assert.ok(await page.locator('main [data-list-entry]').count());
        const toggle=page.locator('.path-column[data-navigation-column="'+parent+'"] [data-collection-sort-toggle]');
        assert.equal(new URLSearchParams(new URL(await toggle.getAttribute('href'),baseUrl).hash.slice(1)).has('from'),false,'Native sort links must not add from.');
        const initial=await toggle.locator('[data-sort-indicator]').textContent();
        await toggle.focus();await toggle.press('Enter');
        await page.waitForFunction(({parent,before})=>document.querySelector('.path-column[data-navigation-column="'+parent+'"] [data-sort-indicator]')?.textContent!==before,{parent,before:initial});
        const fields=new URLSearchParams(new URL(page.url()).hash.slice(1)),tokens=(fields.get('sorts')||'').split(',');
        const slots=[...Array(Math.max(0,2-tokens.length)).fill('_'),...tokens];
        assert.equal(fields.has('from'),false,'Sorting a parent must retain the current collection lineage without from.');
        assert.equal(slots[0],initial==='↓'?'date-asc':'date-desc','The parent sort must occupy its own lineage slot.');
        assert.ok(slots[1]==='_'||slots[1]==='date-desc','The current main collection must retain its default order.');
        assert.equal(await page.locator('main [data-sort-active="true"] [data-sort-indicator]').textContent(),'↓');
        const links=await page.locator('main [data-kind="page"] [data-list-entry]').evaluateAll(nodes=>nodes.map(node=>node.href));
        assert.ok(links.length>0,'Each collection must contain an article.');
        for(const href of links)assert.equal(new URLSearchParams(new URL(href).hash.slice(1)).get('from'),articleSource,'Article links must retain only their required source.');
        assert.deepEqual(requests.sort(),initialRequests,'Sorting a parent must not add fragment requests.');
        await toggle.press('Enter');await afterPaint(page);
        assert.equal(new URL(page.url()).hash,'','Returning to default sorting must leave a clean collection URL.');
      }
    }
    for(const collection of ['/plain/','/articles-all/']){
      await page.goto(baseUrl+collection+'#from='+collection.slice(1,-1),{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
      assert.equal(await page.locator('[data-slot=breadcrumb]').count(),0,'Root collections must also cover sorting without path columns.');
      assert.equal(new URL(page.url()).hash,'','Collections without path columns must remove redundant from.');
      const control=page.locator('main [data-sort-active="true"]');
      assert.equal(new URLSearchParams(new URL(await control.getAttribute('href'),baseUrl).hash.slice(1)).has('from'),false);
      await control.click();await afterPaint(page);
      assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).has('from'),false,'Main sorting must not retain a redundant collection source.');
    }
    await page.goto(baseUrl+'/articles/category1/nested/#from=articles&sorts=date-asc,_,_',{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const expected=await defaultData(page);
    assert.equal(expected.paths.length,2,'The nested collection must have two ancestor columns.');
    assert.deepEqual((await snapshot(page)).columns.map(column=>column.path),expected.paths,'An ancestor from must not shorten the collection path.');
    assert.equal(new URL(page.url()).hash,'#sorts=date-asc,_,_','Removing an ancestor from must retain the full sort lineage.');
    for(const href of await page.locator('[data-collection-sort-toggle]').evaluateAll(nodes=>nodes.map(node=>node.href))){
      assert.equal(new URLSearchParams(new URL(href).hash.slice(1)).has('from'),false,'Late fragment rendering must not restore a collection source.');
    }
    return {requests:requests.length};
  }},{id:'root-only-source-selection-needs-no-fragments',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[];
    page.on('request',request=>{const pathname=fragmentPath(request);if(pathname)requests.push(pathname);});
    await page.route('**/*',async route=>{if(route.request().resourceType()==='script')await gate;await route.continue();});
    try{
      await page.goto(baseUrl+'/p/fragment-root-only/#from=articles-all',{waitUntil:'commit'});
      await page.waitForFunction(()=>document.querySelector('[data-root-navigation] .is-current')?.dataset.rootHref==='/articles-all/');
      const data=await page.evaluate(()=>JSON.parse(document.body.dataset.navigation));
      assert.equal(data.default,'');assert.ok(data.columns['/articles-all/']);
      assert.equal(data.columns['/articles/'],undefined,'Root-only pages need only their direct candidate hashes.');
      assert.equal(await page.locator('[data-slot=breadcrumb]').count(),0);assert.deepEqual(requests,[]);
      release();await page.waitForLoadState('load');await waitForBrowse(page);
      assert.deepEqual(requests,[],'Deferred root selection must also avoid navigation fragment requests.');
      assert.equal(await page.locator('[data-root-navigation] .is-current').getAttribute('data-root-href'),'/articles-all/');
      return {requests:0};
    }finally{release();}
  }});
  scenarios.push({id:'hash-retry-respects-newer-state',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release,retrying;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{retrying=resolve;});
    let attempts=0;
    await page.route('**/site/navigation/**',async route=>{
      if(fragmentLogicalPath(route.request())===slowSource){
        attempts++;
        if(attempts===1)return route.fulfill({status:404,contentType:'text/plain',body:'{}'});
        retrying();await gate;
      }
      await route.continue();
    });
    try{
      await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'load'});await waitForBrowse(page);
      const column=page.locator('.path-column[data-navigation-column="'+slowSource+'"]'),failed=await snapshot(page);
      assert.ok(await column.getAttribute('data-navigation-failed')!==null);
      assert.equal(await column.locator('[data-collection-sort-toggle]').count(),0);
      await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]+'&sorts=name-asc,name-asc');
      await started;
      const hash=routeFor(slowSource).split('#')[1]+'&sorts=name-asc,name-desc';
      await page.evaluate(hash=>{location.hash=hash;},hash);
      const latest=page.url(),finished=page.waitForResponse(response=>fragmentLogicalPath(response.request())===slowSource);
      release();await finished;await waitForBrowse(page);await afterPaint(page);
      assert.equal(page.url(),latest,'An older retry must not replace a newer URL state after its request completes.');
      assert.equal(await column.locator('[data-sort-indicator]').textContent(),'↓','The latest sort direction must win.');
      assert.equal(await column.locator('[data-list-entry]').count(),2,'The latest state must also restore complete column rows.');
      const ready=await snapshot(page);assert.equal(ready.x,failed.x);assert.deepEqual(ready.widths,failed.widths);
      assert.equal(attempts,2,'The state change must reuse the pending retry.');
      return {attempts,hash};
    }finally{release();}
  }});
  for(const fault of ['404','malformed','nested-item'])scenarios.push({id:'column-'+fault+'-recovers',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let failing=true;const requests=[];
    await page.route('**/site/navigation/**',async route=>{
      const pathname=fragmentPath(route.request());requests.push(pathname);
      if(failing&&fragmentLogicalPath(route.request())===slowSource){
        let body=fault==='404'?'{}':'{broken';
        if(fault==='nested-item'){
          const valid=fs.readFileSync(path.join(output,pathname.slice(1)),'utf8');
          body=valid.replace(/(<a\b[^>]*\bdata-list-entry\b[^>]*>)/,'$1<div data-list-item>Extra marker</div>');
          assert.notEqual(body,valid,'The fault must insert a nested item marker.');
        }
        return route.fulfill({status:fault==='404'?404:200,contentType:'text/plain',body});
      }
      await route.continue();
    });
    await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const expected=await sourceData(page,slowSource),failed=await snapshot(page);
    assert.deepEqual(failed.columns.map(column=>column.path),expected.paths,'Failures must keep every reserved column.');
    assert.ok(failed.widths.every(width=>width>0));
    assert.equal(await page.locator('[data-slot=breadcrumb]').getAttribute('aria-hidden'),null);
    failing=false;
    const column=page.locator('.path-column[data-navigation-column="'+slowSource+'"]');
    assert.equal(await column.locator('[data-list-entry]').count(),0,'A failed column must not invent a selected article.');
    assert.equal(await column.locator('[data-collection-sort-toggle]').count(),0);
    assert.ok((await column.textContent()).includes(expected.error));
    await column.evaluate(node=>{window.failedNavigationColumn=node;});
    const successful=page.locator('.path-column[data-navigation-column="/products/"]');
    await successful.locator('[data-collection-sort-toggle]').focus();
    await successful.evaluate(node=>{
      window.successfulColumnList=node.firstElementChild;
      window.successfulColumnFocus=document.activeElement;
    });
    await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]+'&sorts=name-asc,name-desc');
    await page.waitForFunction(source=>document.querySelector('.path-column[data-navigation-column="'+source+'"]')
      &&!document.querySelector('.path-column[data-navigation-column="'+source+'"]')?.hasAttribute('data-navigation-failed'),slowSource);
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(await column.locator('[data-list-entry]').count(),2,'A hash change must retry and restore the full column.');
    assert.equal(await column.evaluate(node=>node===window.failedNavigationColumn),true);
    assert.equal(await successful.evaluate(node=>node.firstElementChild===window.successfulColumnList
      &&document.activeElement===window.successfulColumnFocus),true,'Retrying a failed column must keep the successful list and its focus.');
    const ready=await snapshot(page);assert.equal(ready.x,failed.x);assert.deepEqual(ready.widths,failed.widths);
    await column.locator('[data-collection-sort-toggle]').focus();
    await column.locator('[data-collection-sort-toggle]').press('Enter');
    assert.equal(await column.locator('[data-collection-sort-toggle]').evaluate(node=>node===document.activeElement),true,
      'Sorting after recovery must keep keyboard focus.');
    await page.evaluate(hash=>{location.hash=hash;},routeFor(fastSource).split('#')[1]);await waitForBrowse(page);
    await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]);await waitForBrowse(page);await afterPaint(page);
    assert.deepEqual((await snapshot(page)).columns.map(column=>column.href),expected.hrefs);
    const retried=expected.urls.find(value=>publishedColumns.get(value)===slowSource);
    assert.ok(retried,'The selected column must resolve through its published payload, not its filename.');
    assert.equal(requests.filter(value=>value===retried).length,2,'Failed fragments must be retried when the source is selected again.');
    for(const url of expected.urls.filter(value=>value!==retried))assert.equal(requests.filter(value=>value===url).length,1);
    return {fault,retried};
  }});
  scenarios.push({id:'default-links-and-sort-toggles-stay-clean',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    await page.goto(baseUrl+'/articles/category1/#sorts=_,name-asc',{waitUntil:'load'});
    await waitForBrowse(page);
    const links=await page.locator('main [data-list-entry]').evaluateAll(nodes=>nodes.map(link=>({
      kind:link.parentElement.dataset.kind,href:link.href
    })));
    const entry=new URL(links.find(link=>new URL(link.href).pathname==='/p/example-product/').href);
    const child=new URL(links.find(link=>link.kind==='section').href);
    assert.equal(new URLSearchParams(entry.hash.slice(1)).get('from'),null);
    assert.equal(new URLSearchParams(entry.hash.slice(1)).get('sorts'),'_,name-asc');
    assert.equal(new URLSearchParams(child.hash.slice(1)).get('sorts'),'_,name-asc,name-asc');
    await page.goto(baseUrl+article+'?keep=1#anchor=reading',{waitUntil:'load'});await waitForBrowse(page);
    const selected=page.locator('[data-slot=breadcrumb] [aria-current=page]').last();
    assert.equal(new URLSearchParams(new URL(await selected.getAttribute('href'),baseUrl).hash.slice(1)).get('from'),null);
    const toggle=page.locator('[data-slot=breadcrumb] [data-collection-sort-toggle]').first();
    await toggle.click();await waitForBrowse(page);
    const sorted=new URL(page.url()),fields=new URLSearchParams(sorted.hash.slice(1));
    assert.equal(fields.get('from'),null,'Default column sorting must not add from.');
    assert.equal(fields.get('sorts'),'date-asc,_');
    assert.equal(fields.get('anchor'),'reading');assert.equal(sorted.search,'?keep=1');
    return {articleSorts:entry.hash,childSorts:child.hash,sorted:sorted.hash};
  }});
  scenarios.push({id:'mixed-defaults-and-native-sort-links',kind:'single',serviceWorkers:'block',async run({page,context,baseUrl}){
    const collection='/plain/names/';
    await page.goto(baseUrl+collection,{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const parent=page.locator('[data-slot=breadcrumb] > [data-navigation-column="/plain/"]');
    const parentToggle=parent.locator('[data-collection-sort-toggle]'),main=page.locator('main [data-sort-field=name]');
    assert.equal(await parent.locator('[data-sort-indicator]').textContent(),'↓','The directory parent defaults to descending dates.');
    assert.equal(await main.locator('[data-sort-indicator]').textContent(),'↑','The name-only main list has a different default.');
    const initialOrder=await page.locator('main [data-list-entry]').evaluateAll(nodes=>nodes.map(node=>new URL(node.href).pathname));
    const source=page.url();
    await main.click();await afterPaint(page);
    assert.equal(new URL(page.url()).hash,'#sorts=_,name-desc');
    assert.deepEqual(await page.locator('main [data-list-entry]').evaluateAll(nodes=>nodes.map(node=>new URL(node.href).pathname)),initialOrder.slice().reverse());
    const toggleHref=await parentToggle.getAttribute('href');
    assert.equal(new URLSearchParams(new URL(toggleHref,baseUrl).hash.slice(1)).get('sorts'),'date-asc,name-desc',
      'The native parent link must include the latest main sort.');
    const extra=await context.newPage();
    try{
      await extra.goto(new URL(toggleHref,baseUrl).href,{waitUntil:'load'});await waitForBrowse(extra);await afterPaint(extra);
      assert.equal(await extra.locator('[data-slot=breadcrumb] > [data-navigation-column="/plain/"] [data-sort-indicator]').textContent(),'↑');
      assert.equal(await extra.locator('main [data-sort-field=name] [data-sort-indicator]').textContent(),'↓');
      assert.equal(new URL(page.url()).hash,'#sorts=_,name-desc','Opening the native link must leave its opener unchanged.');
    }finally{await extra.close();}
    await parentToggle.click();await afterPaint(page);
    assert.equal(new URL(page.url()).hash,'#sorts=date-asc,name-desc');
    const labelHref=await parent.locator('.path-column-label').getAttribute('href');
    assert.equal(new URL(labelHref,baseUrl).pathname,'/plain/');
    assert.equal(new URL(labelHref,baseUrl).hash,'#sorts=date-asc','Returning to an ancestor must truncate the main slot.');
    const labelPage=await context.newPage();
    try{
      await labelPage.goto(new URL(labelHref,baseUrl).href,{waitUntil:'load'});await waitForBrowse(labelPage);await afterPaint(labelPage);
      assert.equal(await labelPage.locator('main [data-sort-active=true]').getAttribute('data-sort-field'),'date');
      assert.equal(await labelPage.locator('main [data-sort-active=true] [data-sort-indicator]').textContent(),'↑');
    }finally{await labelPage.close();}
    const articleHref=await page.locator('main [data-list-entry]').first().getAttribute('href');
    assert.equal(new URLSearchParams(new URL(articleHref,baseUrl).hash.slice(1)).get('sorts'),'date-asc,name-desc');
    assert.equal(new URLSearchParams(new URL(articleHref,baseUrl).hash.slice(1)).has('sort'),false);
    await main.click();await afterPaint(page);
    assert.equal(new URL(page.url()).hash,'#sorts=date-asc,_','Restoring the main default must keep the parent sort.');
    await parentToggle.click();await afterPaint(page);
    assert.equal(page.url(),source,'Restoring both defaults must remove sorts.');
    await page.goto(baseUrl+collection+'#sorts=name-asc,_',{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    await main.click();await afterPaint(page);await main.click();await afterPaint(page);
    assert.equal(new URL(page.url()).hash,'#sorts=name-asc,_','A main default must not erase the same token used as a non-default parent sort.');
    const links=await page.locator('main [data-list-entry]').evaluateAll(nodes=>nodes.map(node=>node.href));
    for(const href of links)assert.equal(new URLSearchParams(new URL(href).hash.slice(1)).get('sorts'),'name-asc,_');
    return {toggleHref,labelHref,articleHref};
  }});
  for(const worker of [false,true])scenarios.push({id:'native-column-prefetch-'+(worker?'sw':'http'),kind:'single',serviceWorkers:worker?'allow':'block',async run({page,baseUrl}){
    if(worker){await page.goto(baseUrl+'/',{waitUntil:'load'});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));}
    const warmed=page.waitForResponse(response=>fragmentLogicalPath(response.request())==='/articles/category1/');
    await page.goto(baseUrl+'/articles/category1/',{waitUntil:'load'});await waitForBrowse(page);
    const response=await warmed;assert.ok(response.ok());await response.finished();await afterPaint(page);
    assert.equal(await page.locator('head link[rel=prefetch][href='+JSON.stringify(new URL(response.url()).pathname)+']').count(),1);
    await page.locator('main [data-list-entry][href='+JSON.stringify(article)+']').click();
    await page.waitForURL(baseUrl+article);await waitForBrowse(page);
    const timing=await page.evaluate(url=>{
      const entry=performance.getEntriesByType('resource').find(item=>item.name===url);
      return entry?{transferSize:entry.transferSize,decodedBodySize:entry.decodedBodySize}:null;
    },response.url());
    assert.ok(timing?.decodedBodySize>0,'The article must consume the warmed fragment.');
    assert.equal(timing.transferSize,0,'The warmed fragment must not be downloaded again.');
    return {worker,...timing};
  }});
  for(const worker of [false,true])for(const source of ['/articles-all/','/products/'])scenarios.push({
    id:'cold-column-runtime-prefetch-'+(source==='/products/'?'products':'all')+'-'+(worker?'sw':'http'),
    kind:'single',serviceWorkers:worker?'allow':'block',async run({page,context,baseUrl}){
    const runtimeReady=page.waitForResponse(response=>new URL(response.url()).pathname.includes('/browse/path-entry.'));
    const columnReady=page.waitForResponse(response=>fragmentLogicalPath(response.request())===source);
    await page.goto(baseUrl+source,{waitUntil:'load'});await waitForBrowse(page);
    const warmed=await Promise.all([runtimeReady,columnReady]);
    for(const response of warmed){assert.ok(response.ok());await response.finished();}
    const urls=warmed.map(response=>response.url()),runtime=urls[0];
    assert.equal(await page.locator('.path-column').count(),0,'The first page must not already need the path controller.');
    assert.equal(await page.locator('script[src]').evaluateAll((nodes,runtime)=>nodes.filter(node=>node.src===runtime).length,runtime),0,
      'The first collection must only prefetch the runtime, without executing it.');
    assert.equal(await page.locator('head link[rel=prefetch][as=script]').getAttribute('href'),new URL(runtime).pathname);
    assert.equal(await page.evaluate(runtime=>performance.getEntriesByName(runtime)[0]?.initiatorType,runtime),'link');
    if(worker)await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    const active=worker?context.serviceWorkers()[0]:null;
    const since=active?await active.evaluate(()=>performance.now()):0;
    const network=[];
    const record=request=>{if(request.serviceWorker()&&urls.includes(request.url()))network.push(request.url());};
    context.on('request',record);
    const target=source==='/products/'?'/products/examples/':routeFor(source);
    const actualTarget=await page.locator('main [data-list-entry]').evaluateAll((nodes,target)=>{
      const link=nodes.find(node=>new URL(node.href).pathname===target.split('#')[0]);
      if(!link)throw new Error('The first collection must link to '+target);
      const href=link.href;link.click();return href;
    },target);
    await page.waitForURL(actualTarget);await page.waitForLoadState('load');await waitForBrowse(page);await afterPaint(page);
    context.off('request',record);
    assert.equal(await page.locator('script[src]').evaluateAll((nodes,runtime)=>nodes.filter(node=>node.src===runtime).length,runtime),1,
      'The target must execute the exact prefetched runtime.');
    const timings=await page.evaluate(urls=>urls.map(url=>{
      const entry=performance.getEntriesByName(url).find(entry=>entry.initiatorType==='script'||entry.initiatorType==='fetch');
      return entry?{url,transferSize:entry.transferSize,decodedBodySize:entry.decodedBodySize}:null;
    }),urls);
    for(const timing of timings){
      assert.ok(timing?.decodedBodySize>0,'The target must consume both prefetched resources.');
      assert.equal(timing.transferSize,0,'The prefetched resource must reuse cache.');
    }
    const workerTimings=active?await active.evaluate(({urls,since})=>performance.getEntriesByType('resource')
      .filter(entry=>urls.includes(entry.name)&&entry.startTime>=since)
      .map(entry=>({url:entry.name,transferSize:entry.transferSize,decodedBodySize:entry.decodedBodySize})),{urls,since}):[];
    for(const url of network){
      assert.ok(workerTimings.some(entry=>entry.url===url&&entry.decodedBodySize>0),
        'A worker fetch must expose its inner HTTP-cache timing.');
      assert.ok(workerTimings.filter(entry=>entry.url===url).every(entry=>entry.transferSize===0),
        'A Service Worker response alone must not hide another network download.');
    }
    assert.equal(await page.locator('[data-navigation-failed]').count(),0);
    assert.equal(await page.locator('.path-column [aria-current=page]').count(),1);
    return {worker,source,timings,workerTimings};
  }});
  scenarios.push({id:'visited-path-offline-reload',kind:'single',async run({page,context,baseUrl}){
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await visit(page,baseUrl+'/');
    await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const expected=await sourceData(page,slowSource),online=await snapshot(page);
    const cached=await page.evaluate(async urls=>Promise.all(urls.map(async url=>Boolean((await caches.match(new URL(url,location.href)))?.ok))),expected.urls);
    assert.deepEqual(cached,expected.urls.map(()=>true),'Every loaded path fragments must enter the worker cache.');
    const unused=expected.all.filter(value=>!expected.urls.includes(value));
    assert.ok(unused.length>0,'The fixture needs an unused source.');
    assert.equal(await page.evaluate(async urls=>(await Promise.all(urls.map(url=>caches.match(new URL(url,location.href))))).some(Boolean),unused),false,
      'Candidate sources must not all be fetched for offline use.');
    await context.setOffline(true);
    const response=await page.reload({waitUntil:'load'});assert.ok(response?.ok()&&response.fromServiceWorker());
    await waitForBrowse(page);await afterPaint(page);
    assert.deepEqual((await snapshot(page)).columns,online.columns,'Offline reload must restore the same source rows and selection.');
    assert.deepEqual(errors,[]);
    return {columns:expected.urls.length,unused:unused.length};
  }});
  const result=await runScenarioSuite({primaryBuildDir:output,outputDir:path.join(work,'reports'),timeout:15000,scenarios});
  checkResult(result);
  const webkit=await runScenarioSuite({primaryBuildDir:output,outputDir:path.join(work,'reports-webkit'),timeout:15000,
    browserType:loadWebkit(),scenarios,onlyScenarioIds:['default-columns-load-from-fragments',
      'default-column-failures-keep-reserved-containers',
      'slow-terminal-keeps-first-column-visible','slow-ancestor-keeps-last-column-visible',
      'source-race-and-cache','shared-ancestor-updates-selection','hash-retry-respects-newer-state',
      'missing-terminal-skips-candidate-request','existing-ancestor-validates-before-default',
      'collection-sorting-keeps-source-free-urls','root-only-source-selection-needs-no-fragments',
      'column-404-recovers','column-malformed-recovers','column-nested-item-recovers',
      'default-links-and-sort-toggles-stay-clean','mixed-defaults-and-native-sort-links']});
  checkResult(webkit);
});
