import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/toolchain/operations.mjs';
import {choicesCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/choices/options.mjs';
import {returnCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/return/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';
import {inspect} from '../.agents/skills/swaw-banyan/tasks/check/html/scripts/inspect.mjs';
import {loadChromium} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {checkCanceledReturn} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/return/cancel.mjs';
import {checkOptionalLabels} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/return/labels.mjs';
import {check as checkBFCache} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/bfcache/check.mjs';
import {bfcacheCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/bfcache/options.mjs';
import {checkNewTabReturn} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/return/new-tab.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=fs.realpathSync(os.tmpdir());
const article='/d/language-fixture/first/#from=all&sorts=name-asc&anchor=details';
const untranslated='/d/language-fixture/untranslated/?probe=keep#details';
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/language/'+command,'entry.mjs'),directory,...args],{cwd:work,encoding:'utf8',timeout:45000});
  assert.ifError(result.error);return result;
}
function report(result){
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
function change(directory,route,edit){
  const file=path.join(directory,route,'index.html'),html=fs.readFileSync(file,'utf8'),next=edit(html);
  assert.notEqual(next,html,'Mutation must change the published fixture.');write(file,next);
}
function probe(directory,code,routes){
  write(path.join(directory,'probe.js'),code);
  for(const route of routes)change(directory,route,html=>html.replace('</head>','<script defer src="/probe.js"></script></head>'));
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-language-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime=process.versions.bun?'bun':'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun??process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  for(const lang of ['en','zh','zh-tw'])for(const name of ['first','second']){
    const prefix=lang==='en'?'':'/'+lang;
    write(path.join(content,'d/language-fixture',name+'.'+lang+'.md'),
      '---\ntitle: Independent '+lang+' '+name+'\nslug: language-'+name+'\nurl: '+prefix+'/d/language-fixture/'+name+'/\ndate: 2026-01-01\n---\n\n## Details\n\n'+('Independent language content.\n\n'.repeat(10)));
  }
  write(path.join(content,'d/language-fixture/untranslated.en.md'),
    '---\ntitle: Independent untranslated page\nslug: language-untranslated\nurl: /d/language-fixture/untranslated/\ndate: 2026-01-01\n---\n\n## Details\n\nUntranslated fixture content.');
  write(config,'[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n[languages.en.params.icon]\ntext = "AX"\n[languages.zh]\nlanguageName = "Independent target language"\n[languages.zh-tw.params.icon]\ntext = "繁"\n');
  const build=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(build.error);assert.equal(build.status,0,build.stdout+build.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('language options expose paths, target codes and source fragments',()=>{
  const spec=returnCommand('check/browser/language/return');
  assert.throws(()=>parseArguments(spec,[]),/--from is required/);
  assert.throws(()=>parseArguments(spec,['--from',article]),/--to is required/);
  assert.throws(()=>parseArguments(spec,['--from','https://example.invalid/','--to','zh']));
  assert.throws(()=>parseArguments(spec,['--from',article,'--to','../zh']));
  assert.equal(parseArguments(spec,['--from',article,'--to','zh']).from,article);
  assert.match(helpFor(spec,'en'),/--to <code>/);
  assert.match(helpFor(choicesCommand('check/browser/language/choices'),'en'),/default: \/language\//);
  const cached=bfcacheCommand('check/browser/language/bfcache');
  assert.equal(parseArguments(cached,['--from',article,'--to','zh','--next','zh-tw']).next,'zh-tw');
  assert.match(helpFor(cached,'en'),/Second target; default: source language/);
  assert.throws(()=>parseArguments(cached,['--from',article,'--to','zh','--next','../en']));
});

test('choices use real native links without JS and accessible translated settings',{timeout:45000},()=>{
  const state=report(cli('choices',['--page','/zh/language/','--trace','--out',path.join(work,'reports')]));
  assert.equal(state.browser,'chromium');assert.ok(state.browserVersion);
  assert.equal(state.details.staticCases.length,3);assert.equal(state.details.runtimeCases.length,3);
  assert.equal(fs.existsSync(path.join(work,'node_modules')),false);
});

test('return preserves source, sorting and fragment for articles and collections',{timeout:45000},()=>{
  const state=report(cli('return',['--from',article,'--to','zh','--out',path.join(work,'reports')]));
  assert.equal(state.details.returned,'/zh'+article);assert.equal(state.details.settings,'/zh/language/');
  const collection=report(cli('return',['--from','/zh/all/#sort=name-asc','--page','/zh/language/','--to','en','--out',path.join(work,'reports')]));
  for(const result of [state,collection]) {
    assert.deepEqual(result.details.visits.map(visit=>visit.locale).sort(),['en-US','zh-CN']);
    assert.ok(result.details.visits.every(visit=>visit.phases.length===4));
    assert.ok(result.details.visits.every(visit=>visit.phases.map(phase=>phase.navigation).join(',')==='navigate,reload,navigate,reload'));
    assert.equal(result.details.missingTranslation,false);assert.deepEqual(result.details.notices,[]);
    assert.equal(result.details.boundaries.tabs.writerPending,result.details.to);
    assert.equal(result.details.boundaries.canceled.returned,result.details.from);
    assert.equal(result.details.boundaries.storage.unavailable,true);
    assert.equal(result.details.boundaries.newTab.historyLength,1);
    assert.equal(result.details.boundaries.newTab.home,result.details.to==='zh'?'/zh/':'/');
  }
});

test('missing translations retain the source with one accessible localized notice per fresh choice',{timeout:30000},()=>{
  const state=report(cli('return',['--from',untranslated,'--to','zh','--trace','--out',path.join(work,'reports')]));
  assert.equal(state.details.returned,untranslated);assert.equal(state.details.missingTranslation,true);
  assert.equal(state.details.notices.length,2);
  assert.ok(state.details.notices.every(notice=>notice.label==='Independent target language'&&notice.text.includes(notice.label)));
  assert.equal(state.details.visits.length,1);assert.equal(state.details.boundaries.tabs.otherReturned,untranslated);
  assert.deepEqual(state.details.boundaries.labels.map(label=>label.kind),['partial-write','malformed','mismatched']);
  assert.ok(state.details.boundaries.labels.every(label=>label.label==='zh'&&label.text.includes('zh')));
  assert.equal(state.details.boundaries.newTab.home,'/zh/');
});

test('native language tabs reject intercepted middle-click, pushed choices and the wrong home',{timeout:20000},async()=>{
  for(const [name,code,routes,message] of [
    ['blocked-middle','document.addEventListener("auxclick",event=>event.preventDefault(),true);',['d/language-fixture/first'],/Timeout/],
    ['tab-pushed-choice','document.addEventListener("click",event=>{const link=event.target.closest("a[data-language-choice]");if(!link)return;event.preventDefault();event.stopImmediatePropagation();location.assign(link.href);},true);',['language','zh/language','zh-tw/language'],/must not add a previous page/],
    ['tab-wrong-home','document.addEventListener("DOMContentLoaded",()=>document.querySelector("[data-page-action=back]").href="/wrong-home/");',['language','zh/language','zh-tw/language'],/selected language home/]
  ]) {
    const broken=fixture(name);probe(broken,code,routes);
    const server=await createStaticSiteServer(broken),type=loadChromium();let browser;
    try {
      await server.start();browser=await type.launch({executablePath:type.executablePath()});
      const context=await browser.newContext({serviceWorkers:'block'});context.setDefaultTimeout(1500);context.setDefaultNavigationTimeout(1500);
      const page=await context.newPage(),base=server.getBaseUrl();
      await assert.rejects(checkNewTabReturn(page,new URL(article,base),new URL('/language/',base),'zh'),message);
    }finally{if(browser)await browser.close();await server.stop();}
  }
});

test('optional label checks reject stale display text instead of accepting another choice',{timeout:15000},async()=>{
  const broken=fixture('wrong-display-metadata');
  probe(broken,'let label;try{label=JSON.parse(sessionStorage.getItem("banyan:language-return-label"));}catch{}if(label?.name==="Unrelated display label")document.addEventListener("DOMContentLoaded",()=>requestAnimationFrame(()=>{const notice=document.querySelector("[data-language-return-notice]");if(notice)notice.textContent=label.name;}));',
    ['d/language-fixture/untranslated']);
  const server=await createStaticSiteServer(broken),type=loadChromium();let browser;
  try {
    await server.start();browser=await type.launch({executablePath:type.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'});context.setDefaultTimeout(1500);context.setDefaultNavigationTimeout(1500);
    const page=await context.newPage(),base=server.getBaseUrl();
    await assert.rejects(checkOptionalLabels(page,new URL(untranslated,base),new URL('/language/',base),'zh','en'),/selected language/);
  }finally{if(browser)await browser.close();await server.stop();}
});

test('BFCache returns require real restorations and preserve query, fragment and consumed state',{timeout:30000},()=>{
  const first=report(cli('bfcache',['--from',article,'--to','zh','--trace','--out',path.join(work,'reports')]));
  assert.equal(first.details.next,'en');assert.equal(first.details.returned,article);
  assert.deepEqual(first.details.events.filter(event=>event.persisted&&new URL(event.url).pathname.includes('language-fixture')).map(event=>new URL(event.url).pathname),
    ['/d/language-fixture/first/','/zh/d/language-fixture/first/']);
  const third=report(cli('bfcache',['--from',article,'--to','zh','--next','zh-tw','--out',path.join(work,'reports')]));
  assert.equal(third.details.returned,'/zh-tw'+article);
});

test('BFCache check rejects ordinary Back without a persisted restoration',{timeout:15000},async()=>{
  const server=await createStaticSiteServer(output),type=loadChromium();let browser;
  try {
    await server.start();browser=await type.launch({executablePath:type.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'});context.setDefaultTimeout(1500);context.setDefaultNavigationTimeout(1500);
    const page=await context.newPage();
    await assert.rejects(checkBFCache({page,baseUrl:server.getBaseUrl(),options:{from:article,to:'zh'}}),/actual pageshow.persisted/);
  }finally{if(browser)await browser.close();await server.stop();}
});

test('BFCache check detects a missing persisted-page language handler',{timeout:15000},()=>{
  const broken=fixture('blocked-pageshow');
  probe(broken,'addEventListener("pageshow",event=>{if(event.persisted)event.stopImmediatePropagation();});',
    ['d/language-fixture/first','zh/d/language-fixture/first']);
  const result=cli('bfcache',['--from',article,'--to','zh','--timeout','1500'],broken);
  assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/Timeout/);
});

test('missing returns reject missing, mislabeled and inaccessible notices',{timeout:45000},()=>{
  for(const [name,edit,message] of [
    ['absent-notice','notice?.remove()',/exactly one return notice/],
    ['wrong-label','if(notice)notice.textContent="Unknown language"',/visible name/],
    ['wrong-status','notice?.removeAttribute("role")',/accessible status/]
  ]) {
    const broken=fixture(name);
    probe(broken,'document.addEventListener("DOMContentLoaded",()=>requestAnimationFrame(()=>{const notice=document.querySelector("[data-language-return-notice]");'+edit+'}));',
      ['d/language-fixture/untranslated']);
    const result=cli('return',['--from',untranslated,'--to','zh'],broken);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('return detects choices shared across tabs and uncaught unavailable-storage failures',{timeout:45000},()=>{
  const shared=fixture('shared-tabs');
  probe(shared,`const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(key,value){set.call(this,key,value);if(this===sessionStorage&&key.startsWith('banyan:language-return'))set.call(localStorage,key,value);};
    Storage.prototype.removeItem=function(key){remove.call(this,key);if(this===sessionStorage&&key.startsWith('banyan:language-return'))remove.call(localStorage,key);};
    addEventListener('storage',event=>{if(event.key?.startsWith('banyan:language-return')&&event.newValue)set.call(sessionStorage,event.key,event.newValue);});`,
    ['d/language-fixture/first','zh/d/language-fixture/first','language','zh/language','zh-tw/language']);
  const leaked=cli('return',['--from',article,'--to','zh'],shared);
  assert.equal(leaked.status,1,leaked.stdout+leaked.stderr);assert.match(leaked.stderr,/Another tab must not receive/);
  const blocked=fixture('uncaught-storage');
  probe(blocked,'try{sessionStorage;}catch{document.addEventListener("click",event=>{if(event.target.closest("[data-language-choice]"))throw new Error("Uncaught storage failure");},true);}',
    ['language','zh/language','zh-tw/language']);
  const uncaught=cli('return',['--from',article,'--to','zh'],blocked);
  assert.equal(uncaught.status,1,uncaught.stdout+uncaught.stderr);assert.match(uncaught.stderr,/handle unavailable storage without uncaught errors/);
});

test('canceled choices cannot be revived by a later settings history visit',{timeout:15000},async()=>{
  const broken=fixture('revived-cancel');
  probe(broken,'if(performance.getEntriesByType("navigation")[0]?.type==="back_forward")sessionStorage.setItem("banyan:language-return","zh");',
    ['language','zh/language','zh-tw/language']);
  const server=await createStaticSiteServer(broken),type=loadChromium();let browser;
  try {
    await server.start();browser=await type.launch({executablePath:type.executablePath()});
    const context=await browser.newContext({serviceWorkers:'block'});context.setDefaultTimeout(1500);context.setDefaultNavigationTimeout(1500);
    const page=await context.newPage(),base=server.getBaseUrl();
    await assert.rejects(checkCanceledReturn(page,new URL(article,base),new URL('/language/',base),'zh','en'),/Timeout|canceled/i);
  } finally {if(browser)await browser.close();await server.stop();}
});

test('explicit visits reject locale redirects, prompts, wrong reload language and unconsumed state',{timeout:45000},()=>{
  const routes=['d/language-fixture/first','zh/d/language-fixture/first'];
  for(const [name,code,message] of [
    ['locale-redirect','document.addEventListener("DOMContentLoaded",()=>{if(navigator.language==="zh-CN"&&document.documentElement.lang==="en")requestAnimationFrame(()=>location.replace("/zh/d/language-fixture/first/"));});',/Explicit visits|Execution context was destroyed/],
    ['locale-prompt','document.addEventListener("DOMContentLoaded",()=>{if(navigator.language==="zh-CN")confirm("Change language?");});',/must not prompt/],
    ['reload-language','if(navigator.language==="zh-CN"&&performance.getEntriesByType("navigation")[0]?.type==="reload")document.documentElement.lang="zh";',/declared page language/],
    ['explicit-pending','const remove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key.startsWith("banyan:language-return"))return;return remove.call(this,key);};',/Explicit visits must consume/]
  ]) {
    const broken=fixture(name);probe(broken,code,routes);
    const result=cli('return',['--from',article,'--to','zh'],broken);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('choices reject disabled links, wrong names and incorrect current state',{timeout:30000},()=>{
  const disabled=fixture('disabled');change(disabled,'language',html=>html.replace('data-language-choice=zh ','data-language-choice=zh aria-disabled=true '));
  const result=cli('choices',[],disabled);assert.equal(result.status,1);assert.match(result.stderr,/enabled native link/);
  const name=fixture('accessible-name');change(name,'language',html=>html.replace('data-language-choice=zh ','data-language-choice=zh aria-label=Wrong '));
  const inaccessible=cli('choices',[],name);assert.equal(inaccessible.status,1);assert.match(inaccessible.stderr,/accessible language name/);
  const current=fixture('current');change(current,'language',html=>html.replace(/<a\b[^>]*data-language-choice=en[^>]*>/,
    tag=>tag.replace('aria-current=page','aria-current=false')));
  const missing=cli('choices',[],current);assert.equal(missing.status,1);assert.match(missing.stderr,/Exactly one language/);
});

test('choices reject pushed history and broken no-JS links',{timeout:30000},()=>{
  const history=fixture('pushed-history');
  probe(history,'document.addEventListener("click",event=>{const link=event.target.closest("a[data-language-choice]");if(!link)return;event.preventDefault();event.stopImmediatePropagation();location.assign(link.href);},true);',
    ['language','zh/language','zh-tw/language']);
  const pushed=cli('choices',[],history);assert.equal(pushed.status,1);assert.match(pushed.stderr,/replace the settings history entry/);
  const links=fixture('wrong-link');change(links,'language',html=>html.replace('href=/zh/language/','href=/language/'));
  const wrong=cli('choices',[],links);assert.equal(wrong.status,1);assert.match(wrong.stderr,/declared language/);
});

test('return rejects lost query/fragment, unconsumed state and unsuitable targets',{timeout:30000},()=>{
  const lost=fixture('lost-query');
  probe(lost,'if(performance.getEntriesByType("navigation")[0]?.type==="back_forward")history.replaceState(history.state,"",location.pathname);',
    ['d/language-fixture/first','zh/d/language-fixture/first']);
  const missing=cli('return',['--from',article,'--to','zh','--timeout','1500'],lost);
  assert.equal(missing.status,1);assert.match(missing.stderr,/Timeout|query and fragment/);
  const pending=fixture('pending-return');
  probe(pending,'if(performance.getEntriesByType("navigation")[0]?.type==="back_forward")sessionStorage.setItem("swban-return-fault","true");if(sessionStorage.getItem("swban-return-fault")){const remove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(key.startsWith("banyan:language-return"))return;return remove.call(this,key);};}',
    ['d/language-fixture/first','zh/d/language-fixture/first']);
  const uncleared=cli('return',['--from',article,'--to','zh'],pending);assert.equal(uncleared.status,1);assert.match(uncleared.stderr,/consume its pending/);
  const same=cli('return',['--from',article,'--to','en']);assert.equal(same.status,0,same.stdout+same.stderr);
  const unavailable=cli('return',['--from',article,'--to','fr']);assert.equal(unavailable.status,1);assert.match(unavailable.stderr,/Target language/);
});

test('HTML script boundaries follow page capabilities across all languages',{timeout:30000},async()=>{
  assert.deepEqual((await inspect(output)).issues,[]);
  const stray=fixture('stray-controller');
  const settings=fs.readFileSync(path.join(stray,'zh/language/index.html'),'utf8');
  const script=settings.match(/<script\b[^>]*src=[^>]*\/js\/preferences\/language-page[^>]*><\/script>/)?.[0];
  assert.ok(script,'Published settings must have their page controller.');
  change(stray,'',html=>html.replace('</body>',script+'</body>'));
  assert.ok((await inspect(stray)).issues.some(issue=>issue.includes('preferences/language-page')&&issue.includes('expected 0')));
  const missing=fixture('missing-controller');change(missing,'zh/language',html=>html.replace(script,''));
  assert.ok((await inspect(missing)).issues.some(issue=>issue.includes('preferences/language-page')&&issue.includes('expected 1')));
  for(const route of ['','language','zh/language','zh-tw/language'])assert.doesNotMatch(
    fs.readFileSync(path.join(output,route,'index.html'),'utf8'),/<body\b[^>]*\sdata-language-context(?:\s|=|>)/,
    'Theme output must not restore retired language context.');
  const global=fixture('global-controller'),main=fs.readFileSync(path.join(global,'index.html'),'utf8').match(/src=["']?(\/js\/main\.[^"' >]+)/)[1];
  fs.appendFileSync(path.join(global,main),'/* data-language-choice */');
  assert.ok((await inspect(global)).issues.some(issue=>issue.includes('stay out of shared bundle')));
});
