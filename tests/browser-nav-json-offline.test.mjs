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
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {extractStartTags,extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-nav-json');
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
    const url=key=>navigation.resources+navigation.columns[key]+'.json';
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
  columns:[...document.querySelectorAll('[data-slot=breadcrumb] [data-navigation-column]')].map(node=>({
    path:node.dataset.navigationColumn,href:node.dataset.breadcrumbCollectionHref||'',failed:node.hasAttribute('data-navigation-failed'),
    entries:[...node.querySelectorAll('[data-list-entry]')].map(link=>({href:link.getAttribute('href'),current:link.getAttribute('aria-current')}))
  }))
}));}
function jsonPath(request){const pathname=new URL(request.url()).pathname;return pathname.startsWith('/site/navigation/')?pathname:'';}
function jsonLogicalPath(request){return publishedColumns.get(jsonPath(request))||'';}
function checkResult(result){assert.equal(result.totals.failed,0,JSON.stringify(result.scenarios));}

before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));output=path.join(work,'public');
  const assets=path.join(work,'assets'),content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  write(path.join(content,'products/examples/other/_index.md'),'---\ntitle: Other products\n---\n');
  for(const [suffix,section,titles] of [['','Another category',['Browser cache and requests','Navigation and sorting']],
    ['.zh','另一分类',['浏览器缓存与请求测试','栏目导航和排序说明']]]){
    write(path.join(content,'articles/navigation-example/_index'+suffix+'.md'),'---\ntitle: '+section+'\n---\n');
    for(const [index,title] of titles.entries())write(path.join(content,'articles/category1/navigation-extra-'+index+'/index'+suffix+'.md'),
      '---\ntitle: '+title+'\nurl: p/navigation-extra-'+index+'/\ndate: 2026-10-01\n---\nNavigation fixture.');
  }
  write(path.join(content,'plain/_index.md'),directoryPage('Plain directory'));
  write(path.join(content,'plain/readonly/_index.md'),'---\ntitle: Readonly ancestor\nlayout: page-article-norss\nparams:\n  slots: [breadcrumb]\n---\nReadonly ancestor.');
  for(const name of ['a','b'])write(path.join(content,'plain/readonly/'+name+'/index.md'),
    '---\ntitle: Readonly '+name+'\nurl: p/json-readonly-'+name+'/\ndate: 2026-10-01\n---\nReadonly article.');
  write(path.join(content,'plain/中文/_index.md'),directoryPage('中文栏目'));
  for(const name of ['a','b'])write(path.join(content,'plain/中文/'+name+'/index.md'),
    '---\ntitle: 中文 '+name+'\nurl: p/json-unicode-'+name+'/\ndate: 2026-10-01\n---\nUnicode directory article.');
  write(path.join(content,'articles/category1/json-root-only/index.md'),
    '---\ntitle: Root-only article\nurl: p/json-root-only/\nparams:\n  slots: []\n---\nRoot navigation without path columns.');
  write(path.join(assets,'site/delivery.toml'),fixtureDelivery(serviceWorkerPolicy('enable')));
  write(config,[['content',content],['content','content'],['assets','assets'],['assets',assets]].map(([target,source])=>
    '[[module.mounts]]\nsource = '+JSON.stringify(source.replaceAll('\\','/'))+'\ntarget = "'+target+'"\n').join('')+fixtureSiteMounts);
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  for(const name of fs.readdirSync(path.join(output,'site/navigation'))){
    assert.match(name,/^[a-f0-9]{64}\.json$/,'The fixture must publish flat content-addressed JSON files.');
    const payload=JSON.parse(fs.readFileSync(path.join(output,'site/navigation',name),'utf8'));
    publishedColumns.set('/site/navigation/'+name,payload.lp);
    publishedHrefs.set('/site/navigation/'+name,payload.href);
  }
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('default path HTML contains prefix resources without routes or sibling rows',()=>{
  const html=fs.readFileSync(path.join(output,article,'index.html'),'utf8');
  const navigation=extractBlocks(html,'nav',tag=>extractTagAttribute(tag,'data-slot')==='breadcrumb');
  assert.equal(navigation.length,1);
  assert.doesNotMatch(navigation[0].html,/\bdata-list-entry\b/,'Path rows must be supplied by JSON.');
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
  const rootOnly=fs.readFileSync(path.join(output,'p/json-root-only/index.html'),'utf8');
  assert.equal(inline(rootOnly).filter(code=>code.includes('defaultRootHref')).length,1,'Root-only pages still need early source selection.');
  assert.ok(inline(rootOnly).every(code=>!code.includes('page-column path-column')),'Disabled breadcrumb must not include path reservation code.');
  assert.ok(extractStartTags(rootOnly,'script').every(tag=>!extractTagAttribute(tag,'src').includes('/browse/path-entry.')),
    'Disabled breadcrumb must not load the path controller.');
});

test('external navigation handles slow, stale, failed and offline column requests',{timeout:120000},async()=>{
  const scenarios=[{id:'default-columns-load-from-json',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[];
    await page.route('**/site/navigation/**',async route=>{requests.push(jsonPath(route.request()));await gate;await route.continue();});
    try{
      await page.goto(baseUrl+article,{waitUntil:'domcontentloaded'});
      const expected=await defaultData(page);assert.ok(expected.hrefs.length>=2);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-entry-breadcrumb-pending'));
      await page.evaluate(()=>{window.reservedDefaultColumns=[...document.querySelector('[data-slot=breadcrumb]').children];});
      await afterPaint(page);const held=await snapshot(page);
      assert.equal(await page.locator('[data-slot=breadcrumb] [data-list-entry]').count(),0,
        'Default path rows must not be embedded in HTML or rendered before their JSON loads.');
      assert.equal(held.widths.length,expected.hrefs.length);
      assert.ok(await page.locator('[data-root-navigation] a').count());
      assert.ok(await page.locator('main').isVisible());
      release();await waitForBrowse(page);await afterPaint(page);const ready=await snapshot(page);
      assert.equal(ready.x,held.x);assert.equal(ready.scrollX,held.scrollX);assert.deepEqual(ready.widths,held.widths);
      assert.equal(await page.evaluate(()=>window.reservedDefaultColumns.every((node,index)=>
        node===document.querySelector('[data-slot=breadcrumb]').children[index])),true);
      assert.deepEqual([...requests].sort(),expected.urls.sort(),'Default paths must load only their own JSON columns, once each.');
      assert.deepEqual(ready.columns.map(column=>column.href),expected.hrefs);
      assert.ok(ready.columns.some(column=>column.entries.length>1),'Loaded JSON must supply the siblings absent from HTML.');
      return {columns:expected.urls.length};
    }finally{release();}
  }},{id:'default-column-failures-keep-reserved-containers',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;});
    await page.route('**/site/navigation/**',async route=>{await gate;return route.fulfill({status:404,contentType:'application/json',body:'{}'});});
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
    const response=await page.request.get(baseUrl+expected.hrefs[0]);assert.ok(response.ok(),'Collection HTML remains available independently of its JSON.');
    return {columns:columns.length};
  }},{id:'readonly-column-retry-on-sort-state',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let failing=true,attempts=0;
    await page.route('**/site/navigation/**',async route=>{
      if(jsonLogicalPath(route.request())==='/plain/readonly/'){
        attempts++;
        if(failing)return route.fulfill({status:404,contentType:'application/json',body:'{}'});
      }
      await route.continue();
    });
    await page.goto(baseUrl+'/p/json-readonly-a/',{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const column=page.locator('[data-navigation-column="/plain/readonly/"]');
    assert.equal(await column.locator('[data-list-entry]').count(),0);
    assert.notEqual(await column.getAttribute('data-navigation-failed'),null);
    assert.equal(await column.locator('[data-collection-sort-toggle]').count(),0,'The ancestor must not expose a sort toggle.');
    failing=false;
    await page.evaluate(()=>{location.hash='sorts=name-desc';});
    await page.waitForFunction(()=>document.querySelector('[data-navigation-column="/plain/readonly/"]')
      &&!document.querySelector('[data-navigation-column="/plain/readonly/"]').hasAttribute('data-navigation-failed'));
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(await column.locator('[data-list-entry]').count(),2,'A non-sortable column must also restore its complete rows after retry.');
    assert.equal(await column.locator('[data-collection-sort-toggle]').count(),0);
    assert.equal(attempts,2,'The sort-state change must retry the failed column once.');
    return {attempts,entries:2};
  }},{id:'unicode-default-columns-load-json',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    const requests=[],responses=[];page.on('request',request=>{const pathname=jsonPath(request);if(pathname)requests.push(pathname);});
    page.on('response',response=>{const pathname=jsonPath(response.request());if(pathname)responses.push({path:pathname,status:response.status()});});
    await page.goto(baseUrl+'/p/json-unicode-a/',{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const expected=await defaultData(page),href=expected.hrefs.at(-1);
    const column=page.locator('[data-breadcrumb-collection-href='+JSON.stringify(href)+']');
    const metadata=await page.evaluate(()=>JSON.parse(document.body.dataset.navigation));
    const resources=expected.urls.map(url=>({url,logicalPath:publishedColumns.get(url),
      exists:fs.existsSync(path.join(output,url.slice(1)))}));
    assert.equal(await column.locator('[data-list-entry]').count(),2,
      'A real Unicode directory must load both JSON entries. '+JSON.stringify({requests,responses,metadata,resources}));
    assert.equal(await column.getAttribute('data-navigation-failed'),null);
    assert.deepEqual([...requests].sort(),expected.urls.sort(),'Unicode logical paths must resolve the published JSON URL.');
    assert.equal(await column.locator('[aria-current=page]').count(),1);
    return {href,requests:requests.length};
  }},{id:'slow-columns-keep-layout',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[];
    await page.route('**/site/navigation/**',async route=>{requests.push(jsonPath(route.request()));await gate;await route.continue();});
    try{
      await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'domcontentloaded'});
      const expected=await sourceData(page,slowSource);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-entry-breadcrumb-pending'));
      await afterPaint(page);const held=await snapshot(page);
      assert.ok(await page.locator('main').isVisible(),'The article must remain visible while columns load.');
      assert.equal(held.widths.length,expected.hrefs.length,'All path columns must be reserved before JSON arrives.');
      release();await waitForBrowse(page);await afterPaint(page);
      const ready=await snapshot(page);
      assert.equal(ready.x,held.x,'Filling columns must keep the article at its reserved position.');
      assert.equal(ready.scrollX,held.scrollX);assert.deepEqual(ready.widths,held.widths);
      assert.deepEqual([...requests].sort(),expected.urls.sort(),'Only the selected source columns must load, once each.');
      assert.deepEqual(ready.columns.map(column=>column.href),expected.hrefs);
      return {columns:expected.urls.length};
    }finally{release();}
  }},{id:'source-race-and-cache',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[];
    await page.route('**/site/navigation/**',async route=>{
      const pathname=jsonPath(route.request());requests.push(pathname);
      if(jsonLogicalPath(route.request()).startsWith('/products/'))await gate;
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
    const requests=[];page.on('request',request=>{const pathname=jsonPath(request);if(pathname)requests.push(pathname);});
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
      requests.push(jsonPath(route.request()));
      if(jsonLogicalPath(route.request())==='/products/')await gate;
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
  }},{id:'collection-from-self-uses-default-prefixes',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    const requests=[];page.on('request',request=>{const pathname=jsonPath(request);if(pathname)requests.push(pathname);});
    await page.goto(baseUrl+'/articles/category1/#from=articles/category1',{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const expected=await defaultData(page);
    assert.deepEqual((await snapshot(page)).columns.map(column=>column.path),expected.paths);
    assert.deepEqual(requests.sort(),expected.urls.sort());
    assert.equal(requests.some(url=>publishedColumns.get(url)==='/articles/category1/'),false,'The current collection must use its native main list.');
    assert.ok(await page.locator('main [data-list-entry]').count());
    const toggle=page.locator('[data-navigation-column="/articles/"] [data-collection-sort-toggle]');
    const initial=await toggle.locator('[data-sort-indicator]').textContent();
    await toggle.focus();await toggle.press('Enter');
    await page.waitForFunction(before=>document.querySelector('[data-navigation-column="/articles/"] [data-sort-indicator]')?.textContent!==before,initial);
    const fields=new URLSearchParams(new URL(page.url()).hash.slice(1)),tokens=(fields.get('sorts')||'').split(',');
    const slots=[...Array(Math.max(0,2-tokens.length)).fill('_'),...tokens];
    assert.equal(fields.get('from'),'articles/category1','Sorting a parent must retain the current collection lineage.');
    assert.equal(slots[0],initial==='↓'?'date-asc':'date-desc','The parent sort must occupy its own lineage slot.');
    assert.ok(slots[1]==='_'||slots[1]==='date-desc','The current main collection must retain its default order.');
    assert.equal(await page.locator('main [data-sort-active="true"] [data-sort-indicator]').textContent(),'↓');
    assert.deepEqual(requests.sort(),expected.urls.sort(),'Sorting a parent must not request the current main collection JSON.');
    return {requests:requests.length};
  }},{id:'root-only-source-selection-needs-no-json',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release;const gate=new Promise(resolve=>{release=resolve;}),requests=[];
    page.on('request',request=>{const pathname=jsonPath(request);if(pathname)requests.push(pathname);});
    await page.route('**/*',async route=>{if(route.request().resourceType()==='script')await gate;await route.continue();});
    try{
      await page.goto(baseUrl+'/p/json-root-only/#from=articles-all',{waitUntil:'commit'});
      await page.waitForFunction(()=>document.querySelector('[data-root-navigation] .is-current')?.dataset.rootHref==='/articles-all/');
      const data=await page.evaluate(()=>JSON.parse(document.body.dataset.navigation));
      assert.equal(data.default,'');assert.ok(data.columns['/articles-all/']);
      assert.equal(data.columns['/articles/'],undefined,'Root-only pages need only their direct candidate hashes.');
      assert.equal(await page.locator('[data-slot=breadcrumb]').count(),0);assert.deepEqual(requests,[]);
      release();await page.waitForLoadState('load');await waitForBrowse(page);
      assert.deepEqual(requests,[],'Deferred root selection must also avoid navigation JSON requests.');
      assert.equal(await page.locator('[data-root-navigation] .is-current').getAttribute('data-root-href'),'/articles-all/');
      return {requests:0};
    }finally{release();}
  }});
  scenarios.push({id:'hash-retry-respects-newer-state',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let release,retrying;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{retrying=resolve;});
    let attempts=0;
    await page.route('**/site/navigation/**',async route=>{
      if(jsonLogicalPath(route.request())===slowSource){
        attempts++;
        if(attempts===1)return route.fulfill({status:404,contentType:'application/json',body:'{}'});
        retrying();await gate;
      }
      await route.continue();
    });
    try{
      await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'load'});await waitForBrowse(page);
      const column=page.locator('[data-navigation-column="'+slowSource+'"]'),failed=await snapshot(page);
      assert.ok(await column.getAttribute('data-navigation-failed')!==null);
      assert.equal(await column.locator('[data-collection-sort-toggle]').count(),0);
      await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]+'&sorts=name-asc,name-asc');
      await started;
      const hash=routeFor(slowSource).split('#')[1]+'&sorts=name-asc,name-desc';
      await page.evaluate(hash=>{location.hash=hash;},hash);
      const latest=page.url(),finished=page.waitForResponse(response=>jsonLogicalPath(response.request())===slowSource);
      release();await finished;await waitForBrowse(page);await afterPaint(page);
      assert.equal(page.url(),latest,'An older retry must not replace a newer URL state after its request completes.');
      assert.equal(await column.locator('[data-sort-indicator]').textContent(),'↓','The latest sort direction must win.');
      assert.equal(await column.locator('[data-list-entry]').count(),2,'The latest state must also restore complete column rows.');
      const ready=await snapshot(page);assert.equal(ready.x,failed.x);assert.deepEqual(ready.widths,failed.widths);
      assert.equal(attempts,2,'The state change must reuse the pending retry.');
      return {attempts,hash};
    }finally{release();}
  }});
  for(const fault of ['404','malformed'])scenarios.push({id:'column-'+fault+'-recovers',kind:'single',serviceWorkers:'block',async run({page,baseUrl}){
    let failing=true;const requests=[];
    await page.route('**/site/navigation/**',async route=>{
      const pathname=jsonPath(route.request());requests.push(pathname);
      if(failing&&jsonLogicalPath(route.request())===slowSource)return route.fulfill({status:fault==='404'?404:200,
        contentType:'application/json',body:fault==='404'?'{}':'{broken'});
      await route.continue();
    });
    await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const expected=await sourceData(page,slowSource),failed=await snapshot(page);
    assert.deepEqual(failed.columns.map(column=>column.path),expected.paths,'Failures must keep every reserved column.');
    assert.ok(failed.widths.every(width=>width>0));
    assert.equal(await page.locator('[data-slot=breadcrumb]').getAttribute('aria-hidden'),null);
    failing=false;
    const column=page.locator('[data-navigation-column="'+slowSource+'"]');
    assert.equal(await column.locator('[data-list-entry]').count(),0,'A failed column must not invent a selected article.');
    assert.equal(await column.locator('[data-collection-sort-toggle]').count(),0);
    assert.ok((await column.textContent()).includes(expected.error));
    await column.evaluate(node=>{window.failedNavigationColumn=node;});
    await page.evaluate(hash=>{location.hash=hash;},routeFor(slowSource).split('#')[1]+'&sorts=name-asc,name-desc');
    await page.waitForFunction(source=>document.querySelector('[data-navigation-column="'+source+'"]')
      &&!document.querySelector('[data-navigation-column="'+source+'"]')?.hasAttribute('data-navigation-failed'),slowSource);
    await waitForBrowse(page);await afterPaint(page);
    assert.equal(await column.locator('[data-list-entry]').count(),2,'A hash change must retry and restore the full column.');
    assert.equal(await column.evaluate(node=>node===window.failedNavigationColumn),true);
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
    assert.equal(requests.filter(value=>value===retried).length,2,'Failed JSON must be retried when the source is selected again.');
    for(const url of expected.urls.filter(value=>value!==retried))assert.equal(requests.filter(value=>value===url).length,1);
    return {fault,retried};
  }});
  scenarios.push({id:'visited-path-offline-reload',kind:'single',async run({page,context,baseUrl}){
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await visit(page,baseUrl+'/');
    await page.goto(baseUrl+routeFor(slowSource),{waitUntil:'load'});await waitForBrowse(page);await afterPaint(page);
    const expected=await sourceData(page,slowSource),online=await snapshot(page);
    const cached=await page.evaluate(async urls=>Promise.all(urls.map(async url=>Boolean((await caches.match(new URL(url,location.href)))?.ok))),expected.urls);
    assert.deepEqual(cached,expected.urls.map(()=>true),'Every loaded path JSON must enter the worker cache.');
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
    browserType:loadWebkit(),scenarios,onlyScenarioIds:['default-columns-load-from-json',
      'default-column-failures-keep-reserved-containers','slow-columns-keep-layout',
      'missing-terminal-skips-candidate-request','existing-ancestor-validates-before-default',
      'collection-from-self-uses-default-prefixes','root-only-source-selection-needs-no-json',
      'column-404-recovers','column-malformed-recovers']});
  checkResult(webkit);
});
