import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {discoverSite} from '../.agents/skills/swaw-banyan/tasks/check/browser/site/discover.mjs';
import {fixtureEnvironment,fixtureContentDirectory,fixtureSiteFiles,fixtureSitePages,writeDelivery,fixtureDelivery,serviceWorkerPolicy} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {loadChromium} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),skill=path.join(root,'.agents/skills/swaw-banyan');
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-site');
let work,source,build;
function write(directory,file,text){const target=path.join(directory,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);}
function cli(directory,args=[],cwd=work) {
  const result=spawnSync(process.execPath,[path.join(skill,'tasks/check/browser/site/entry.mjs'),directory,...args],
    {cwd,encoding:'utf8',timeout:120000,windowsHide:true});
  assert.ifError(result.error);return result;
}
function report(result){return JSON.parse(fs.readFileSync(result.stdout.match(/JSON report: (.+)/)[1].trim(),'utf8'));}
function snapshot(directory){return fs.readdirSync(directory,{recursive:true}).sort().filter(file=>fs.statSync(path.join(directory,file)).isFile())
  .map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(directory,file))).digest('hex')]);}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-site-'));
  source=path.join(work,'source with spaces 树');
  fixtureSiteFiles(source);
  fixtureSitePages(source,['appearance','language','my','_res','rss','powered-by']);
  const config='disableLanguages = ["ar"]\n'+fs.readFileSync(path.join(root,'hugo.toml'),'utf8');
  write(source,'hugo.toml',config);
  writeDelivery(path.join(source,'assets'),fixtureDelivery(serviceWorkerPolicy('enable')));
  write(source,'go.mod','module fixture.invalid/site\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\nreplace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(root,'module').replaceAll('\\','/'))+'\n');
  let panel=fs.readFileSync(path.join(root,'content/powered-by/index.md'),'utf8');
  panel=panel.replace(/^url:.*$/m,'url: /prefs/update/\n');
  write(source,'content/powered-by/index.md',panel);
  fixtureContentDirectory(path.join(source,'content'));
  for(const suffix of ['','.zh','.ar']) {
    write(source,'content/_index'+suffix+'.md','---\ntitle: Independent site\ndescription: A browser discovery fixture.\nlayout: page-home\n---\n\n{{< home-art "/_res/home-art/wind" >}}\n');
    for(const [name,title,date] of [['first','First Article','2026-01-01'],['second','Second Article','2026-01-02']])
      write(source,'content/d/'+name+suffix+'.md','---\ntitle: '+title+'\nurl: p/'+name+'-article/\nweight: 2\ndate: '+date+'\n---\n\nArticle for collection sorting.');
  }
  build=path.join(work,'published');
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',build],
    {cwd:source,env:fixtureEnvironment(path.join(work,'first-build')),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('site discovery uses actual translated paths, source links and sort data',async()=>{
  const found=await discoverSite(build);
  assert.equal(found.panel,'/prefs/update/');
  assert.equal(found.collection,'/all/','The sorting check needs article links with an explicit source.');
  assert.equal(found.offline,'/');assert.ok(found.prose);assert.equal(found.from,'/');
  const tiny=path.join(work,'tiny');
  write(tiny,'index.html','<html lang=en><body><main class=slot-main>Home</main></body></html>');
  write(tiny,'reader/deep/index.html','<html lang=en><body><article class=prose>Reader</article></body></html>');
  write(tiny,'404.html','<html lang=en><body><article class=prose>Error</article></body></html>');
  write(tiny,'redirect/index.html','<meta http-equiv=refresh content="0;url=/reader/deep/">');
  const minimal=await discoverSite(tiny);
  assert.equal(minimal.pages,2);assert.equal(minimal.prose,'/reader/deep/');assert.equal(minimal.collection,null);
  assert.equal(minimal.rules,false);
  write(tiny,'index.html','<html lang=en><body><script id=site-speculation-rules type=speculationrules>{}</script></body></html>');
  const empty=await discoverSite(tiny);
  assert.equal(empty.rules,true);assert.equal(empty.rulesByPage['/'],true);
  assert.equal(empty.overlap,null,'An empty rule block does not enable native prefetch.');
  write(tiny,'index.html','<html lang=en><body><script id=site-speculation-rules type=speculationrules>{"prefetch":[{}]}</script></body></html>');
  assert.equal((await discoverSite(tiny)).rules,true,'Inline rules must be discovered per page.');
  const runtime=path.join(work,'runtime');fs.cpSync(tiny,runtime,{recursive:true});
  write(runtime,'custom/diagnostics/index.html',`<html lang=en><body data-prefetch-debug>
    <script id=site-prefetch-data type=application/json>{"enabled":true,"modes":{"folder/root":"moderate","default":"immediate"},"prerender":{},"sw":{"enabled":false,"url":"/sw.js","scope":"/"}}</script>
    <script id=site-speculation-rules type=speculationrules>{"prefetch":[{}]}</script>
    <script id=site-prefetch-rules type=application/json>{"prefetch":[{"id":"folder/root","selector":"html[data-prefetch-ready] [data-root-navigation] a:has(> .item-icon > svg.icon-folder)"},{"id":"default","selector":"html[data-prefetch-ready] a:not(:has(> .item-icon > svg.icon-folder))"}],"prerender":[]}</script>
    <pre id=prefetch-debug-support></pre><nav data-root-navigation><a href=/other/><span class=item-icon><svg class=icon-folder></svg></span>Owned</a></nav>
    <a href=/reader/deep/>Unowned</a></body></html>`);
  const coordinated=await discoverSite(runtime);
  assert.equal(coordinated.overlap,'/custom/diagnostics/');assert.equal(coordinated.debug,'/custom/diagnostics/');
  fs.appendFileSync(path.join(runtime,'custom/diagnostics/index.html'),'<a href=/other/>Also unowned</a>');
  assert.equal((await discoverSite(runtime)).overlap,'/custom/diagnostics/','Backend exclusion is checked by the browser leaf.');
  const nativeOnly=fs.readFileSync(path.join(runtime,'custom/diagnostics/index.html'),'utf8').replace(/<script id=site-prefetch-data[^>]*>[\s\S]*?<\/script>/,'');
  write(runtime,'custom/diagnostics/index.html',nativeOnly);
  const nativeFound=await discoverSite(runtime);
  assert.equal(nativeFound.overlap,null);assert.equal(nativeFound.debug,'/custom/diagnostics/','Native-only diagnostics remain discoverable.');
});

test('site checks reuse one build, report skipped coverage and retain failures',{timeout:120000},()=>{
  const tiny=path.join(work,'smoke'),inline='document.title="A custom site";',hash=createHash('sha256').update(inline).digest('base64');
  write(tiny,'index.html','<html lang=en><head><title>Custom</title></head><body><main class=slot-main>Home</main><script>'+inline+'</script></body></html>');
  write(tiny,'_headers',"/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-"+hash+"'\n");
  const before=snapshot(tiny),result=cli(tiny,['--out',path.join(work,'reports')]),saved=report(result);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(saved.totals.passed,3);assert.equal(saved.totals.failed,0);
  assert.ok(saved.scenarios.find(item=>item.id==='prose-layout').status==='skipped');
  assert.match(saved.scenarios.find(item=>item.id==='pwa-lifecycle').message,/not enabled/);
  assert.deepEqual(snapshot(tiny),before);
  const broken=path.join(work,'broken');fs.cpSync(tiny,broken,{recursive:true});
  fs.appendFileSync(path.join(broken,'index.html'),'<script>window.blocked=true;</script>');
  const failed=cli(broken,['--out',path.join(work,'failures')]),failure=report(failed);
  assert.equal(failed.status,1);assert.ok(failure.scenarios.some(item=>item.id==='csp'&&item.status==='failed'));
  assert.ok(failure.scenarios.find(item=>item.id==='csp').artifacts.screenshot);
  assert.equal(failure.scenarios.find(item=>item.id==='prefetch-rules-home').status,'passed');
  const unavailable=cli(tiny,['--updates']);assert.equal(unavailable.status,1);assert.match(unavailable.stderr,/SW-enabled/);
  const nested=path.join(tiny,'reports');assert.equal(cli(tiny,['--out',nested]).status,1);assert.equal(fs.existsSync(nested),false);
});

test('site checks follow a deployment subdirectory and language home',{timeout:120000},async()=>{
  const file=path.join(source,'assets/deploy/policy.toml'),original=fs.readFileSync(file,'utf8');
  const destination=path.join(work,'subdirectory-build');
  let server,browser;
  try {
    fs.writeFileSync(file,original.replace(/^(\s*path\s*=\s*")\//gm,'$1/blog/'));
    write(source,'subdirectory.toml','defaultContentLanguageInSubdir = true\n');
    const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,subdirectory.toml',
      '--baseURL','https://example.test/blog/','--destination',destination],
      {cwd:source,env:fixtureEnvironment(work),encoding:'utf8',windowsHide:true,timeout:60000});
    assert.equal(result.status,0,result.stdout+result.stderr);
    const checked=cli(destination,['--out',path.join(work,'subdirectory-report')]);
    assert.equal(checked.status,0,checked.stdout+checked.stderr);
    const summary=report(checked);assert.equal(summary.discovery.home,'/blog/en/');
    assert.equal(summary.scenarios.find(result=>result.id==='pwa-offline').status,'passed');
    server=await createStaticSiteServer(destination);await server.start();
    const chromium=loadChromium();browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
    const page=await browser.newPage();await page.goto(server.getBaseUrl()+'/blog/en/');
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),null,{timeout:15000});
    assert.equal(await page.evaluate(async()=>new URL((await navigator.serviceWorker.getRegistration()).scope).pathname),'/blog/');
    fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('mode = "enable"','mode = "disable"'));
    const disabled=path.join(work,'subdirectory-disabled');
    const disableBuild=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,subdirectory.toml',
      '--baseURL','https://example.test/blog/','--destination',disabled],
      {cwd:source,env:fixtureEnvironment(work),encoding:'utf8',windowsHide:true,timeout:60000});
    assert.equal(disableBuild.status,0,disableBuild.stdout+disableBuild.stderr);
    for(const pageArgs of [[],['--page','/blog/en/']]) {
      const cleanup=spawnSync(process.execPath,[path.join(skill,'tasks/check/browser/pwa/disable/entry.mjs'),destination,'--next',disabled,...pageArgs,'--out',path.join(work,'subdirectory-cleanup')],{cwd:work,encoding:'utf8',timeout:60000,windowsHide:true});
      assert.ifError(cleanup.error);assert.equal(cleanup.status,0,cleanup.stdout+cleanup.stderr);
    }
    await server.setRoot(disabled);
    const next=await browser.newPage();await next.goto(server.getBaseUrl()+'/blog/en/');
    await next.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()),null,{timeout:15000});
  } finally {await browser?.close();await server?.stop();fs.writeFileSync(file,original);fs.rmSync(path.join(source,'subdirectory.toml'),{force:true});}
});

test('site browser checks accept a published empty speculation-rules block',{timeout:30000},()=>{
  const tiny=path.join(work,'empty-rules'),rules='{}',hash=createHash('sha256').update(rules).digest('base64');
  write(tiny,'index.html','<html lang=en><head><title>Empty rules</title></head><body><main class=slot-main>Home</main><script id=site-speculation-rules type=speculationrules>'+rules+'</script></body></html>');
  write(tiny,'_headers',"/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-"+hash+"'\n");
  const result=cli(tiny,['--out',path.join(work,'empty-rules-reports')]),saved=report(result);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(saved.scenarios.find(item=>item.id==='prefetch-rules-home').status,'passed');
});

test('site --updates builds a temporary program revision, runs real SW checks and removes generated files',{timeout:120000},()=>{
  const original=snapshot(source),published=snapshot(build);
  const result=cli(build,['--updates','--site',source,'--out',path.join(work,'updates')]),saved=report(result);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(saved.discovery.panel,'/prefs/update/');assert.ok(saved.temporaryUpgradeBuild);
  for(const id of ['pwa-offline','pwa-lifecycle','pwa-check','pwa-native'])
    assert.equal(saved.scenarios.find(item=>item.id===id).status,'passed',id);
  assert.equal(fs.existsSync(saved.upgradeToDir),false,'Temporary next output must be removed.');
  assert.deepEqual(snapshot(source),original);assert.deepEqual(snapshot(build),published);
  const temporary=fs.readdirSync(os.tmpdir()).filter(name=>name.startsWith('swban-site-build-')).sort();
  const failed=cli(build,['--updates','--site',path.join(work,'missing-source'),'--out',path.join(work,'build-failure')]);
  assert.equal(failed.status,1);assert.match(failed.stderr,/Temporary Hugo build failed/);
  assert.deepEqual(fs.readdirSync(os.tmpdir()).filter(name=>name.startsWith('swban-site-build-')).sort(),temporary);
});

test('site discovers enabled automatic prefetch and runs browser rule and diagnostic checks',{timeout:60000},async()=>{
  const directory=path.join(work,'prefetch-build');
  writeDelivery(path.join(source,'assets'),fixtureDelivery(serviceWorkerPolicy('enable')+
    '[prefetch]\nenabled = true\ndefault = "conservative"\n[prefetch.prerender]\ndefault = "off"\n'));
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',directory],
    {cwd:source,env:fixtureEnvironment(path.join(work,'prefetch-work')),
    encoding:'utf8',timeout:30000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  const found=await discoverSite(directory);
  assert.equal(found.rules,true);assert.ok(found.debug);assert.ok(found.overlap);
  const checked=cli(directory,['--out',path.join(work,'prefetch-reports')]),saved=report(checked);
  assert.equal(checked.status,0,checked.stdout+checked.stderr);
  for(const id of ['prefetch-rules-home','prefetch-rules-collection','prefetch-rules-debug','prefetch-overlap','prefetch-debug'])
    assert.equal(saved.scenarios.find(item=>item.id===id).status,'passed',id);
});
