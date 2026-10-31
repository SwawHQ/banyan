import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureContentDirectory,fixtureSiteMounts} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {loadChromium,loadWebkit} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {check as checkTouch} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/touch/check.mjs';
import {check as checkTouchFree} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/touch/free.mjs';
import {check as checkOpening} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/open/check.mjs';
import {check as checkLayout,checkStaticLayout} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/layout/check.mjs';
import {check as checkCollection} from '../.agents/skills/swaw-banyan/tasks/check/browser/collection/layout/check.mjs';
import {check as checkHeader} from '../.agents/skills/swaw-banyan/tasks/check/browser/breadcrumb/header/check.mjs';
import {check as checkScrollbar} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/scrollbar/check.mjs';
import {check as checkAsideLayout} from '../.agents/skills/swaw-banyan/tasks/check/browser/aside/layout/check.mjs';
import {check as checkAsideToggle} from '../.agents/skills/swaw-banyan/tasks/check/browser/aside/toggle/check.mjs';
import {check as checkAsideStyle} from '../.agents/skills/swaw-banyan/tasks/check/browser/aside/style/check.mjs';
import {check as checkPrint} from '../.agents/skills/swaw-banyan/tasks/check/browser/aside/print/check.mjs';
import {assertChoices} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/choices/check.mjs';
import {wheelCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/wheel/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),skill=path.join(root,'.agents/skills/swaw-banyan');
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/canvas-wheel');
const article='/d/wheel-long/',short='/d/wheel-short/';
let work,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(suffix='',directory=output,prefix=''){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks/check/browser/canvas/wheel'+suffix+'/entry.mjs'),directory,
    '--page',prefix+article,'--short',prefix+short,'--widths','390,1440'],{cwd:work,encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);return result;
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'fixture-'));output=path.join(work,'public');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  fixtureContentDirectory(content);
  const front=(title,url)=>'---\ntitle: '+title+'\nurl: '+url+'\ndate: "2026-10-01T00:00:00+08:00"\n---\n\n';
  let body='A long article for horizontal wheel and native touch checks.\n\n';
  body+='```text\n'+('wide-code-'.repeat(140))+'\n```\n\n';
  body+='| Wide table | Value |\n| --- | --- |\n| '+('WideTable'.repeat(140))+' | Content |\n\n';
  for(let index=0;index<24;index++)body+='## Chapter '+index+'\n\n'+('Reading text that makes this column scroll vertically without moving the surrounding canvas.\n\n'.repeat(8));
  write(path.join(content,'d/wheel-long.md'),front('Wheel long article',article)+body);
  write(path.join(content,'d/wheel-short.md'),front('Wheel short article',short)+'Short reading text.\n\n[Read the long article]('+article+')\n');
  fs.copyFileSync(path.join(content,'d/_index.md'),path.join(content,'d/_index.ar.md'));
  write(path.join(content,'d/wheel-long.ar.md'),front('مقال طويل','/ar'+article)+body);
  write(path.join(content,'d/wheel-long.zh.md'),front('长文章','/zh'+article)+body);
  write(path.join(content,'d/wheel-short.ar.md'),front('مقال قصير','/ar'+short)+'نص قصير.\n\n[قراءة المقال الطويل](/ar'+article+')\n');
  write(config,'[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n'+
    '[[module.mounts]]\nsource = "content"\ntarget = "content"\n'+fixtureSiteMounts);
  const built=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(built.error);assert.equal(built.status,0,built.stdout+built.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('wheel check validates local pages and widths before opening a browser',()=>{
  const spec=wheelCommand('check/browser/canvas/wheel');
  assert.throws(()=>parseArguments(spec,['--page',article]),/--short is required/);
  assert.throws(()=>parseArguments(spec,['--page','https://outside.invalid/','--short',short]),/local site/);
  assert.throws(()=>parseArguments(spec,['--page',article,'--short',short,'--widths','390,390']),/distinct integers/);
  assert.equal(parseArguments(spec,['--page',article,'--short',short]).widths,'390,1440');
  assert.match(helpFor(spec,'en'),/--short/);
});

for(const [name,suffix] of [['Chromium',''],['WebKit','.webkit']]) {
  test(name+' keeps static home and long articles reachable in English, Chinese and Arabic',{timeout:45000},async()=>{
    const server=await createStaticSiteServer(output);let browser;
    try {
      await server.start();const type=name==='Chromium'?loadChromium():loadWebkit();
      browser=await type.launch({headless:true,executablePath:type.executablePath()});
      for(const prefix of ['','/zh','/ar'])for(const route of ['/',article]) {
        const state=await checkStaticLayout({browser,baseUrl:server.getBaseUrl(),options:{page:prefix+route,widths:'390,1440'}});
        assert.deepEqual(state.noScript.map(sample=>sample.width),[390,1440]);
        assert.equal(state.noScriptMobile.width,390);assert.equal(state.noScriptMobile.mobile,true);
        assert.equal(state.noScriptMobile.initial.direction,prefix==='/ar'?'rtl':'ltr');
        if(name==='Chromium')assert.ok(state.noScriptMobile.native.gestures>0,'Narrow static pages must exercise native horizontal input.');
        else assert.match(state.noScriptMobile.native.skipReason,/Native mobile gestures are unavailable/);
      }
    } finally {try{await browser?.close();}finally{await server.stop();}}
  });

  test(name+' rejects a static mobile first column moved outside the viewport',{timeout:15000},async()=>{
    const broken=path.join(work,'static-mobile-first-'+name);fs.cpSync(output,broken,{recursive:true});
    write(path.join(broken,'static-mobile.css'),'@media (scripting:none) and (pointer:coarse){html[dir=rtl] .page-rail{transform:translateX(100vw)}}');
    fs.appendFileSync(path.join(broken,'ar/index.html'),'<link rel="stylesheet" href="/static-mobile.css">');
    const server=await createStaticSiteServer(broken);let browser;
    try {
      await server.start();const type=name==='Chromium'?loadChromium():loadWebkit();
      browser=await type.launch({headless:true,executablePath:type.executablePath()});
      await assert.rejects(()=>checkStaticLayout({browser,baseUrl:server.getBaseUrl(),options:{page:'/ar/',widths:'1440'}}),
        /Static first content column must be visible on arrival/);
    } finally {try{await browser?.close();}finally{await server.stop();}}
  });

  test(name+' checks wheel locking, native clicks, demand-driven gap markers and light edge alignment',{timeout:65000},()=>{
    const result=cli(suffix);assert.equal(result.status,0,result.stdout+result.stderr);
  });
  test(name+' checks the same wheel behavior and canvas bounds in RTL',{timeout:65000},()=>{
    const result=cli(suffix,output,'/ar');assert.equal(result.status,0,result.stdout+result.stderr);
  });
  test(name+' preserves RTL list geometry and opening through native history',{timeout:45000},async()=>{
    const server=await createStaticSiteServer(output);let browser;
    try {
      await server.start();const type=name==='Chromium'?loadChromium():loadWebkit();
      browser=await type.launch({headless:true,executablePath:type.executablePath()});
      const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),baseUrl=server.getBaseUrl();
      context.setDefaultTimeout(5000);context.setDefaultNavigationTimeout(5000);
      const opened=await checkOpening({page,context,baseUrl,options:{from:'/ar/d/',page:'/ar'+article,widths:'390,1440'}});
      assert.ok(opened.cases[0].before.canvasOffsetX>0,'Opening must exercise a negative physical RTL scroll position.');
      await checkLayout({page,baseUrl,options:{page:'/ar'+article,widths:'390,1440'}});
      await checkCollection({page,baseUrl,options:{page:'/ar/d/',article:'/ar'+article,widths:'390,1440'}});
      await checkHeader({page,baseUrl,options:{page:'/ar'+article,widths:'390,1440',column:'/ar/d/'}});
      const title=page.locator('[data-slot=breadcrumb] .item-title').first();
      await title.evaluate(node=>{node.firstElementChild.textContent='اسم طويل لاختبار عرض العنوان '.repeat(40);});
      assert.ok(await title.evaluate(node=>node.scrollWidth>node.clientWidth&&getComputedStyle(node).textOverflow==='ellipsis'
        &&getComputedStyle(node).overflowX==='hidden'),'Long isolated titles must retain ellipsis.');
      await checkScrollbar({page,baseUrl,options:{page:'/ar'+article,widths:'390,1440'}});
      await checkAsideLayout({page,baseUrl,options:{page:'/ar'+article,widths:'390,1440'}});
      await page.evaluate(()=>localStorage.removeItem('banyan:document-aside-expanded'));
      await checkAsideStyle({page,baseUrl,options:{page:'/ar'+article,widths:'390'}});
      await checkPrint({page,baseUrl,options:{page:'/ar'+article}});
      await page.goto(baseUrl+'/ar/language/');await assertChoices(page,baseUrl);
      await page.evaluate(()=>localStorage.removeItem('banyan:document-aside-expanded'));
      await checkAsideToggle({page,baseUrl,options:{page:'/ar'+article,widths:'390'}});
      await context.close();
    } finally {try{await browser?.close();}finally{await server.stop();}}
  });
}
test('wheel check detects a missing tail space',{timeout:20000},()=>{
  const broken=path.join(work,'missing-tail');fs.cpSync(output,broken,{recursive:true});
  write(path.join(broken,'broken.css'),'.reading-group{min-inline-size:0!important}');
  fs.appendFileSync(path.join(broken,article,'index.html'),'<link rel="stylesheet" href="/broken.css">');
  const result=cli('',broken);assert.equal(result.status,1);assert.match(result.stderr,/tail|blank|padding|留白/i);
});
for(const prefix of ['','/ar']) {
test('native touch still pans roots, prose and metadata and restores history'+(prefix?' in RTL':''),{timeout:35000},async()=>{
  const server=await createStaticSiteServer(output);let browser;
  try {
    await server.start();const type=loadChromium();browser=await type.launch({headless:true,executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const page=await context.newPage();
    await checkTouch({page,context,baseUrl:server.getBaseUrl(),options:{page:prefix+article,next:prefix+short}});
    assert.notEqual(await page.locator('html').getAttribute('data-canvas-wheel'),'locked');
    await context.close();
  } finally {try{if(browser)await browser.close();}finally{await server.stop();}}
});

test('native touch aligns within 64px after inertia and preserves free positioning and wide columns'+(prefix?' in RTL':''),{timeout:30000},async()=>{
  const server=await createStaticSiteServer(output);let browser;
  try {
    await server.start();const type=loadChromium();browser=await type.launch({headless:true,executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const page=await context.newPage();
    await checkTouchFree({page,context,baseUrl:server.getBaseUrl(),options:{page:prefix+article}});
    await context.close();
  } finally {try{if(browser)await browser.close();}finally{await server.stop();}}
});
}
