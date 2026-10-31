import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fixtureEnvironment,fixtureSiteMounts,fixtureContentDirectory,fixtureDelivery,serviceWorkerPolicy} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {readBindings} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/bindings.mjs';
import {command as rulesCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/prefetch/rules/options.mjs';
import {command as overlapCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/prefetch/overlap/options.mjs';
import {command as debugCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/prefetch/debug/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';
import {runScenarioSuite} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/suite.mjs';
import {runtimeState} from '../.agents/skills/swaw-banyan/tasks/check/browser/prefetch/_shared/page.mjs';
import {recordRuntime} from '../.agents/skills/swaw-banyan/tasks/check/browser/prefetch/overlap/check.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),skill=path.join(root,'.agents/skills/swaw-banyan');
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-prefetch-tests'),probePage='/prefetch-probe/',debugPage='/diagnostics/prefetch/';
let work,full,off,duplicate,prerenderFilter,columns,splitColumns,rawLinks;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(name,directory=full,args=[]) {
  const pageArgs=args.includes('--page')?[]:['--page',name==='debug'?debugPage:probePage];
  const result=spawnSync(toolExecutable(readBindings().runtime),[path.join(skill,'tasks','check/browser/prefetch/'+name,'entry.mjs'),directory,
    ...pageArgs,'--timeout','2500','--out',path.join(work,'reports'),...args],
  {cwd:work,encoding:'utf8',timeout:20000});
  assert.ifError(result.error);return result;
}
function passed(name,directory=full,args=[]) {
  const result=cli(name,directory,args);assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8')).details;
}
function fails(name,directory,pattern,args=[]) {
  const result=cli(name,directory,args);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,pattern);
}
function output(name,from=full){const directory=path.join(work,name);fs.cpSync(from,directory,{recursive:true});return directory;}
async function scenarios(name,directory,items) {
  const report=await runScenarioSuite({primaryBuildDir:directory,outputDir:path.join(work,'case-'+name),timeout:8000,
    scenarios:items.map(item=>({kind:'single',serviceWorkers:'block',...item}))});
  assert.equal(report.totals.failed,0,JSON.stringify(report.scenarios));
  return report;
}
async function visit(page,baseUrl,backend='link',route=debugPage) {
  const url=new URL(route,baseUrl);
  if(backend)url.searchParams.set('prefetch-backend',backend);
  await page.goto(url.href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.banyanPrefetchState&&window.banyanPrefetchState.reason!=='selecting');
  return page.evaluate(()=>window.banyanPrefetchState);
}
async function trace(page) {
  return page.evaluate(()=>({
    links:window.__swbanPrefetchTrace.links.filter(href=>new URL(href).pathname.startsWith('/probe-')),
    messages:window.__swbanPrefetchTrace.messages.filter(href=>new URL(href).pathname.startsWith('/probe-'))
  }));
}
async function count(page,pathname,transport='links') {
  return (await trace(page))[transport].filter(href=>new URL(href).pathname===pathname).length;
}
async function appendAnchor(page,kind,href,id='late') {
  await page.evaluate(({kind,href,id})=>{
    const anchor=document.createElement('a');anchor.dataset.listEntry='';anchor.dataset.probe=id;anchor.href=href;
    anchor.innerHTML='<span class="item-icon"><svg class="icon icon-'+kind+'"><use href="#icon-'+kind+'"></use></svg></span><span class="item-title">'+id+'</span>';
    document.querySelector('main').appendChild(anchor);
  },{kind,href,id});
  return page.locator('[data-probe="'+id+'"]');
}
function noNative() {
  const supports=HTMLScriptElement.supports.bind(HTMLScriptElement);
  HTMLScriptElement.supports=value=>value==='speculationrules'?false:supports(value);
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-prefetch-'));
  const content=path.join(work,'content'),layouts=path.join(work,'layouts'),config=path.join(work,'fixture.toml');
  fixtureContentDirectory(content);
  const icon=(name,href)=>'<a data-list-entry data-probe="'+name+'" href="'+href+'"><span class="item-icon"><svg class="icon icon-'+name+'"><use href="#icon-'+name+'"></use></svg></span><span class="item-title">'+name+'</span></a>';
  const anchors='<a data-probe="plain" href="/probe-dynamic/">Plain link</a>\n'+['folder','tag','product','file'].map(name=>(name==='product'?'<div aria-hidden="true">'+
    '<p>Viewport spacer</p>'.repeat(60)+'</div>':'')+icon(name,'/probe-'+name+'/')).join('\n');
  write(path.join(layouts,'page-prefetch-probe.html'),'{{ define "main" }}<article class="article"><div class="prose"><h1>{{ .Title }}</h1>{{ .Content }}'+anchors+'</div></article>{{ end }}');
  for(const language of ['en','zh','zh-tw']) {
    const prefix=language==='en'?'':'/'+language,suffix=language==='en'?'':'.'+language;
    write(path.join(content,'prefetch-probe/index'+suffix+'.md'),'---\ntitle: Prefetch probe\nurl: '+prefix+probePage+'\nlayout: page-prefetch-probe\n---\n');
  }
  const labels=Object.entries({backend:'Prefetch transport',auto:'Auto',native:'Native',sw:'SW',link:'Link',off:'Off',apply:'Apply and reload',loading:'Loading...',unavailable:'Unavailable',collection:'Collection',article:'Article'})
    .map(([key,value])=>'      '+key+': '+JSON.stringify(value)).join('\n');
  for(const [name,route,panels] of [
    ['diagnostics',debugPage,['support','env','actions','runtime','payload']],
    ['diagnostics-partial','/diagnostics/partial/',['support','env']]
  ])write(path.join(content,name,'index.md'),'---\ntitle: Prefetch diagnostics\nurl: '+route+'\nlayout: page-prefetch-probe\nparams:\n  prefetch_debug:\n    labels:\n'+
    labels+'\n---\n\n{{< prefetch-debug-controls >}}\n\n{{< prefetch-debug-links >}}\n\n'+
    panels.map(key=>'## '+key+'\n\n{{< prefetch-debug-state "'+key+'" >}}').join('\n\n')+'\n');
  for(const name of ['folder','tag','product','file','dynamic'])write(path.join(content,'probe-'+name+'/index.md'),
    '---\ntitle: Target '+name+'\nurl: /probe-'+name+'/\nlayout: page-article-norss\n---\n');
  for(const render of ['link','never'])write(path.join(content,'unpublished-'+render+'/index.md'),
    '---\ntitle: Unpublished '+render+'\nurl: /000-unpublished-'+render+'/\nlayout: page-article-norss\nbuild:\n  render: '+render+'\n---\n');
  for(const route of ['d/prefetch-scopes','d/prefetch-scopes/child','d/prefetch-scopes/sibling'])
    write(path.join(content,route,'_index.md'),'---\ntitle: Scope collection\n---\n');
  for(const [index,name] of ['one','two'].entries())write(path.join(content,'d/prefetch-scopes/child',name+'.md'),
    '---\ntitle: '+name+'\nurl: /d/prefetch-scopes/child/'+name+'/\nlayout: page-article-norss\ndate: 2026-01-0'+(index+1)+'\n---\nScope article.');
  const mount=(directory,target)=>'[[module.mounts]]\nsource = '+JSON.stringify(directory.replaceAll('\\','/'))+'\ntarget = "'+target+'"\n';
  const mounts=mount(content,'content')+mount('content','content')+mount(layouts,'layouts')+mount('layouts','layouts')+fixtureSiteMounts;
  function build(name,enabled=true,runtimeSource,prerenderOnly=false,columnPolicy='') {
    const assets=path.join(work,name+'-assets');
    write(path.join(assets,'site/delivery.toml'),fixtureDelivery(serviceWorkerPolicy(!columnPolicy&&enabled?'enable':'off')+(columnPolicy||'[prefetch]\nenabled='+enabled+
      '\ndefault="off"\n[prefetch.icons.folder]\nall="conservative"\n[prefetch.icons.tag]\nall="moderate"\n[prefetch.icons.product]\nall="eager"\n[prefetch.icons.file]\nall="'+(prerenderOnly?'off':'immediate')+'"\n'+
      '[prefetch.prerender.icons.folder]\ntail="off"\n'+
      (prerenderOnly?'[prefetch.prerender.icons.file]\nall="moderate"\n':''))));
    if(runtimeSource)write(path.join(assets,'js/prefetch/runtime-entry.js'),runtimeSource);
    write(config,mounts+mount('assets','assets')+mount(assets,'assets')+
      '[params.build]\nversion="v20261014000101"\n');
    const destination=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',destination],
      {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
    write(path.join(destination,'foreign-worker.js'),'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));');
    return destination;
  }
  full=build('full');off=build('off',false);
  rawLinks=build('raw-links',true,undefined,false,[
    '[prefetch]','enabled=true','default="moderate"',
    '[prefetch.icons.folder]','all="conservative"'
  ].join('\n'));
  const entry=fs.readFileSync(path.join(root,'module/assets/js/prefetch/runtime-entry.js'),'utf8');
  assert.ok(entry.includes("if (state.backend === 'native' || state.backend === 'off') return;"));
  duplicate=build('duplicate',true,entry.replace("if (state.backend === 'native' || state.backend === 'off') return;","if (state.backend === 'off') return;"));
  prerenderFilter=build('prerender-filter',true,undefined,true);
  columns=build('columns',true,undefined,false,[
    '[prefetch]','enabled=true','default="off"',
    '[prefetch.icons.folder]','all="conservative"','root="off"','tail="eager"',
    '"tail-1"="moderate"','"tail-2"="off"','"root+1"="immediate"','"root+2"="eager"',
    '"tail-12"="moderate"','"root+12"="immediate"',
    '[prefetch.prerender.icons.folder]','all="off"','tail="moderate"',
    '"tail-1"="eager"','"root+1"="immediate"','"root+2"="immediate"'
  ].join('\n'));
  splitColumns=build('split-columns',true,undefined,false,[
    '[prefetch]','enabled=true','default="off"',
    '[prefetch.icons.folder]','all="off"','"root+1"="eager"',
    '[prefetch.prerender.icons.folder]','all="off"','"tail-1"="moderate"'
  ].join('\n'));
},{timeout:120000});
after(()=>{
  if(work){assert.equal(path.dirname(work),parent);assert.ok(path.basename(work).startsWith('banyan-browser-prefetch-'));
    fs.rmSync(work,{recursive:true,force:true});}
});

test('inline rules, overlap and diagnostics use the unified contract',{timeout:60000},()=>{
  assert.equal(parseArguments(rulesCommand(),[]).expect,'inline');
  assert.equal(parseArguments(rulesCommand(),['--eager','folder/root+12,folder/tail-2']).eager,'folder/root+12,folder/tail-2');
  for(const scope of ['current','parent_2','ancestors','root+0','tail-01'])
    assert.throws(()=>parseArguments(rulesCommand(),['--eager','folder/'+scope]));
  for(const value of ['header','disabled'])assert.throws(()=>parseArguments(rulesCommand(),['--expect',value]));
  for(const factory of [rulesCommand,overlapCommand,debugCommand]) {
    assert.throws(()=>parseArguments(factory(),['--page','https://outside.invalid/']));
    assert.match(helpFor(factory()),/--page <path>/);
  }
  const detail=passed('rules',full,['--eager','product/all','--trace']);
  assert.ok(detail.ruleSet.backendNodeId);assert.equal(detail.enabled,true);
  assert.equal(passed('rules',full,['--page','/zh'+probePage+'?keep=yes']).enabled,true);
  assert.equal(passed('rules',off,['--expect','off']).enabled,false);
  assert.equal(passed('overlap').backend,'native');
  fails('overlap',duplicate,/suppress all custom/);
  const {panels}=passed('debug');
  assert.deepEqual(Object.keys(panels).sort(),['actions','env','payload','runtime','support']);
  assert.equal(panels.env.backend,'native');
  const filtered=passed('debug',prerenderFilter).panels;
  assert.equal(filtered.payload.config.modes['file/all'],'off');
  assert.equal(filtered.payload.config.prerender['file/all'],'moderate');
  assert.deepEqual(filtered.actions.prerender,{},'a base-off scope cannot become a prerender candidate');
  assert.ok((filtered.payload.publishedNativeRules.prerender??[]).every(rule=>
    rule.where.and[0].selector_matches.includes(':is(')),'prerender declarations retain the base eligibility guard');
  const html=fs.readFileSync(path.join(full,probePage,'index.html'),'utf8');
  const source=html.match(/<script\b[^>]*site-speculation-rules[^>]*>([\s\S]*?)<\/script>/)[1];
  const hash="'sha256-"+createHash('sha256').update(source).digest('base64')+"'";
  assert.ok(fs.readFileSync(path.join(full,'_headers'),'utf8').includes(hash),'CSP contains the exact emitted native script hash');
  const tampered=output('tampered-csp'),file=path.join(tampered,probePage,'index.html');
  write(file,html.replace(source,source+' '));
  fails('rules',tampered,/register the inline|CSP/);
});

test('inline empty rules are accepted without accepting invalid rules or blocked CSP',{timeout:30000},()=>{
  const directory=output('empty-rules',off),file=path.join(directory,probePage,'index.html');
  const html=fs.readFileSync(file,'utf8'),headers=fs.readFileSync(path.join(directory,'_headers'),'utf8');
  function put(source,authorize=true) {
    write(file,html.replace('</body>','<script id=site-speculation-rules type=speculationrules>'+source+'</script></body>'));
    const hash=" 'sha256-"+createHash('sha256').update(source).digest('base64')+"'";
    write(path.join(directory,'_headers'),authorize?headers.replace(/script-src([^;\r\n]*)/,match=>match+hash):headers);
  }
  put('{}');assert.deepEqual(passed('rules',directory).payload,{});
  fails('rules',directory,/Off mode must not declare/,['--expect','off']);
  put('{broken');fails('rules',directory,/Chromium rejected rules/);
  put('{"prefetch":[{"source":"document","where":{"href_matches":"/*"},"eagerness":"moderate"}]}');
  fails('rules',directory,/valid shared rules/);
  put('{}',false);fails('rules',directory,/register the inline|CSP/);
});

test('direct anchors use the default policy without a link partial or prefetch markers',{timeout:20000},async()=>{
  await scenarios('direct-anchors',rawLinks,[{id:'shared-selector-contract',run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);await visit(page,baseUrl,'native');
    const matched=await page.evaluate(()=>{
      const plain=document.querySelector('[data-probe=plain]'),folder=document.querySelector('[data-probe=folder]');
      const targets=JSON.parse(document.getElementById('site-prefetch-rules').textContent).prefetch;
      const native=JSON.parse(document.getElementById('site-speculation-rules').textContent).prefetch;
      return {
        plain:targets.find(rule=>plain.matches(rule.selector))?.id,
        folder:targets.find(rule=>folder.matches(rule.selector))?.id,
        nativePlain:native.some(rule=>plain.matches(rule.where.and[0].selector_matches)),
        plainIsItem:plain.hasAttribute('data-list-entry'),
        legacy:document.querySelectorAll('[data-prefetch-slot]').length
      };
    });
    assert.deepEqual(matched,{plain:'default',folder:'folder/all',nativePlain:true,plainIsItem:false,legacy:0});
    await visit(page,baseUrl,'link');
    await page.locator('[data-probe=plain]').dispatchEvent('mouseover');
    await page.waitForTimeout(250);assert.equal(await count(page,'/probe-dynamic/'),1);
    await page.locator('[data-probe=folder]').dispatchEvent('mouseover');
    await page.waitForTimeout(250);assert.equal(await count(page,'/probe-folder/'),0);
    await page.locator('[data-probe=folder]').dispatchEvent('focusin');
    assert.equal(await count(page,'/probe-folder/'),1);
    assert.equal(await page.locator('[data-prefetch-slot]').count(),0);
    return matched;
  }}]);
});

test('one backend is selected once; overrides apply only on diagnostic pages',{timeout:45000},async()=>{
  await scenarios('backends',full,[{id:'native-priority-and-forced-modes',run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);
    let state=await visit(page,baseUrl,'auto');assert.equal(state.backend,'native');
    assert.equal((await runtimeState(page)).nativeReady,true);assert.deepEqual(await trace(page),{links:[],messages:[]});
    const values=await page.locator('#prefetch-debug-backend option').evaluateAll(nodes=>nodes.map(node=>node.value));
    assert.deepEqual(values,['auto','native','sw','link','off']);assert.equal(await page.locator('#prefetch-debug-controls').count(),1);
    assert.deepEqual(await page.locator('#prefetch-debug-controls').evaluate(form=>({
      language:document.documentElement.lang,
      label:form.querySelector('label').textContent.trim(),
      copy:JSON.parse(form.dataset.prefetchDebugCopy),
      status:document.getElementById('prefetch-debug-status').textContent
    })),{language:'en',label:'Prefetch transport',status:'Auto → Native',copy:{
      backend:'Prefetch transport',auto:'Auto',native:'Native',sw:'SW',link:'Link',off:'Off',apply:'Apply and reload',
      loading:'Loading...',unavailable:'Unavailable',collection:'Collection',article:'Article'
    }});
    for(const [requested,backend] of [['native','native'],['sw','off'],['link','link'],['off','off'],['bad-value','native']]) {
      state=await visit(page,baseUrl,requested);assert.equal(state.backend,backend,requested);
      assert.equal(state.requested,requested==='bad-value'?'auto':requested);
      assert.equal((await runtimeState(page)).nativeReady,backend==='native');
    }
    state=await visit(page,baseUrl,'off',probePage);assert.equal(state.requested,'auto');assert.equal(state.backend,'native');
    return state;
  }},{id:'translated-powered-by-reloads',run:async({page,baseUrl})=>{
    for(const language of ['en','zh','zh-tw']) {
      const prefix=language==='en'?'':'/'+language,pathname=prefix+'/powered-by/';
      await visit(page,baseUrl,'auto',pathname+'?keep=yes#diagnostics');
      assert.equal(await page.locator('html').getAttribute('lang'),language);
      assert.equal(await page.locator('[data-site-update-panel]').count(),1);
      assert.equal(await page.locator('#prefetch-debug-controls').count(),1);
      const disclosure=page.locator('details:has(#prefetch-debug-controls)'),summary=disclosure.locator('summary');
      assert.equal(await disclosure.count(),1);assert.equal(await summary.isVisible(),true);
      assert.equal(await disclosure.evaluate(node=>node.open),false,'Diagnostics start collapsed.');
      assert.equal(await page.locator('#prefetch-debug-controls').isVisible(),false);
      if(language!=='en')assert.match(await summary.textContent(),/[\u3400-\u9fff]/);
      await summary.focus();await summary.press('Enter');
      assert.equal(await disclosure.evaluate(node=>node.open),true,'Enter opens the diagnostic disclosure.');
      assert.equal(await page.locator('#prefetch-debug-controls').isVisible(),true);
      await summary.press('Space');
      assert.equal(await disclosure.evaluate(node=>node.open),false,'Space closes the diagnostic disclosure.');
      assert.equal(await page.locator('#prefetch-debug-controls').isVisible(),false);
      if(language!=='en')assert.match(await page.locator('label[for=prefetch-debug-backend]').textContent(),/[\u3400-\u9fff]/);
      const links=await page.locator('[data-prefetch-test-link]').evaluateAll(nodes=>nodes.map(node=>new URL(node.href).pathname));
      assert.ok(links.length>0,'Translated diagnostics retain published test links.');
      assert.ok(links.every(href=>prefix?href.startsWith(prefix+'/'):!/^\/zh(?:-tw)?\//.test(href)),'Test links use the current language.');
      for(const backend of ['off','auto']) {
        await summary.click();
        await page.locator('#prefetch-debug-backend').selectOption(backend);
        await Promise.all([page.waitForEvent('load'),page.locator('#prefetch-debug-controls button[type=submit]').click()]);
        await page.waitForFunction(()=>window.banyanPrefetchState?.reason&&window.banyanPrefetchState.reason!=='selecting');
        const url=new URL(page.url());
        assert.equal(url.pathname,pathname);assert.equal(url.searchParams.get('keep'),'yes');assert.equal(url.hash,'#diagnostics');
        assert.equal(url.searchParams.get('prefetch-backend'),backend==='auto'?null:backend);
        assert.equal(await page.locator('html').getAttribute('lang'),language);
        assert.equal(await disclosure.evaluate(node=>node.open),false,'Reload starts with diagnostics collapsed.');
        assert.equal(await page.locator('#prefetch-debug-controls').isVisible(),false);
        assert.equal(await page.locator('#prefetch-debug-backend').inputValue(),backend);
        const env=JSON.parse(await page.locator('#prefetch-debug-env').textContent());
        assert.deepEqual(Object.keys(env).sort(),['backend','reason','requested']);assert.equal(env.requested,backend);
        if(backend==='off')assert.deepEqual(env,{requested:'off',backend:'off',reason:'requested-off'});
      }
    }
  }},{id:'diagnostic-disclosure-without-javascript',run:async({browser,baseUrl})=>{
    const context=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});
    try {
      const page=await context.newPage();
      await page.goto(new URL('/zh/powered-by/',baseUrl).href,{waitUntil:'load'});
      const disclosure=page.locator('details:has(#prefetch-debug-controls)'),summary=disclosure.locator('summary');
      assert.equal(await disclosure.evaluate(node=>node.open),false);
      assert.equal(await page.locator('#prefetch-debug-controls').isVisible(),false);
      await summary.focus();await summary.press('Enter');
      assert.equal(await page.locator('#prefetch-debug-controls').isVisible(),true,'Native disclosure opens without JavaScript.');
      await summary.click();
      assert.equal(await disclosure.evaluate(node=>node.open),false);
    } finally {await context.close();}
  }},{id:'partial-diagnostic-panels',run:async({page,baseUrl})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const state=await visit(page,baseUrl,'off','/diagnostics/partial/');
    assert.deepEqual(state,{requested:'off',backend:'off',reason:'requested-off',dispatched:0,failures:0});
    await page.waitForFunction(()=>JSON.parse(document.getElementById('prefetch-debug-support').textContent).serviceWorker.status!=='pending');
    assert.equal(await page.locator('#prefetch-debug-backend').inputValue(),'off');
    assert.deepEqual(JSON.parse(await page.locator('#prefetch-debug-env').textContent()),{requested:'off',backend:'off',reason:'requested-off'});
    assert.equal(await page.locator('#prefetch-debug-actions, #prefetch-debug-runtime, #prefetch-debug-payload').count(),0);
    assert.deepEqual(errors,[]);
    return state;
  }},{id:'forced-native-unavailable',run:async({page,baseUrl})=>{
    await page.addInitScript(noNative);await page.addInitScript(recordRuntime);
    const state=await visit(page,baseUrl,'native');assert.equal(state.backend,'off');assert.equal(state.reason,'native-unavailable');
    assert.deepEqual(await trace(page),{links:[],messages:[]});return state;
  }}]);
  await scenarios('global-off',off,[{id:'auto-off-but-diagnostic-force',run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);
    assert.equal((await visit(page,baseUrl,'auto')).reason,'disabled');
    assert.equal((await visit(page,baseUrl,'link')).backend,'link');assert.equal(await count(page,'/probe-file/'),1);
    assert.equal((await visit(page,baseUrl,'native')).backend,'native');
    assert.equal((await visit(page,baseUrl,'sw')).reason,'sw-unavailable');
    return page.evaluate(()=>window.banyanPrefetchState);
  }}]);
});

test('custom intensities, URL deduplication, reload and link error rollback',{timeout:35000},async()=>{
  await scenarios('interaction',full,[{id:'press-hover-and-retry',run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);await visit(page,baseUrl);
    assert.equal(await count(page,'/probe-file/'),1,'immediate runs once at startup');
    await page.locator('[data-probe=folder]').dispatchEvent('mouseover');await page.waitForTimeout(240);
    assert.equal(await count(page,'/probe-folder/'),0,'conservative does not hover');
    await page.locator('[data-probe=folder]').dispatchEvent('mousedown',{button:0});
    assert.equal(await count(page,'/probe-folder/'),1);
    const shared=await appendAnchor(page,'tag','/probe-folder/#another','shared');
    await shared.dispatchEvent('focusin');assert.equal(await count(page,'/probe-folder/'),1,'hash/icon duplicates share the document URL set');
    const focus=await appendAnchor(page,'folder','/probe-folder/?focus=1','focus');
    await focus.dispatchEvent('focusin');assert.equal(await count(page,'/probe-folder/'),2,'focus remains accessible');
    const touch=await appendAnchor(page,'folder','/probe-folder/?touch=1','touch');
    await touch.dispatchEvent('touchstart');assert.equal(await count(page,'/probe-folder/'),3);
    const synthetic=await appendAnchor(page,'tag','/probe-dynamic/','synthetic');
    await synthetic.dispatchEvent('mouseover');await synthetic.dispatchEvent('mousedown',{button:0});
    await page.waitForTimeout(250);assert.equal(await count(page,'/probe-dynamic/'),0,'mouse events after touch are suppressed');
    await page.waitForTimeout(1000);
    const moderate=page.locator('[data-probe=tag]');
    await moderate.dispatchEvent('mouseover');await page.waitForTimeout(60);
    assert.equal(await count(page,'/probe-tag/'),0,'moderate waits about 200ms');
    await moderate.dispatchEvent('mouseout');await page.waitForTimeout(190);
    assert.equal(await count(page,'/probe-tag/'),0,'leaving cancels hover');
    await moderate.dispatchEvent('mouseover');await page.waitForTimeout(240);assert.equal(await count(page,'/probe-tag/'),1);
    await page.locator('[data-probe=product]').dispatchEvent('mouseover');await page.waitForTimeout(40);
    assert.equal(await count(page,'/probe-product/'),1,'eager hover waits about 10ms');
    await synthetic.dispatchEvent('focusin');assert.equal(await count(page,'/probe-dynamic/'),1,'late moderate links use delegated interaction');
    await page.evaluate(()=>[...document.querySelectorAll('link[data-prefetch-link=runtime]')]
      .find(node=>new URL(node.href).pathname==='/probe-folder/').dispatchEvent(new Event('error')));
    await page.locator('[data-probe=folder]').dispatchEvent('focusin');assert.equal(await count(page,'/probe-folder/'),4,'known link failure releases the URL');
    const immediate=await appendAnchor(page,'file','/probe-dynamic/?immediate=1','late-immediate');
    await immediate.dispatchEvent('focusin');await immediate.dispatchEvent('touchstart');await page.waitForTimeout(60);
    assert.equal(await count(page,'/probe-dynamic/'),1,'late immediate nodes remain idle');
    assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(key=>key.startsWith('banyan-prefetch'))),false);
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.banyanPrefetchState.reason!=='selecting');
    assert.equal(await count(page,'/probe-file/'),1,'reload starts a fresh document URL set');
    return page.evaluate(()=>window.banyanPrefetchState);
  }},{id:'data-saving-keeps-only-explicit-interactions',run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);
    await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,effectiveType:'4g'},configurable:true}));
    await visit(page,baseUrl);assert.deepEqual(await trace(page),{links:[],messages:[]});
    await page.locator('[data-probe=product]').dispatchEvent('mouseover');await page.waitForTimeout(40);
    assert.deepEqual(await trace(page),{links:[],messages:[]});
    await page.locator('[data-probe=folder]').dispatchEvent('focusin');assert.equal(await count(page,'/probe-folder/'),1);
  }}]);
});

test('coarse viewport uses fixed startup nodes and cancels short visibility',{timeout:20000},async()=>{
  await scenarios('viewport',full,[{id:'startup-viewport-dwell',hasTouch:true,isMobile:true,run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);
    await page.addInitScript(()=>{
      const match=window.matchMedia.bind(window);
      window.matchMedia=query=>query==='(hover: none) and (pointer: coarse)'?{matches:true}:match(query);
      window.__idle=[];window.requestIdleCallback=callback=>{window.__idle.push(callback);return 1;};
      window.__observed=[];
      window.IntersectionObserver=class {
        constructor(callback){window.__intersection=callback;}
        observe(node){window.__observed.push(node.dataset.probe);}
        unobserve(node){window.__unobserved=(window.__unobserved||[]).concat(node.dataset.probe);}
      };
    });
    await visit(page,baseUrl);const late=await appendAnchor(page,'product','/probe-dynamic/','late-eager');
    await page.evaluate(()=>window.__idle.splice(0).forEach(callback=>callback()));
    const observed=await page.evaluate(()=>window.__observed);
    assert.ok(observed.includes('product'));assert.ok(!observed.includes('late-eager'));
    await page.evaluate(()=>window.__intersection([{target:document.querySelector('[data-probe=product]'),isIntersecting:true}]));
    await page.waitForTimeout(20);
    await page.evaluate(()=>window.__intersection([{target:document.querySelector('[data-probe=product]'),isIntersecting:false}]));
    await page.waitForTimeout(70);assert.equal(await count(page,'/probe-product/'),0,'short visibility cancels the 50ms dwell');
    await page.evaluate(()=>window.__intersection([{target:document.querySelector('[data-probe=product]'),isIntersecting:true}]));
    await page.waitForTimeout(80);assert.equal(await count(page,'/probe-product/'),1);
    assert.ok((await page.evaluate(()=>window.__unobserved)).includes('product'));
    assert.equal(await count(page,'/probe-dynamic/'),0);await late.dispatchEvent('focusin');assert.equal(await count(page,'/probe-dynamic/'),1);
    return observed;
  }},{id:'actual-viewport-scroll',hasTouch:true,isMobile:true,run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);
    await page.addInitScript(()=>{
      const match=window.matchMedia.bind(window);
      window.matchMedia=query=>query==='(hover: none) and (pointer: coarse)'?{matches:true}:match(query);
    });
    await visit(page,baseUrl);await page.waitForTimeout(100);
    assert.equal(await count(page,'/probe-product/'),0,'offscreen initial eager nodes must wait');
    await page.locator('[data-probe=product]').evaluate(node=>node.scrollIntoView({block:'center'}));
    await page.waitForFunction(()=>window.__swbanPrefetchTrace.links.some(href=>new URL(href).pathname==='/probe-product/'));
    assert.equal(await count(page,'/probe-product/'),1,'real scrolling supplies the qualifying viewport observation');
  }}]);
});

test('worker selection is bounded, matches Banyan, and rolls back known sends',{timeout:45000},async()=>{
  await scenarios('workers',full,[{id:'ready-does-not-block-selection',run:async({page,baseUrl})=>{
    await page.addInitScript(noNative);await page.addInitScript(recordRuntime);
    await page.addInitScript(()=>{
      Object.defineProperty(navigator.serviceWorker,'ready',{value:new Promise(()=>{}),configurable:true});
      navigator.serviceWorker.getRegistration=()=>new Promise(()=>{});
    });
    const began=Date.now(),state=await visit(page,baseUrl,'auto');
    assert.equal(state.backend,'link');assert.ok(Date.now()-began<2000,'lookup timeout must not wait for .ready');
    assert.equal(await count(page,'/probe-file/'),1);return state;
  }},{id:'actual-worker-and-retry',serviceWorkers:'allow',run:async({page,baseUrl})=>{
    await page.addInitScript(noNative);await page.addInitScript(recordRuntime);
    assert.equal((await visit(page,baseUrl,'auto')).backend,'link','first document has no active registration');
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.banyanPrefetchState.reason!=='selecting');
    assert.equal((await page.evaluate(()=>window.banyanPrefetchState)).backend,'sw');
    assert.equal(await count(page,'/probe-file/','messages'),1);
    await page.evaluate(()=>{
      const post=ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage=function(message,...args){
        if(message?.urls?.some(href=>new URL(href).pathname==='/probe-folder/'))throw new Error('known send failure');
        return post.call(this,message,...args);
      };
      window.__restorePost=()=>{ServiceWorker.prototype.postMessage=post;};
    });
    await page.locator('[data-probe=folder]').dispatchEvent('focusin');
    assert.equal((await page.evaluate(()=>window.banyanPrefetchState)).failures,1);
    await page.evaluate(()=>window.__restorePost());await page.locator('[data-probe=folder]').dispatchEvent('focusin');
    assert.equal(await count(page,'/probe-folder/','messages'),1);
    assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(key=>key.startsWith('banyan-prefetch'))),false);
    await visit(page,baseUrl,'sw');assert.equal((await page.evaluate(()=>window.banyanPrefetchState)).backend,'sw');
    for(const backend of ['off','native','link']) {
      await visit(page,baseUrl,backend);await page.waitForTimeout(60);
      assert.deepEqual(await page.evaluate(()=>window.__swbanPrefetchTrace.messages),[],
        'Registration must not send an implicit current-page warmup in '+backend+' mode.');
    }
    return page.evaluate(()=>window.banyanPrefetchState);
  }},{id:'third-party-worker-is-not-banyan',serviceWorkers:'allow',run:async({page,baseUrl})=>{
    await page.addInitScript(noNative);await page.addInitScript(recordRuntime);
    await visit(page,baseUrl,'auto');await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.evaluate(()=>navigator.serviceWorker.register('/foreign-worker.js',{scope:'/'}));
    await page.waitForFunction(()=>navigator.serviceWorker.getRegistration('/').then(registration=>
      registration?.active?.scriptURL.endsWith('/foreign-worker.js')&&registration.active.state==='activated'));
    assert.equal((await visit(page,baseUrl,'auto')).backend,'link');
    return page.evaluate(()=>window.banyanPrefetchState);
  }},{id:'prerender-registration-waits-for-activation',serviceWorkers:'allow',run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);
    await page.addInitScript(()=>{
      Object.defineProperty(document,'prerendering',{value:true,writable:true,configurable:true});
      const register=navigator.serviceWorker.register.bind(navigator.serviceWorker);
      window.__registrationCalls=0;
      navigator.serviceWorker.register=(...args)=>{window.__registrationCalls+=1;return register(...args);};
    });
    await visit(page,baseUrl,'auto');await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.__registrationCalls),0);
    assert.deepEqual(await page.evaluate(()=>window.__swbanPrefetchTrace.messages),[]);
    await page.evaluate(()=>{document.prerendering=false;document.dispatchEvent(new Event('prerenderingchange'));});
    await page.waitForFunction(()=>window.__registrationCalls===1);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>navigator.serviceWorker.getRegistration('/').then(registration=>registration?.active?.state==='activated'));
    assert.deepEqual(await page.evaluate(()=>window.__swbanPrefetchTrace.messages),[],'Activation must not warm the current page.');
    assert.equal(await page.evaluate(()=>window.__registrationCalls),1,'Activation registers the worker once.');
  }}]);
});

test('DCL and restored from/sort paths gate every shared candidate',{timeout:30000},async()=>{
  const blocked=output('blocked-ready');
  for(const route of [probePage,debugPage,'/d/prefetch-scopes/child/one/','/d/prefetch-scopes/child/']) {
    const file=path.join(blocked,route,'index.html');
    write(file,fs.readFileSync(file,'utf8').replace('</body>','<script defer src="/prefetch-blocker.js"></script></body>'));
  }
  await scenarios('ready',blocked,[{id:'native-and-custom-before-dcl',run:async({page,baseUrl})=>{
    await page.addInitScript(recordRuntime);
    const session=await page.context().newCDPSession(page),requests=[],attempts=[];
    session.on('Network.requestWillBeSent',event=>{if(new URL(event.request.url).pathname.startsWith('/probe-'))requests.push(event.request.url);});
    session.on('Preload.preloadingAttemptSourcesUpdated',event=>attempts.push(...event.preloadingAttemptSources??[]));
    await session.send('Network.enable');await session.send('Preload.enable');
    try {
      for(const route of [probePage,debugPage+'?prefetch-backend=link','/d/prefetch-scopes/child/one/#from=%2Fd%2Fprefetch-scopes%2Fchild%2F&sorts=name-desc,date-asc',
        '/d/prefetch-scopes/child/#sort=name-desc']) {
        let release,started;const gate=new Promise(resolve=>{release=resolve;}),requested=new Promise(resolve=>{started=resolve;});
        await page.route('**/prefetch-blocker.js',async route=>{started();await gate;await route.fulfill({contentType:'text/javascript',body:''});});
        await page.goto(new URL(route,baseUrl).href,{waitUntil:'commit'});await requested;
        await page.waitForFunction(()=>document.readyState==='interactive'&&document.getElementById('site-prefetch-rules'));
        const before=await page.evaluate(()=>({
          ready:document.documentElement.hasAttribute('data-prefetch-ready'),
          matches:JSON.parse(document.getElementById('site-prefetch-rules').textContent)
            .prefetch.flatMap(rule=>[...document.querySelectorAll(rule.selector)]).length,
          recorded:window.__swbanPrefetchTrace
        }));
        assert.deepEqual(before,{ready:false,matches:0,recorded:{links:[],messages:[]}});
        assert.deepEqual(requests,[]);assert.deepEqual(attempts,[]);
        release();await page.waitForLoadState('load');await page.unroute('**/prefetch-blocker.js');
        await page.waitForFunction(()=>window.banyanPrefetchState?.reason!=='selecting');
        assert.equal((await runtimeState(page)).ready,true);
        assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-entry-breadcrumb-pending')||
          document.documentElement.hasAttribute('data-breadcrumb-sort-pending')),false);
        if(route.endsWith('#sort=name-desc')) {
          const order=await page.locator('main [data-list-entry][href]').evaluateAll(nodes=>nodes.map(node=>new URL(node.href).pathname)
            .filter(href=>/^\/d\/prefetch-scopes\/child\/(one|two)\/$/.test(href)));
          assert.deepEqual(order,['/d/prefetch-scopes/child/two/','/d/prefetch-scopes/child/one/'],'sorting is complete before candidate activation');
        }
        await page.waitForTimeout(100);
        requests.length=0;attempts.length=0;
      }
    }finally{await session.detach();}
  }}]);
});

test('two-ended scopes resolve columns and prerender independently',{timeout:30000},async()=>{
  const accepted=passed('rules',columns,['--eager','folder/tail,folder/root+2']);
  assert.equal(accepted.enabled,true);
  await scenarios('columns',columns,[{id:'column-positions-and-overlap',run:async({page,baseUrl})=>{
    await visit(page,baseUrl,'off');
    const inspect=async(collection,pathCount)=>page.evaluate(({collection,pathCount})=>{
      const anchor=(name,folder=true)=>'<a data-list-entry data-probe="'+name+'" href="/probe-'+name+'/"><span class="item-icon"><svg class="icon icon-'+(folder?'folder':'file')+'"></svg></span>'+name+'</a>';
      document.querySelectorAll('[data-root-navigation],[data-slot="breadcrumb"],[data-slot="main"],[data-column-probe]').forEach(node=>node.remove());
      const panel=document.createElement('div');panel.dataset.columnProbe='';
      panel.innerHTML='<nav data-root-navigation>'+anchor('root')+'</nav>'+
        '<nav data-slot="breadcrumb">'+Array.from({length:pathCount},(_,i)=>'<div class="path-column">'+anchor('path-'+i)+'</div>').join('')+'</nav>'+
        '<main data-slot="main" class="'+(collection?'slot-main--collection':'')+'">'+anchor('main')+anchor('file',false)+'</main>'+
        '<aside>'+anchor('aside')+'</aside>';
      document.body.appendChild(panel);
      const selectors=JSON.parse(document.getElementById('site-prefetch-rules').textContent);
      const config=JSON.parse(document.getElementById('site-prefetch-data').textContent);
      return Object.fromEntries([...panel.querySelectorAll('a')].map(node=>[node.dataset.probe,
        Object.fromEntries(['prefetch','prerender'].map(kind=>{
          const matched=selectors[kind].filter(rule=>node.matches(rule.selector));
          if(matched.length>1)throw new Error('Overlapping '+kind+' selectors on '+node.dataset.probe);
          const id=matched[0]?.id;
          return [kind,id?{id,mode:(kind==='prefetch'?config.modes:config.prerender)[id]}:null];
        }))]));
    },{collection,pathCount});
    let result=await inspect(true,1);
    assert.deepEqual(result.root.prefetch,{id:'folder/root',mode:'off'});
    assert.deepEqual(result['path-0'].prefetch,{id:'folder/tail-1',mode:'moderate'},'tail offset wins over root offset');
    assert.deepEqual(result.main.prefetch,{id:'folder/tail',mode:'eager'},'tail anchor wins over root offset');
    assert.deepEqual(result['path-0'].prerender,{id:'folder/tail-1',mode:'eager'});
    assert.equal(result.root.prerender,null,'base off prevents root prerender');
    assert.deepEqual(result.file.prefetch,{id:'default',mode:'off'});
    assert.deepEqual(result.aside.prefetch,{id:'folder/all',mode:'conservative'},'aside is outside column numbering');
    result=await inspect(true,3);
    assert.deepEqual(result['path-0'].prefetch,{id:'folder/root+1',mode:'immediate'});
    assert.deepEqual(result['path-0'].prerender,{id:'folder/root+1',mode:'immediate'});
    assert.deepEqual(result['path-1'].prefetch,{id:'folder/tail-2',mode:'off'});
    assert.equal(result['path-1'].prerender,null,'base off defeats a different prerender scope');
    assert.deepEqual(result['path-2'].prefetch,{id:'folder/tail-1',mode:'moderate'});
    result=await inspect(false,3);
    assert.deepEqual(result['path-0'].prefetch,{id:'folder/tail-2',mode:'off'});
    assert.deepEqual(result['path-1'].prefetch,{id:'folder/tail-1',mode:'moderate'});
    assert.deepEqual(result['path-2'].prefetch,{id:'folder/tail',mode:'eager'});
    assert.deepEqual(result.main.prefetch,{id:'folder/all',mode:'conservative'},'article body does not become tail');
    result=await inspect(true,0);
    assert.equal(result.root.prefetch.id,'folder/root');
    assert.equal(result.main.prefetch.id,'folder/tail');
    result=await inspect(false,0);
    assert.deepEqual(result.root.prefetch,{id:'folder/root',mode:'off'},'root wins when root is also tail');
    assert.equal(result.root.prerender,null);
    for(const item of Object.values(result))
      for(const rule of Object.values(item))
        assert.ok(!rule||!['folder/root+12','folder/tail-12'].includes(rule.id),'out-of-range offsets do not match');
    const html=fs.readFileSync(path.join(splitColumns,debugPage,'index.html'),'utf8');
    for(const id of ['site-prefetch-data','site-prefetch-rules']) {
      const text=html.match(new RegExp('<script\\b[^>]*'+id+'[^>]*>([\\s\\S]*?)<\\/script>'))[1];
      await page.locator('#'+id).evaluate((node,text)=>{node.textContent=text;},text);
    }
    result=await inspect(true,1);
    assert.deepEqual(result['path-0'].prefetch,{id:'folder/root+1',mode:'eager'});
    assert.deepEqual(result['path-0'].prerender,{id:'folder/tail-1',mode:'moderate'},'prerender-only offsets do not replace base modes');
    result=await inspect(true,3);
    assert.equal(result['path-0'].prefetch.id,'folder/root+1');
    assert.equal(result['path-0'].prerender,null);
    assert.equal(result['path-2'].prerender,null,'prerender scope remains blocked where base all is off');
    return {collectionDepths:[0,1,3],articleDepths:[0,3],independentProfiles:true};
  }}]);
});
