import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {panelCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/panel/options.mjs';
import {offlineCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/pwa/offline/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=fs.realpathSync(os.tmpdir());
const panel='/prefs/status/',from='/fixture-start/';
let work,skill,output,enabled;
const variants={};
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function fixture(name,directory=output){const target=path.join(work,name);fs.cpSync(directory,target,{recursive:true});return target;}
function cli(args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/pwa/panel',directory,...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function offline(args=[],directory=enabled){
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/pwa/offline',directory,...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function report(result){
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
function probe(directory,name,code){
  write(path.join(directory,name+'.js'),code);
  const file=path.join(directory,panel,'index.html'),html=fs.readFileSync(file,'utf8');
  write(file,html.replace('</head>','<script defer src="/'+name+'.js"></script></head>'));
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-pwa-'));skill=path.join(work,'skill');output=path.join(work,'public');enabled=path.join(work,'enabled');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime=process.versions.bun?'bun':'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun??process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  for(const lang of ['en','zh','zh-tw']) {
    const prefix=lang==='en'?'':'/'+lang,suffix=lang==='en'?'':'.'+lang;
    let text=fs.readFileSync(path.join(root,'module/content/powered-by/index'+suffix+'.md'),'utf8')
      .replace(/^---\r?\n/,'---\nurl: '+prefix+panel+'\n');
    for(const [key,value] of Object.entries({yes:lang+' · worker yes',no:lang+' · worker no',status:lang+' · status',unavailable:lang+' · unavailable',check:lang+' · check',check_failed:lang+' · failed'})) {
      text=text.replace(new RegExp('^    '+key+':.*$','m'),'    '+key+': '+JSON.stringify(value));
    }
    write(path.join(content,'powered-by/index'+suffix+'.md'),text);
    write(path.join(content,'fixture-start/index'+suffix+'.md'),
      '---\ntitle: Independent panel source\nslug: fixture-start\nlayout: page-article\nurl: '+prefix+from+'\nroot_nav: true\nicon: code\nweight: 84\nbuild:\n  list: local\n---\n\nIndependent panel navigation source.');
  }
  const mounts='[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n';
  const build=(configuration,destination,mode='enable')=>{
    const data=path.join(work,'delivery-data');
    write(path.join(data,'delivery.toml'),'[service_worker]\nmode = "'+mode+'"\n');
    write(config,configuration+'\n[[module.mounts]]\nsource = '+JSON.stringify(data.replaceAll('\\','/'))+
      '\ntarget = "data"\n[[module.mounts]]\nsource = "data"\ntarget = "data"\n');
    const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',destination],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  };
  for(const [mode,destination] of [['off',output],['enable',enabled]]) {
    build(mounts,destination,mode);
  }
  const worker=fs.readFileSync(path.join(root,'module/assets/js/pwa/worker-enable.js.tmpl'),'utf8');
  for(const [name,search,replacement] of [
    ['no-warm','event.waitUntil(warmNavigationUrls(event.data.urls));','// Fault: ignore first-page warm messages.'],
    ['no-scan','const assetUrls = getAssetUrlsFromHtml(htmlText, baseUrl);','const assetUrls = [];'],
    ['fixed-cache',"const NAVIGATION_CACHE = NAVIGATION_CACHE_PREFIX +", "const NAVIGATION_CACHE = 'nav-html-fixed-' +"],
    ['cached-worker','await self.clients.claim();',"const incorrect = await caches.open('incorrect-worker'); await incorrect.put(self.location.href+'?incorrect-cache-key', await fetch(self.location.href)); await self.clients.claim();"],
    ['enabled-preload','await self.registration.navigationPreload.disable();','await self.registration.navigationPreload.enable();'],
    ['network-only','event.respondWith(handleNavigationRequest(request));','event.respondWith(fetch(request));']
  ]) {
    const assets=path.join(work,name+'-assets');
    assert.ok(worker.includes(search),'The worker fault must change an existing behavior: '+name);
    write(path.join(assets,'js/pwa/worker-enable.js.tmpl'),worker.replace(search,replacement));
    variants[name]=path.join(work,name);
    build(mounts+'[[module.mounts]]\nsource = '+JSON.stringify(assets.replaceAll('\\','/'))+'\ntarget = "assets"\n[[module.mounts]]\nsource = "assets"\ntarget = "assets"\n',variants[name]);
  }
  // These page-specific assets are absent from install-time offline fallbacks.
  // Their cache entries therefore prove first-page HTML scanning.
  const samples=[['css','.offline-fixture { color: inherit; }'],['js','document.documentElement.dataset.offlineFixture="loaded";']];
  for(const directory of [enabled,...Object.values(variants)]) {
    const tags=[];
    for(const [type,code] of samples) {
      const name=type+'/offline-fixture.'+createHash('sha256').update(code).digest('hex')+'.'+type;
      write(path.join(directory,name),code);
      tags.push(type==='css'?'<link rel="stylesheet" href="/'+name+'">':'<script defer src="/'+name+'"></script>');
    }
    for(const prefix of ['','/zh','/zh-tw']) {
      const file=path.join(directory,prefix+from,'index.html');
      write(file,fs.readFileSync(file,'utf8').replace('</head>',tags.join('')+'</head>'));
    }
  }
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('panel declarations expose paths, widths and detailed help',()=>{
  const spec=panelCommand('panel','Panel');
  assert.throws(()=>parseArguments(spec,[]),/--page is required/);
  assert.throws(()=>parseArguments(spec,['--page',panel]),/--from is required/);
  assert.throws(()=>parseArguments(spec,['--page',panel,'--from',from,'--widths','390,390']),/distinct integers/);
  assert.throws(()=>parseArguments(spec,['--page','https://example.invalid/','--from',from]),/single \//);
  assert.equal(parseArguments(spec,['--page',panel,'--from',from]).widths,'390,1024');
  assert.match(helpFor(spec),/--page <path>/);assert.match(helpFor(spec),/--from <path>/);assert.match(helpFor(spec),/--widths <pixels>/);
});

test('unavailable panels render localized copy across visits, reloads and native history',{timeout:20000},()=>{
  for(const lang of ['en','zh','zh-tw']) {
    const prefix=lang==='en'?'':'/'+lang;
    const state=report(cli(['--page',prefix+panel,'--from',prefix+from,'--out',path.join(work,'reports')]));
    assert.equal(state.details.cases.length,8);
    assert.deepEqual(state.details.cases.map(value=>value.phase),['visit','reload','back','entry','visit','reload','back','entry']);
    assert.ok(state.details.cases.every(value=>value.state==='unavailable'&&value.controlled===lang+' · worker no'&&!value.action));
    assert.deepEqual([...new Set(state.details.cases.map(value=>value.width))],[390,1024]);
  }
});

test('enabled panels render a blocked-worker failure without claiming registration or upgrades',{timeout:15000},()=>{
  const state=report(cli(['--page',panel,'--from',from,'--trace','--out',path.join(work,'reports')],enabled));
  assert.ok(state.details.cases.every(value=>value.state==='failed'&&value.action&&value.controlled==='en · worker no'));
});

test('panel checks detect missing controllers and incorrect localized state',{timeout:20000},()=>{
  const missing=fixture('missing-controller'),file=path.join(missing,panel,'index.html');
  const html=fs.readFileSync(file,'utf8'),changed=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,script=>script.includes('/js/updates/page.')?'':script);
  assert.ok(changed!==html,'The missing-controller fixture must remove the page asset.');write(file,changed);
  const absent=cli(['--page',panel,'--from',from,'--widths','1024','--timeout','1500'],missing);
  assert.equal(absent.status,1,absent.stdout+absent.stderr);assert.match(absent.stderr,/Timeout/);
  for(const [name,code,message] of [
    ['wrong-controlled','document.querySelector("[data-pwa-controlled]").textContent="wrong locale";',/current runtime and locale/],
    ['wrong-state','document.querySelector("[data-site-update-panel]").dataset.siteUpdateState="ready";',/update subscription/],
    ['missing-status','document.querySelector("[data-site-update-status]").textContent="";',/localized label/]
  ]) {
    const broken=fixture(name);probe(broken,name,'document.addEventListener("DOMContentLoaded",()=>{'+code+'});');
    const result=cli(['--page',panel,'--from',from,'--widths','1024'],broken);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('panel checks detect inaccessible announcements and incorrect check controls',{timeout:20000},()=>{
  for(const [name,code,message] of [
    ['wrong-role','document.querySelector("[data-site-update-status]").setAttribute("role","alert");',/status role/],
    ['wrong-live','document.querySelector("[data-site-update-status]").setAttribute("aria-live","off");',/politely/],
    ['missing-action','document.querySelector("[data-site-update-action]")?.remove();',/contain its check button/],
    ['wrong-action','document.querySelector("[data-site-update-action]").disabled=true;',/whether checking is available/],
    ['wrong-label','document.querySelector("[data-site-update-action-label]").textContent="wrong label";',/current localized label/]
  ]) {
    // Registration failure publishes after load. Keep the fault after each render,
    // observing only the state attribute so corrupting the control cannot loop.
    const broken=fixture(name,enabled);probe(broken,name,'document.addEventListener("DOMContentLoaded",()=>{const corrupt=()=>{'+code+'};corrupt();new MutationObserver(corrupt).observe(document.querySelector("[data-site-update-panel]"),{attributes:true,attributeFilter:["data-site-update-state"]});});');
    const result=cli(['--page',panel,'--from',from,'--widths','1024'],broken);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('panel checks detect history-only failures and hidden narrow panels',{timeout:15000},()=>{
  for(const [name,code,width,message] of [
    ['broken-back','if(performance.getEntriesByType("navigation")[0]?.type==="back_forward")document.querySelector("[data-pwa-controlled]").textContent="broken back";','1024',/current runtime and locale/],
    ['hidden-mobile','if(innerWidth<500)document.querySelector("[data-site-update-panel]").hidden=true;','390',/must be visible/]
  ]) {
    const broken=fixture(name);probe(broken,name,'document.addEventListener("DOMContentLoaded",()=>{'+code+'});');
    const result=cli(['--page',panel,'--from',from,'--widths',width],broken);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('offline declarations expose the first page and reject unhandled URL state',()=>{
  const spec=offlineCommand('offline','Offline');
  assert.equal(parseArguments(spec,[]).page,'/');
  assert.equal(parseArguments(spec,['--page',from]).page,from);
  for(const page of [from+'#from=all',from+'#details','https://example.invalid/'])assert.throws(()=>parseArguments(spec,['--page',page]));
  assert.match(helpFor(spec),/--page <path>/);
});

test('real workers cache the first page and its unique assets before an offline reload',{timeout:20000},()=>{
  for(const page of [from,'/zh'+from,'/']) {
    const state=report(offline(['--page',page,'--trace','--out',path.join(work,'reports')]));
    assert.equal(state.details.offlineDocument,true);assert.equal(state.details.offlineAssets,state.details.assets.length);
    assert.ok(state.details.assets.length>0);assert.match(state.details.navigationCache,/^nav-html-v\d{14}$/);
    assert.equal(state.details.registration.updateViaCache,'none');assert.equal(state.details.registration.preload.enabled,false);
    if(page!=='/')for(const type of ['css','js'])assert.ok(state.details.assets.some(url=>url.includes('/'+type+'/offline-fixture.')));
  }
});

test('disabled, broken and unwarmed workers cannot pass the first-visit boundary',{timeout:15000},()=>{
  const broken=fixture('broken-worker',enabled);fs.appendFileSync(path.join(broken,'sw.js'),'\nthis is invalid JavaScript !\n');
  for(const [directory,message] of [[output,/active controlling/],[broken,/active controlling/],[variants['no-warm'],/enter their caches before reload/]]) {
    const result=offline(['--page',from,'--timeout','1500'],directory);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('offline checks require first-page asset scanning and a versioned navigation cache',{timeout:10000},()=>{
  for(const [name,message] of [['no-scan',/enter their caches before reload/],['fixed-cache',/carry the build version/]]) {
    const result=offline(['--page',from,'--timeout','1500'],variants[name]);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('offline checks reject worker caching, enabled preload and incorrect revalidation headers',{timeout:15000},()=>{
  const headers=fixture('bad-worker-headers',enabled);
  fs.appendFileSync(path.join(headers,'_headers'),'\n/sw.js\n  Cache-Control: public, max-age=3600\n');
  for(const [directory,message] of [[variants['cached-worker'],/never enter Cache Storage/],[variants['enabled-preload'],/preload disabled/],[headers,/revalidate on every request/]]) {
    const result=offline(['--page',from],directory);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('a warm cache alone cannot pass when navigation still requires the network',{timeout:10000},()=>{
  const result=offline(['--page',from],variants['network-only']);
  assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/reload successfully offline/);
});
