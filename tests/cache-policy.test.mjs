import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fixtureEnvironment,serviceWorkerPolicy} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {parseHeaders,cloudflareHeaders} from '../.agents/skills/swaw-banyan/tasks/_shared/headers.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/cache-policy-tests');
let work;
function write(file,body) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}
function build(name,policy,config='',workerConfig=serviceWorkerPolicy('enable')) {
  const directory=path.join(work,name),overlay=path.join(directory,'data'),assets=path.join(work,'assets');
  write(path.join(overlay,'delivery.toml'),(policy??'')+'\n'+workerConfig);
  const mounts=[['assets',assets],['assets','assets'],['data',overlay],['data','data']]
    .map(([target,source])=>'[[module.mounts]]\nsource = '+JSON.stringify(source.replaceAll('\\','/'))+'\ntarget = "'+target+'"\n').join('');
  const configFile=path.join(directory,'fixture.toml'),output=path.join(directory,'public');
  write(configFile,mounts+config);
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--cleanDestinationDir','--config','hugo.toml,'+configFile,'--destination',output],
    {cwd:root,env:fixtureEnvironment(directory),encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
  assert.ifError(result.error);
  return {...result,log:result.stdout+result.stderr,output};
}
function passed(result) {assert.equal(result.status,0,result.log);assert.doesNotMatch(result.log,/\bWARN\b/);return result.output;}
function worker(output,environment={}) {
  const listeners={};
  const context=vm.createContext({URL,URLSearchParams,Request,Response,AbortController,DOMException,setTimeout,clearTimeout,...environment,
    self:{location:new URL('https://example.test/sw.js'),
      registration:{active:null,installing:null,waiting:null,addEventListener(){}},clients:{async claim(){}},
      ...environment.self,addEventListener:(name,handler)=>{listeners[name]=handler;}}});
  vm.runInContext(fs.readFileSync(path.join(output,'sw.js'),'utf8'),context);
  return {probe:context.probe,listeners,context};
}
function cachedWorker(output,respond,environment={},stores=new Map()) {
  const requests=[],key=request=>typeof request==='string'?new URL(request,'https://example.test/').href:request.url;
  if(!stores.has('sw-content-state'))stores.set('sw-content-state',new Map([
    ['https://example.test/sw-version.json',Response.json({version:'v-fixture',lastAttemptAt:environment.Date?.now()??Date.now()})]
  ]));
  const caches={async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},async open(name) {
    if(!stores.has(name))stores.set(name,new Map());
    const entries=stores.get(name);
    return {
      async match(request){return entries.get(key(request))?.clone();},
      async put(request,response){entries.set(key(request),response.clone());}
    };
  }};
  const runtime=worker(output,{caches,fetch:async(input,init)=>{
    const request=typeof input==='string'?new Request(input,init):input;
    requests.push(request);
    if(request.signal.aborted)throw new DOMException('Aborted','AbortError');
    return respond(request);
  },...environment});
  return {...runtime,stores,requests};
}
function requestFor(pathname,navigation=false) {
  const request=new Request('https://example.test'+pathname);
  if(navigation)Object.defineProperty(request,'mode',{value:'navigate'});
  return request;
}
function dispatch(listeners,request) {
  let response;
  listeners.fetch({request,respondWith:promise=>{response=promise;},waitUntil:promise=>{void promise.catch(()=>{});}});
  return response;
}
function fakeClock() {
  let now=Date.UTC(2026,9,15),sequence=0;
  const timers=new Map();
  return {
    Date:class extends Date{static now(){return now;}},
    setTimeout(callback,delay){const id=++sequence;timers.set(id,{at:now+delay,callback});return id;},
    clearTimeout(id){timers.delete(id);},
    jump(milliseconds){now+=milliseconds;},
    async tick(milliseconds){
      const end=now+milliseconds;
      for(;;){
        const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
        if(!next)break;
        now=next[1].at;timers.delete(next[0]);next[1].callback();await new Promise(setImmediate);
      }
      now=end;await new Promise(setImmediate);
    }
  };
}
let contentOutput;
function contentRuntime({clock=fakeClock(),stores=new Map(),respond}={}) {
  contentOutput??=passed(build('content-version'));
  if(!stores.has('sw-content-state'))stores.set('sw-content-state',new Map([
    ['https://example.test/sw-version.json',Response.json({version:'v-one',lastAttemptAt:clock.Date.now()-300000})]
  ]));
  const registration=new EventTarget();
  Object.assign(registration,{active:{},installing:null,waiting:null});
  const control={version:'v-two',fail:false,invalid:false};
  const runtime=cachedWorker(contentOutput,request=>{
    const pathname=new URL(request.url).pathname;
    if(respond){const result=respond(request,control);if(result!==undefined)return result;}
    if(control.fail)throw new TypeError('Network unavailable');
    if(pathname==='/sw-version.json')return Response.json(control.invalid?{version:''}:{version:control.version});
    return new Response('<script src="/js/common.hash.js"></script><p>'+control.version+'</p>',
      {headers:{'Content-Type':pathname.startsWith('/js/')?'text/javascript':'text/html'}});
  },{...clock,self:{registration}},stores);
  return {...runtime,clock,control,registration};
}
async function navigation(runtime,pathname='/cached/') {
  const tasks=[];let response;
  runtime.listeners.fetch({request:requestFor(pathname,true),respondWith:promise=>{response=promise;},waitUntil:promise=>tasks.push(promise)});
  const result=await response;
  await new Promise(setImmediate);
  return {response:result,done:Promise.all(tasks)};
}
function versionRequests(runtime){return runtime.requests.filter(request=>new URL(request.url).pathname==='/sw-version.json');}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});
  work=fs.mkdtempSync(path.join(parent,'banyan-policy-'));
  const source=fs.readFileSync(path.join(root,'module/assets/js/pwa/worker-enable.js.tmpl'),'utf8');
  write(path.join(work,'assets/js/pwa/worker-enable.js.tmpl'),source+
    '\nglobalThis.probe = {SW_ROUTES,PROGRAM_OFFLINE_CACHE,matchesRoutePath,getMatchingRoute,getRequestPathname,isHtmlDocumentRequest,getCacheNameForRoute,warmNavigationUrl,'+
    'getCurrentGeneration,readContentState,scheduleContentVersionCheck,cancelContentVersionCheck,'+
    'get currentGeneration(){return currentGeneration;},get contentCheckTask(){return contentCheckTask;}};\n');
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('default policy generates explicit Cloudflare overrides and independent EdgeOne headers',()=>{
  const output=passed(build('defaults')),text=fs.readFileSync(path.join(output,'_headers'),'utf8');
  const rules=parseHeaders(text),edge=JSON.parse(fs.readFileSync(path.join(output,'edgeone.json'),'utf8'));
  assert.equal(rules[0].source,'/*');
  assert.equal(edge.headers[0].source,'/*');
  assert.equal(edge.headers.length,rules.length);
  assert.ok(!JSON.stringify(edge).includes('unset'));
  for(const [url,expected] of [['/','public, max-age=900, must-revalidate'],
    ['/js/main.hash.js','public, max-age=31536000, immutable'],
    ['/site/pwa/app.hash.webmanifest','public, max-age=31536000, immutable'],
    ['/favicon.ico','public, max-age=86400, must-revalidate'],
    ['/sw.js','no-cache, max-age=0, must-revalidate'],['/sw-version.json','no-cache, max-age=0, must-revalidate']])
    assert.equal(cloudflareHeaders(rules,url)['cache-control'],expected,url);
  assert.equal(cloudflareHeaders(rules,'/site/pwa/app.hash.webmanifest')['content-type'],'application/manifest+json; charset=utf-8');
  const xml=cloudflareHeaders(rules,'/zh/index.xml')['content-security-policy'];
  assert.match(xml,/^default-src 'none';/);assert.ok(!xml.includes('script-src'));
  assert.equal(edge.headers.find(rule=>rule.source==='/site/pwa/*.webmanifest').headers.length,1);
  const {probe}=worker(output);
  assert.equal(probe.getMatchingRoute('/icp/').bucket,'versioned');
  assert.equal(probe.getMatchingRoute('/site/pwa/app.hash.webmanifest').bucket,'fingerprinted');
  assert.equal(probe.getMatchingRoute('/sw.js').bucket,'off');
  assert.equal(probe.getMatchingRoute('/sw-version.json').bucket,'off');
  assert.equal(probe.getMatchingRoute('/unconfigured.txt').bucket,'versioned');
  for(const route of probe.SW_ROUTES) assert.deepEqual(Object.keys(route).sort(),['bucket','path']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output,'sw-policy.json'),'utf8')),JSON.parse(JSON.stringify(probe.SW_ROUTES)));
});

test('platform values override common values only within their own route and platform',()=>{
  const tokenHeader="X!#$%&'*+.^_`|~-09Az";
  const policy='[platform.cloudflare.pages]\nenabled = true\n[platform.edgeone.makers]\nenabled = true\n'+
    'installCommand = ""\nbuildCommand = "hugo --minify --gc --cleanDestinationDir"\noutputDirectory = "public"\nnodeVersion = "20.18.0"\n'+
    '[[routes]]\npath = "/*"\nhttp.headers.X-Common = "yes"\nhttp.headers.X-Value = "common"\n'+
    'http.headers.X_Request_ID = "request"\nhttp.headers.'+JSON.stringify(tokenHeader)+' = "token"\n'+
    'http.cloudflare.pages.headers.x-value = "cf"\nhttp.edgeone.makers.headers.X-Value = "eo"\n'+
    '[[routes]]\npath = "/cf-only/*"\nhttp.cloudflare.pages.headers.X-Only = "cf"\n'+
    '[[routes]]\npath = "/eo-only/*"\nhttp.edgeone.makers.headers.X-Only = "eo"\n'+
    '[[routes]]\npath = "/remove/*"\nhttp.cloudflare.pages.unset = '+JSON.stringify(['X-Value','X_Request_ID',tokenHeader])+'\n';
  const output=passed(build('platform',policy)),rules=parseHeaders(fs.readFileSync(path.join(output,'_headers'),'utf8'));
  const edge=JSON.parse(fs.readFileSync(path.join(output,'edgeone.json'),'utf8'));
  assert.equal(cloudflareHeaders(rules,'/')['x-value'],'cf');
  assert.equal(cloudflareHeaders(rules,'/remove/a')['x-value'],undefined);
  assert.equal(cloudflareHeaders(rules,'/')['x-common'],'yes');
  for(const [name,value] of [['X_Request_ID','request'],[tokenHeader,'token']]) {
    assert.equal(cloudflareHeaders(rules,'/')[name.toLowerCase()],value);
    assert.equal(cloudflareHeaders(rules,'/remove/a')[name.toLowerCase()],undefined);
    assert.equal(edge.headers[0].headers.find(header=>header.key===name).value,value);
  }
  assert.equal(edge.headers[0].headers.find(header=>header.key.toLowerCase()==='x-value').value,'eo');
  assert.ok(!edge.headers.some(route=>route.source==='/cf-only/*'||route.source==='/remove/*'));
  assert.ok(!rules.some(route=>route.source==='/eo-only/*'));
  assert.equal(edge.nodeVersion,'20.18.0');assert.equal(edge.buildCommand,'hugo --minify --gc --cleanDestinationDir');
  assert.equal(worker(output).probe.SW_ROUTES.length,0);
});

test('Cloudflare output rejects header names beginning with a comment marker',()=>{
  for(const field of ['http.headers','http.cloudflare.pages.headers']) {
    const result=build('comment-header-'+field,'[platform.cloudflare.pages]\nenabled = true\n'+
      '[[routes]]\npath = "/probe/*"\n'+field+'."#Trace" = "enabled"\n');
    assert.notEqual(result.status,0,field+' must reject a comment-prefixed header.');
    assert.match(result.log,/Cloudflare _headers: header "#Trace" for "\/probe\/\*" must not start with #/);
    assert.match(result.log,/treated as a comment/);
  }
});

test('hash-prefixed headers remain valid outside Cloudflare header declarations',()=>{
  for(const cloudflare of [false,true]) {
    const field=cloudflare?'http.edgeone.makers.headers':'http.headers';
    const policy='[platform.cloudflare.pages]\nenabled = '+cloudflare+'\n[platform.edgeone.makers]\nenabled = true\n'+
      'installCommand = ""\nbuildCommand = "hugo"\noutputDirectory = "public"\nnodeVersion = "22.11.0"\n'+
      '[[routes]]\npath = "/probe/*"\n'+field+'."#Trace" = "enabled"\nhttp.cloudflare.pages.unset = ["#Trace"]\n';
    const output=passed(build('comment-header-edgeone-'+cloudflare,policy));
    const edge=JSON.parse(fs.readFileSync(path.join(output,'edgeone.json'),'utf8'));
    assert.deepEqual(edge.headers.find(route=>route.source==='/probe/*').headers,[{key:'#Trace',value:'enabled'}]);
    assert.equal(fs.existsSync(path.join(output,'_headers')),cloudflare);
    if(cloudflare) {
      const rules=parseHeaders(fs.readFileSync(path.join(output,'_headers'),'utf8'));
      assert.deepEqual(rules.find(rule=>rule.source==='/probe/*').unset,['#Trace']);
      assert.equal(cloudflareHeaders(rules,'/probe/a')['#trace'],undefined);
    }
  }
});

test('delivery top-level tables replace nested defaults in every language',()=>{
  const output=passed(build('nested-defaults','[prefetch]\nenabled = true\ndefault = "off"\n'+
    '[prefetch.icons.folder]\nroot = "conservative"\n'));
  let targets,nativeBody;
  for(const prefix of ['','zh/','zh-tw/']) {
    const html=fs.readFileSync(path.join(output,prefix,'index.html'),'utf8');
    const payload=JSON.parse(html.match(/<script id=["']?site-prefetch-data["']?[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(Object.keys(payload).sort(),['enabled','modes','prerender','sw']);
    assert.equal(payload.enabled,true);
    assert.equal(payload.modes['folder/root'],'conservative');assert.equal(payload.modes['folder/all'],undefined);
    assert.equal(payload.modes['folder/tail'],undefined);assert.equal(payload.modes['folder/tail-1'],undefined);
    assert.equal(payload.modes.default,'off');
    assert.equal(payload.prerender['folder/tail'],undefined);
    assert.deepEqual(payload.sw,{enabled:true,url:'/sw.js',scope:'/'});
    const pageTargets=JSON.parse(html.match(/<script id=["']?site-prefetch-rules["']?[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(pageTargets.prefetch.map(target=>target.id),['folder/root','default']);
    if(targets)assert.deepEqual(pageTargets,targets);else targets=pageTargets;
    const body=html.match(/<script id=["']?site-speculation-rules["']?[^>]*>([\s\S]*?)<\/script>/)[1];
    if(nativeBody)assert.equal(body,nativeBody);else nativeBody=body;
    assert.equal(html.includes('site-prefetch-runtime-meta'),false);
  }
  const edge=JSON.parse(fs.readFileSync(path.join(output,'edgeone.json'),'utf8'));
  assert.ok(!edge.headers.some(route=>route.headers.some(header=>header.key==='Speculation-Rules')));
  const rules=JSON.parse(nativeBody);
  assert.deepEqual(rules.prefetch.map(rule=>rule.where.and[0].selector_matches),
    targets.prefetch.filter(target=>target.id!=='default').map(target=>target.selector),
    'Only explicitly configured icon scopes are present.');
  assert.equal(rules.prerender,undefined);
  for(const rule of rules.prefetch) {
    assert.equal(rule.source,'document');
    assert.deepEqual(rule.where.and.slice(1),[
      {selector_matches:'html[data-prefetch-native-ready] a'},
      {href_matches:['/','/*/','/*.html','/*.htm'],relative_to:'document'},
      {not:{href_matches:'#*',relative_to:'document'}}
    ]);
  }
  assert.equal(worker(output).probe.getMatchingRoute('/unconfigured.json').bucket,'versioned');
});

test('compiled worker matches one wildcard, preserves URL case and uses the last declared SW rule',()=>{
  const policy='[[routes]]\npath = "/*"\nsw.bucket = "off"\n'+
    '[[routes]]\npath = "/account/*"\nsw.bucket = "off"\n'+
    '[[routes]]\npath = "/account/help/*"\nsw.bucket = "versioned"\n'+
    '[[routes]]\npath = "/*.json"\nsw.bucket = "versioned"\n'+
    '[[routes]]\npath = "/private/*.json"\nsw.bucket = "off"\n'+
    '[[routes]]\npath = "/private/help.json"\nhttp.headers.Cache-Control = "no-store"\n';
  const output=passed(build('worker',policy)),{probe,listeners}=worker(output);
  assert.deepEqual(Array.from(probe.SW_ROUTES,route=>route.path),['/private/*.json','/*.json','/account/help/*','/account/*','/*']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output,'sw-policy.json'),'utf8')),JSON.parse(JSON.stringify(probe.SW_ROUTES)));
  for(const [pattern,url,expected] of [
    ['/*','/',true],['/a/*','/a/',true],['/a/*','/a/b/c',true],['/a/*','/a',false],
    ['/*.xml','/zh/index.xml',true],['/*.xml','/index.xmlx',false],
    ['/site/pwa/*.webmanifest','/site/pwa/.webmanifest',true],
    ['/site/pwa/*.webmanifest','/site/pwa/a/b.webmanifest',true],
    ['/site/pwa/*.webmanifest','/site/other/a.webmanifest',false],
    ['/ab*bc','/abc',false],['/ab*bc','/abbc',true],
    ['/File.json','/File.json',true],['/File.json','/file.json',false],
    ['/x/a+b.json','/x/a+b.json',true],['/x/a+b.json','/x/ab.json',false]
  ]) assert.equal(probe.matchesRoutePath(pattern,url),expected,pattern+' → '+url);
  assert.equal(probe.getMatchingRoute('/account/private/').bucket,'off');
  assert.equal(probe.getMatchingRoute('/account/help/start/').bucket,'versioned');
  assert.equal(probe.getMatchingRoute('/private/help.json').bucket,'off','HTTP fields cannot change SW rules.');
  assert.equal(probe.getMatchingRoute('/public/a.json').bucket,'versioned');
  assert.equal(probe.getMatchingRoute('/public/a.JSON').bucket,'off');
  assert.equal(probe.getRequestPathname(new Request('https://example.test/A%20B.json?q=1')),'/A%20B.json');
  assert.equal(probe.isHtmlDocumentRequest(new Request('https://example.test/about/',{headers:{Accept:'text/html'}})),true);
  assert.equal(probe.isHtmlDocumentRequest(new Request('https://other.test/about/',{headers:{Accept:'text/html'}})),false);
  for(const request of [new Request('https://example.test/no-rule.txt'),new Request('https://example.test/private/a.json'),
    new Request('https://other.test/a.json'),new Request('https://example.test/a.json',{method:'POST'})]) {
    listeners.fetch({request,respondWith:()=>assert.fail('Request must not enter the SW cache: '+request.url)});
  }
});

test('platform switches publish only their enabled artifacts and do not inherit omitted platforms',()=>{
  for(const cloudflare of [false,true])for(const edgeone of [false,true]) {
    const policy='[platform.cloudflare.pages]\nenabled = '+cloudflare+'\n[platform.edgeone.makers]\nenabled = '+edgeone+'\n'+
      (edgeone?'installCommand = ""\nbuildCommand = "hugo"\noutputDirectory = "public"\nnodeVersion = "22.11.0"\n':'');
    const output=passed(build('platform-switch-'+cloudflare+'-'+edgeone,policy));
    assert.equal(fs.existsSync(path.join(output,'_headers')),cloudflare);
    assert.equal(fs.existsSync(path.join(output,'_redirects')),cloudflare);
    assert.equal(fs.existsSync(path.join(output,'edgeone.json')),edgeone);
    if(edgeone)assert.equal('enabled' in JSON.parse(fs.readFileSync(path.join(output,'edgeone.json'),'utf8')),false);
  }
  const onlyCloudflare=passed(build('platform-only-cloudflare','[platform.cloudflare.pages]\nenabled = true\n'));
  assert.equal(fs.existsSync(path.join(onlyCloudflare,'_headers')),true);
  assert.equal(fs.existsSync(path.join(onlyCloudflare,'edgeone.json')),false);
  const none=passed(build('platform-empty','platform = {}\n'));
  for(const file of ['_headers','_redirects','edgeone.json'])assert.equal(fs.existsSync(path.join(none,file)),false);
  const incomplete=build('platform-incomplete','[platform.edgeone.makers]\nenabled = true\nnodeVersion = "22.11.0"\n');
  assert.notEqual(incomplete.status,0);assert.match(incomplete.log,/enabled platform.edgeone.makers requires installCommand/);
  const cleaned=passed(build('platform-switch-true-true','platform = {}\n','',serviceWorkerPolicy('off')));
  for(const file of ['_headers','_redirects','edgeone.json','sw.js','sw-policy.json','sw-version.json'])
    assert.equal(fs.existsSync(path.join(cleaned,file)),false,'Clean builds remove the disabled artifact '+file);
});

test('disabled and off workers do not publish a policy copy, and worker tables must be complete',()=>{
  for(const mode of ['disable','off']) {
    const output=passed(build('worker-'+mode,undefined,'',serviceWorkerPolicy(mode)));
    assert.equal(fs.existsSync(path.join(output,'sw.js')),mode==='disable');
    assert.equal(fs.existsSync(path.join(output,'sw-policy.json')),false);
    assert.equal(fs.existsSync(path.join(output,'sw-version.json')),false);
  }
  for(const field of ['mode','content_check_interval','offline_notice_path']) {
    const policy=serviceWorkerPolicy('enable').replace(new RegExp('^'+field+' = .*\\n','m'),'');
    const result=build('worker-missing-'+field,undefined,'',policy);
    assert.notEqual(result.status,0);assert.match(result.log,new RegExp('service_worker requires '+field));
  }
});

test('bucket caching preserves query keys, validates versioned responses and warms only fingerprinted resources',async()=>{
  const output=passed(build('cache-behavior'));
  let offline=false;
  const runtime=cachedWorker(output,request=>{
    if(offline)throw new TypeError('Network unavailable');
    const url=new URL(request.url);
    if(url.pathname==='/sw-version.json')return Response.json({version:'v-fixture'});
    if(url.pathname==='/validated.json'&&request.cache!=='reload')return new Response(null,{status:304});
    if(url.pathname.endsWith('/offline/'))return new Response('Offline page',{headers:{'Content-Type':'text/html'}});
    if(url.pathname==='/about/')return new Response('<a href="/unvisited/">Page</a><a href="/data.json">Data</a>'+
      '<script src="/js/app.hash.js"></script><img src="/site/logo.hash.svg"><script src="/sw.js"></script>',
      {headers:{'Content-Type':'text/html'}});
    if(url.pathname==='/error/')return new Response('Not found',{status:404,headers:{'Content-Type':'text/html'}});
    if(url.pathname.startsWith('/js/'))return new Response('/* script */',{headers:{'Content-Type':'text/javascript'}});
    if(url.pathname.startsWith('/site/'))return new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}});
    return Response.json({query:url.search});
  });
  const {probe,listeners,requests,stores}=runtime;
  for(const pathname of ['/sw.js','/favicon.ico','/favicon.svg'])
    assert.equal(dispatch(listeners,requestFor(pathname,true)),undefined,'off also applies to document navigation.');
  const first=await dispatch(listeners,requestFor('/data.json?rev=1'));
  assert.deepEqual(await first.json(),{query:'?rev=1'});
  assert.equal(requests.at(-1).cache,'no-cache','Versioned assets must validate the HTTP cache.');
  const count=requests.length;
  await dispatch(listeners,requestFor('/data.json?rev=1'));
  assert.equal(requests.length,count,'A cache hit must not fetch.');
  assert.deepEqual(await (await dispatch(listeners,requestFor('/data.json?rev=2'))).json(),{query:'?rev=2'});
  assert.ok((await dispatch(listeners,requestFor('/validated.json'))).ok);
  assert.deepEqual(requests.slice(-2).map(request=>request.cache),['no-cache','reload'],
    'A 304 response must be retried for a complete cacheable body.');
  await probe.warmNavigationUrl('https://example.test/about/?keep=1#from=notes&sort=title&sorts=date');
  assert.equal(requests.find(request=>new URL(request.url).pathname==='/about/').cache,'no-cache');
  assert.equal(requests.find(request=>new URL(request.url).pathname==='/js/app.hash.js').cache,'default');
  assert.equal(requests.some(request=>['/unvisited/','/data.json','/sw.js'].includes(new URL(request.url).pathname)
    &&!new URL(request.url).search),false,'Page links, versioned assets and off rules must not become asset warmups.');
  const navigationCache=stores.get(probe.getCacheNameForRoute(probe.getMatchingRoute('/about/'),true));
  assert.ok(navigationCache.has('https://example.test/about/?keep=1'));
  const beforeNavigation=requests.length;
  await dispatch(listeners,requestFor('/about/?keep=1',true));
  assert.equal(requests.length,beforeNavigation,'Changing UI parameters must reuse the page cache.');
  for(let attempt=0;attempt<2;attempt++) {
    assert.equal((await dispatch(listeners,requestFor('/error/',true))).status,404);
    assert.match((await dispatch(listeners,requestFor('/not-html/',true))).headers.get('content-type'),/json/);
  }
  assert.equal(navigationCache.has('https://example.test/error/'),false);
  assert.equal(navigationCache.has('https://example.test/not-html/'),false);
  let installed;listeners.install({waitUntil:promise=>{installed=promise;}});await installed;
  let activated;listeners.activate({waitUntil:promise=>{activated=promise;}});await activated;
  offline=true;
  assert.equal(await (await dispatch(listeners,requestFor('/unvisited/',true))).text(),'Offline page');
  assert.equal(await (await dispatch(listeners,requestFor('/js/app.hash.js'))).text(),'/* script */');
  assert.deepEqual(await (await dispatch(listeners,requestFor('/data.json?rev=1'))).json(),{query:'?rev=1'});
  await assert.rejects(dispatch(listeners,requestFor('/missing.json')),/Network unavailable/,
    'A resource failure must not return offline HTML.');
});

test('off rules also exclude offline-page installation and fallback',async()=>{
  const policy='[[routes]]\npath = "/*"\nsw.bucket = "versioned"\n'+
    '[[routes]]\npath = "/*offline/"\nsw.bucket = "off"\n';
  const {listeners,requests}=cachedWorker(passed(build('offline-off',policy)),request=>{
    if(new URL(request.url).pathname==='/sw-version.json')return Response.json({version:'v-fixture'});
    throw new TypeError('Offline');
  },{},new Map([['sw-content-state',new Map()]]));
  let installed;listeners.install({waitUntil:promise=>{installed=promise;}});await installed;
  assert.equal(requests.length,1,'Installation only fetches the content version when offline pages are disabled.');
  let activated;listeners.activate({waitUntil:promise=>{activated=promise;}});await activated;
  await assert.rejects(dispatch(listeners,requestFor('/uncached/',true)),/no cached response/);
  assert.equal(requests.length,2,'Disabled offline pages must not be fetched through fallback.');
});

test('content versions change JSON without changing the worker program, and intervals require positive integers',()=>{
  const first=passed(build('version-one',undefined,'[params.build]\nversion = "v-one"\n'));
  const second=passed(build('version-two',undefined,'[params.build]\nversion = "v-two"\n'));
  assert.equal(fs.readFileSync(path.join(first,'sw.js'),'utf8'),fs.readFileSync(path.join(second,'sw.js'),'utf8'));
  assert.match(worker(first).probe.PROGRAM_OFFLINE_CACHE,/^sw-program-offline-[a-f0-9]{64}$/);
  assert.doesNotMatch(fs.readFileSync(path.join(first,'sw.js'),'utf8'),/__BANYAN_SW_PROGRAM_HASH__/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(first,'sw-version.json'),'utf8')),{version:'v-one'});
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(second,'sw-version.json'),'utf8')),{version:'v-two'});
  for(const value of ['0','-1','1.5','"5"']){
    const result=build('interval-'+value.replace(/\W/g,'x'),undefined,'',serviceWorkerPolicy('enable',value));
    assert.notEqual(result.status,0);assert.match(result.log,/content_check_interval must be a positive integer/);
  }
});

test('SW manager integrity matches published bytes in every language',()=>{
  for(const mode of ['enable','disable']) {
    const output=passed(build('manager-integrity-'+mode,undefined,'',serviceWorkerPolicy(mode)));
    for(const prefix of ['','zh/','zh-tw/']) {
      const html=fs.readFileSync(path.join(output,prefix,'index.html'),'utf8');
      const tag=[...html.matchAll(/<script\b[^>]*>/gi)].map(match=>match[0])
        .find(tag=>extractTagAttribute(tag,'src')?.includes('sw-manager.'+mode+'.'));
      assert.ok(tag,mode+' manager must be present in '+(prefix||'en'));
      const src=extractTagAttribute(tag,'src'),bytes=fs.readFileSync(path.join(output,src));
      assert.equal(extractTagAttribute(tag,'integrity'),'sha256-'+createHash('sha256').update(bytes).digest('base64'));
    }
  }
});

test('the page entry only registers after load and prerender activation, without a manager or warmup',async()=>{
  contentOutput??=passed(build('content-version'));
  const file=fs.readdirSync(path.join(contentOutput,'js')).find(name=>name.startsWith('sw-manager.enable.')&&name.endsWith('.js'));
  const source=fs.readFileSync(path.join(contentOutput,'js',file),'utf8');
  for(const [supported,loaded,prerendering] of [[true,false,false],[true,true,false],[true,true,true],[false,true,false]]){
    const windowEvents=new Map(),documentEvents=new Map(),registrations=[];
    const navigator=supported?{serviceWorker:{register(...args){registrations.push(args);return Promise.resolve();}}}:{};
    const document={readyState:loaded?'complete':'loading',prerendering,
      addEventListener:(name,handler)=>documentEvents.set(name,handler)};
    const window={addEventListener:(name,handler)=>windowEvents.set(name,handler)};
    vm.runInNewContext(source,{navigator,document,window});
    assert.equal(registrations.length,supported&&loaded&&!prerendering?1:0);
    if(supported&&!loaded)windowEvents.get('load')();
    if(supported&&prerendering){document.prerendering=false;documentEvents.get('prerenderingchange')();}
    assert.equal(registrations.length,supported?1:0);
    if(supported){
      assert.equal(registrations[0][0],'/sw.js');
      assert.deepEqual(JSON.parse(JSON.stringify(registrations[0][1])),{scope:'/',updateViaCache:'none'});
    }
    assert.deepEqual([...windowEvents.keys()],supported&&!loaded?['load']:[]);
    assert.deepEqual([...documentEvents.keys()],supported&&prerendering?['prerenderingchange']:[]);
    assert.equal(window.BanyanServiceWorkerManagerRuntime,undefined);
  }
});

test('concurrent navigations share one delayed content check and retain only the committed cache generation',async()=>{
  const runtime=contentRuntime();
  const first=await navigation(runtime),second=await navigation(runtime,'/other/');
  assert.equal(versionRequests(runtime).length,0,'Navigation must not await the version request.');
  await runtime.clock.tick(14999);assert.equal(versionRequests(runtime).length,0);
  await runtime.clock.tick(1);await Promise.all([first.done,second.done]);
  assert.equal(versionRequests(runtime).length,1);
  assert.equal(runtime.probe.currentGeneration.version,'v-two');
  assert.ok(runtime.stores.has('asset-fingerprint'));
  assert.deepEqual([...runtime.stores.keys()].filter(name=>/^(nav-html-|asset-versioned-)/.test(name)).sort(),
    ['asset-versioned-v-two','nav-html-v-two']);
  const state=await runtime.probe.readContentState();assert.equal(state.version,'v-two');
  assert.equal(state.lastAttemptAt,runtime.clock.Date.now());
  const third=await navigation(runtime);await third.done;await runtime.clock.tick(30000);
  assert.equal(versionRequests(runtime).length,1,'The minimum interval must not install a second timer.');
});

test('content check state survives worker restart and clock rollback permits a new check',async()=>{
  const first=contentRuntime(),job=await navigation(first);
  await first.clock.tick(15000);await job.done;
  const restarted=contentRuntime({stores:first.stores,clock:first.clock});
  restarted.control.fail=true;
  const cached=await navigation(restarted);await cached.done;
  assert.equal(versionRequests(restarted).length,0,'Restart must restore the last attempt without requiring a network.');
  assert.equal(restarted.probe.currentGeneration.version,'v-two');
  restarted.control.fail=false;restarted.control.version='v-three';restarted.clock.jump(-60000);
  const rolledBack=await navigation(restarted);await restarted.clock.tick(15000);await rolledBack.done;
  assert.equal(versionRequests(restarted).length,1);
  assert.equal(restarted.probe.currentGeneration.version,'v-three');
});

test('failed JSON and failed offline preparation keep the old generation, release the task and obey the interval',async()=>{
  for(const fault of ['json','offline']){
    const runtime=contentRuntime({respond:(request,control)=>{
      if(fault==='offline'&&new URL(request.url).pathname.endsWith('/offline/'))throw new TypeError('Offline preparation failed');
      if(fault==='json'&&new URL(request.url).pathname==='/sw-version.json')return Response.json({version:''});
    }});
    const job=await navigation(runtime);await runtime.clock.tick(15000);await job.done;
    assert.equal(runtime.probe.currentGeneration.version,'v-one');
    assert.equal(runtime.probe.contentCheckTask,null);
    assert.equal(runtime.stores.has('nav-html-v-two'),false,'A failed candidate must not accumulate.');
    const again=await navigation(runtime);await again.done;assert.equal(versionRequests(runtime).length,1);
  }
});

test('a slow old response cannot recreate deleted versioned caches',async()=>{
  let release;
  const runtime=contentRuntime({respond:request=>new URL(request.url).pathname==='/slow/'?
    new Promise(resolve=>{release=()=>resolve(new Response('Old response',{headers:{'Content-Type':'text/html'}}));}):undefined});
  const slow=dispatch(runtime.listeners,requestFor('/slow/',true));
  await runtime.probe.getCurrentGeneration();await new Promise(setImmediate);
  const job=await navigation(runtime);await runtime.clock.tick(15000);await job.done;
  release();assert.equal(await (await slow).text(),'Old response');await new Promise(setImmediate);
  assert.equal(runtime.stores.has('nav-html-v-one'),false);
  assert.equal(runtime.stores.has('asset-versioned-v-one'),false);
});

test('program installation cancels pending checks and a waiting program permits content updates',async()=>{
  const runtime=contentRuntime(),job=await navigation(runtime);
  runtime.registration.installing={};runtime.registration.dispatchEvent(new Event('updatefound'));
  await job.done;
  assert.equal(runtime.probe.contentCheckTask,null);
  await runtime.clock.tick(15000);assert.equal(versionRequests(runtime).length,0);
  runtime.registration.installing=null;runtime.registration.waiting={};
  const active=runtime.registration.active,waiting=runtime.registration.waiting;
  const next=await navigation(runtime);await runtime.clock.tick(15000);await next.done;
  assert.equal(versionRequests(runtime).length,1);
  assert.equal(runtime.probe.currentGeneration.version,'v-two');
  assert.equal(runtime.registration.active,active);
  assert.equal(runtime.registration.waiting,waiting);
});

test('program installation stages offline pages without touching an active commit; restart activates offline into the final version',async()=>{
  const runtime=contentRuntime(),url='https://example.test/sw-version.json';
  runtime.stores.set('nav-html-v-one',new Map());
  runtime.stores.set('nav-html-v-two',new Map());
  runtime.stores.set('asset-versioned-v-two',new Map());
  runtime.stores.set('sw-program-offline-another-install',new Map());
  const before=await runtime.probe.readContentState();
  let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});await installed;
  assert.deepEqual(await runtime.probe.readContentState(),before);
  assert.equal(runtime.probe.currentGeneration,null,'Installing must not load or clean content generations.');
  assert.equal(versionRequests(runtime).length,0);
  assert.ok(runtime.stores.has('nav-html-v-two'),'An active candidate must survive program installation.');
  assert.ok(runtime.stores.get(runtime.probe.PROGRAM_OFFLINE_CACHE).has('https://example.test/offline/'));
  runtime.stores.get('sw-content-state').set(url,Response.json({version:'v-two',lastAttemptAt:runtime.clock.Date.now()}));
  runtime.stores.delete('nav-html-v-one');
  const restarted=contentRuntime({stores:runtime.stores,clock:runtime.clock});restarted.control.fail=true;
  let activated;restarted.listeners.activate({waitUntil:task=>{activated=task;}});await activated;
  assert.equal(restarted.requests.length,0,'Activation must not wait on the network.');
  assert.equal(restarted.probe.currentGeneration.version,'v-two');
  assert.equal(runtime.stores.has(runtime.probe.PROGRAM_OFFLINE_CACHE),false);
  assert.ok(runtime.stores.has('sw-program-offline-another-install'),'Another program stage must survive activation.');
  const response=await dispatch(restarted.listeners,requestFor('/unvisited-after-program-update/',true));
  assert.equal(response.ok,true);assert.match(await response.text(),/v-two/);
});

test('program activation preserves newer content and fills missing offline pages after a waiting-period commit',async()=>{
  for(const bootstrap of [false,true]){
    const runtime=contentRuntime(bootstrap?{stores:new Map([['sw-content-state',new Map()]])}:{});
    let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});await installed;
    const active=contentRuntime({stores:runtime.stores,clock:runtime.clock});
    active.probe.SW_ROUTES.unshift({path:'/zh/offline/',bucket:'off'});
    active.registration.waiting={};active.control.version='v-three';
    const job=await navigation(active);await active.clock.tick(15000);await job.done;
    const state=await active.probe.readContentState();
    assert.equal(state.version,'v-three');
    assert.equal(active.stores.get('nav-html-v-three').has('https://example.test/zh/offline/'),false);
    const restarted=contentRuntime({stores:runtime.stores,clock:runtime.clock});restarted.control.fail=true;
    let activated;restarted.listeners.activate({waitUntil:task=>{activated=task;}});await activated;
    assert.equal(restarted.requests.length,0,'Activation must use prepared data without network requests.');
    assert.deepEqual(await restarted.probe.readContentState(),state,'Activation must retain the active program\'s final content state.');
    for(const prefix of ['','zh-tw/']){
      const response=await dispatch(restarted.listeners,requestFor('/'+prefix+'uncached-after-activation/',true));
      assert.match(await response.text(),/v-three/,'Prepared pages must not replace newer offline responses.');
    }
    const added=await dispatch(restarted.listeners,requestFor('/zh/uncached-after-activation/',true));
    assert.match(await added.text(),/v-two/,'The new program must still fill its missing offline path.');
  }
});

test('missing or invalid content state is staged and initialized offline on activation for every offline policy',async()=>{
  const url='https://example.test/sw-version.json';
  for(const bucket of ['versioned','fingerprinted','off'])for(const invalid of [false,true]){
    const entries=new Map(invalid?[[url,Response.json({version:'',lastAttemptAt:1})]]:[]);
    const runtime=contentRuntime({stores:new Map([['sw-content-state',entries]])});
    runtime.probe.SW_ROUTES.unshift({path:'/*offline/',bucket});
    runtime.stores.set('nav-html-obsolete',new Map());
    const before=await runtime.probe.readContentState();
    let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});await installed;
    assert.deepEqual(await runtime.probe.readContentState(),before,'Install must not publish bootstrap metadata.');
    assert.equal(runtime.probe.currentGeneration,null);
    assert.ok(runtime.stores.has('nav-html-obsolete'),'Install must not clean content buckets.');
    assert.equal(versionRequests(runtime).length,1);
    assert.equal(versionRequests(runtime)[0].cache,'no-store');
    const restarted=contentRuntime({stores:runtime.stores,clock:runtime.clock});
    restarted.probe.SW_ROUTES.unshift({path:'/*offline/',bucket});restarted.control.fail=true;
    let activated;restarted.listeners.activate({waitUntil:task=>{activated=task;}});await activated;
    assert.equal(restarted.requests.length,0,'Bootstrap activation must use only prepared data.');
    assert.equal(restarted.probe.currentGeneration.version,'v-two');
    assert.deepEqual(await restarted.probe.readContentState(),{version:'v-two',lastAttemptAt:runtime.clock.Date.now()});
    assert.equal(runtime.stores.has('nav-html-obsolete'),false);
    assert.equal(runtime.stores.has(runtime.probe.PROGRAM_OFFLINE_CACHE),false);
    const response=dispatch(restarted.listeners,requestFor('/unvisited-after-enable/',true));
    if(bucket==='off')await assert.rejects(response,/no cached response/);
    else assert.match(await (await response).text(),/v-two/);
  }
});

test('bootstrap staging does not overwrite a concurrent active content commit',async()=>{
  let release,start;
  const started=new Promise(resolve=>{start=resolve;});
  const runtime=contentRuntime({stores:new Map([['sw-content-state',new Map()]]),respond:request=>{
    if(new URL(request.url).pathname==='/sw-version.json')return new Promise(resolve=>{release=resolve;start();});
  }});
  let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});await started;
  const finalState={version:'v-final',lastAttemptAt:runtime.clock.Date.now()+1};
  runtime.stores.get('sw-content-state').set('https://example.test/sw-version.json',Response.json(finalState));
  runtime.stores.set('nav-html-v-final',new Map());runtime.stores.set('asset-versioned-v-final',new Map());
  release(Response.json({version:'v-bootstrap'}));await installed;
  assert.deepEqual(await runtime.probe.readContentState(),finalState);
  assert.ok(runtime.stores.has('nav-html-v-final'));assert.ok(runtime.stores.has('asset-versioned-v-final'));
  assert.equal(runtime.stores.has('nav-html-v-bootstrap'),false);
  const restarted=contentRuntime({stores:runtime.stores,clock:runtime.clock});restarted.control.fail=true;
  let activated;restarted.listeners.activate({waitUntil:task=>{activated=task;}});await activated;
  assert.equal(restarted.requests.length,0);assert.equal(restarted.probe.currentGeneration.version,'v-final');
  assert.deepEqual(await restarted.probe.readContentState(),finalState);
  assert.equal(runtime.stores.has('nav-html-v-bootstrap'),false);
});

test('reinstalling the same program replaces its stale stage without touching another program',async()=>{
  const runtime=contentRuntime(),stage=runtime.probe.PROGRAM_OFFLINE_CACHE;
  runtime.stores.set('nav-html-v-one',new Map([['https://example.test/offline/',
    new Response('Previous program offline page',{headers:{'Content-Type':'text/html'}})]]));
  runtime.stores.set(stage,new Map(['','zh/','zh-tw/'].map(prefix=>[
    'https://example.test/'+prefix+'offline/',new Response('Old offline page',{headers:{'Content-Type':'text/html'}})
  ])));
  runtime.stores.get(stage).set('https://example.test/sw-version.json',Response.json({version:'v-stale'}));
  const another=new Map([['https://example.test/keep/',new Response('Keep')]]);
  runtime.stores.set('sw-program-offline-another-install',another);
  const before=await runtime.probe.readContentState();
  let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});await installed;
  assert.equal(runtime.requests.filter(request=>new URL(request.url).pathname.endsWith('/offline/')).length,3);
  assert.deepEqual(await runtime.stores.get(stage).get('https://example.test/sw-version.json').clone().json(),before);
  assert.equal(runtime.stores.get('sw-program-offline-another-install'),another);
  assert.deepEqual(await runtime.probe.readContentState(),before);
  runtime.control.fail=true;
  let activated;runtime.listeners.activate({waitUntil:task=>{activated=task;}});await activated;
  assert.match(await (await dispatch(runtime.listeners,requestFor('/after-reinstall/',true))).text(),/v-two/);
});

test('first installation publishes content before activation and removes a stage left after unregistering',async()=>{
  const runtime=contentRuntime(),stage=runtime.probe.PROGRAM_OFFLINE_CACHE;
  runtime.registration.active=null;
  runtime.stores.set(stage,new Map(['','zh/','zh-tw/'].map(prefix=>[
    'https://example.test/'+prefix+'offline/',new Response('Old offline page',{headers:{'Content-Type':'text/html'}})
  ])));
  runtime.stores.set('sw-program-offline-another-install',new Map());
  let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});await installed;
  assert.equal(runtime.probe.currentGeneration.version,'v-two','First installation must prepare its initial content generation.');
  assert.equal((await runtime.probe.readContentState()).version,'v-two');
  assert.equal(runtime.stores.has(stage),false);
  assert.ok(runtime.stores.has('sw-program-offline-another-install'));
  runtime.control.fail=true;
  let activated;runtime.listeners.activate({waitUntil:task=>{activated=task;}});await activated;
  assert.match(await (await dispatch(runtime.listeners,requestFor('/after-unregister-reinstall/',true))).text(),/v-two/);
});

test('bootstrap JSON failures reject installation without publishing content state',async()=>{
  for(const fault of ['invalid','network','timeout']){
    const runtime=contentRuntime({stores:new Map([['sw-content-state',new Map()]]),respond:request=>{
      if(new URL(request.url).pathname!=='/sw-version.json')return;
      if(fault==='invalid')return Response.json({version:''});
      if(fault==='network')throw new TypeError('Network unavailable');
      return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    }});
    runtime.stores.set('sw-program-offline-another-install',new Map());
    let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});
    const rejected=assert.rejects(installed,/Invalid content version|Network unavailable|Aborted/);
    if(fault==='timeout'){await new Promise(setImmediate);await runtime.clock.tick(10000);}
    await rejected;
    assert.equal(await runtime.probe.readContentState(),null);
    assert.equal(runtime.stores.has(runtime.probe.PROGRAM_OFFLINE_CACHE),false);
    assert.ok(runtime.stores.has('sw-program-offline-another-install'));
    assert.ok(![...runtime.stores.keys()].some(name=>/^(nav-html-|asset-versioned-)/.test(name)));
  }
});

test('metadata storage errors reject installation instead of treating unknown state as missing',async()=>{
  const output=contentOutput??=passed(build('content-version'));
  for(const operation of ['open','match']){
    const stores=new Set(['sw-program-offline-another-install']);let requests=0;
    const runtime=worker(output,{self:{registration:{active:{},addEventListener(){}}},
      fetch:async()=>{requests++;throw new Error('Unexpected fetch');},caches:{
      async delete(name){return stores.delete(name);},
      async open(name){
        if(name==='sw-content-state'&&operation==='open')throw new Error('Storage failed');
        stores.add(name);return {async match(){throw new Error('Storage failed');}};
      }
    }});
    let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});
    await assert.rejects(installed,/Storage failed/);
    assert.equal(requests,0);assert.equal(stores.has(runtime.probe.PROGRAM_OFFLINE_CACHE),false);
    assert.ok(stores.has('sw-program-offline-another-install'));
  }
});

test('failed or timed-out program offline preparation rejects installation and removes only its own stage',async()=>{
  for(const fault of ['html','asset','timeout']) {
    const runtime=contentRuntime({respond:request=>{
      const pathname=new URL(request.url).pathname;
      if(fault==='asset'&&pathname==='/js/common.hash.js')throw new TypeError('Asset unavailable');
      if(!pathname.endsWith('/offline/'))return;
      if(fault==='html')return new Response('Missing offline page',{status:404});
      if(fault==='timeout')return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    }});
    runtime.stores.set('nav-html-v-one',new Map());
    runtime.stores.set('sw-program-offline-another-install',new Map());
    const before=await runtime.probe.readContentState();
    let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});
    const rejected=assert.rejects(installed,/Program offline fallback preparation failed/);
    if(fault==='timeout'){await new Promise(setImmediate);await runtime.clock.tick(10000);}
    await rejected;
    assert.deepEqual(await runtime.probe.readContentState(),before);
    assert.equal(runtime.stores.has(runtime.probe.PROGRAM_OFFLINE_CACHE),false);
    assert.ok(runtime.stores.has('nav-html-v-one'));
    assert.ok(runtime.stores.has('sw-program-offline-another-install'));
  }
});

test('program preparation and activation preserve fingerprinted offline routes',async()=>{
  const runtime=contentRuntime();
  runtime.probe.SW_ROUTES.unshift({path:'/*offline/',bucket:'fingerprinted'});
  let installed;runtime.listeners.install({waitUntil:task=>{installed=task;}});await installed;
  assert.ok(runtime.stores.get('asset-fingerprint').has('https://example.test/offline/'));
  runtime.control.fail=true;
  let activated;runtime.listeners.activate({waitUntil:task=>{activated=task;}});await activated;
  assert.equal(runtime.stores.has(runtime.probe.PROGRAM_OFFLINE_CACHE),false);
  const response=await dispatch(runtime.listeners,requestFor('/uncached-fingerprinted-offline/',true));
  assert.equal(response.ok,true);assert.match(await response.text(),/v-two/);
});

test('hung JSON requests time out and release the shared check task',async()=>{
  const runtime=contentRuntime({respond:request=>new URL(request.url).pathname==='/sw-version.json'?
    new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})):undefined});
  const job=await navigation(runtime);await runtime.clock.tick(15000);
  assert.equal(versionRequests(runtime).length,1);
  await runtime.clock.tick(10000);await job.done;
  assert.equal(runtime.probe.contentCheckTask,null);
  assert.equal(runtime.probe.currentGeneration.version,'v-one');
});

test('unchanged-version checks do not wait on an older uncancellable warmup',{timeout:5000},async()=>{
  let releaseOld,startOld,startCheck,offlineRequests=0,deadlineTimer;
  const oldStarted=new Promise(resolve=>{startOld=resolve;});
  const checkStarted=new Promise(resolve=>{startCheck=resolve;});
  const runtime=contentRuntime({respond:request=>{
    if(!new URL(request.url).pathname.endsWith('/offline/'))return;
    if(++offlineRequests===1)return new Promise(resolve=>{
      releaseOld=()=>resolve(new Response('Offline',{headers:{'Content-Type':'text/html'}}));
      startOld();
    });
    startCheck();
    return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
  }});
  runtime.control.version='v-one';
  const oldWarmup=runtime.probe.warmNavigationUrl('https://example.test/offline/');
  await oldStarted;
  const deadline=new Promise((resolve,reject)=>{
    deadlineTimer=setTimeout(()=>reject(new Error('The version check must finish without releasing the older warmup.')),2000);
  });
  try{
    const job=await navigation(runtime);await runtime.clock.tick(15000);
    await Promise.race([checkStarted,deadline]);
    await runtime.clock.tick(10000);await Promise.race([job.done,deadline]);
    assert.equal(runtime.probe.contentCheckTask,null);
    assert.equal(runtime.probe.currentGeneration.version,'v-one');
  }finally{
    clearTimeout(deadlineTimer);runtime.probe.cancelContentVersionCheck();releaseOld();await oldWarmup;
  }
});

test('empty route overrides and inline prefetch rules do not restore cache defaults',()=>{
  const empty=passed(build('empty','routes = []\n'));
  assert.equal(worker(empty).probe.SW_ROUTES.length,0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(empty,'sw-policy.json'),'utf8')),[]);
  const headers=parseHeaders(fs.readFileSync(path.join(empty,'_headers'),'utf8'));
  assert.equal(headers.length,1);assert.ok(cloudflareHeaders(headers,'/')['content-security-policy']);
  assert.equal(cloudflareHeaders(headers,'/')['cache-control'],undefined);
  const optional=passed(build('optional','[prefetch]\nenabled = true\n'+
    '[prefetch.icons.folder]\nroot = "moderate"\n'));
  const rules=parseHeaders(fs.readFileSync(path.join(optional,'_headers'),'utf8'));
  assert.ok(rules.some(rule=>rule.source==='/site/pwa/*.webmanifest'));
  assert.match(fs.readFileSync(path.join(optional,'index.html'),'utf8'),/<link\b[^>]*\brel=["']?manifest\b/);
  assert.equal(cloudflareHeaders(rules,'/site/generated.hash.json')['cache-control'],'public, max-age=31536000, immutable');
  assert.equal(cloudflareHeaders(rules,'/site/generated.hash.json')['content-type'],undefined);
  assert.equal(worker(optional).probe.getMatchingRoute('/site/generated.hash.json').bucket,'fingerprinted');
  assert.ok(!rules.some(rule=>rule.source==='/site/speculation-rules/*'));
  const custom=passed(build('optional-no-cache','routes = []\n'+
    '[prefetch]\nenabled = true\n'+
    '[prefetch.icons.folder]\nroot = "moderate"\n'));
  const customHeaders=parseHeaders(fs.readFileSync(path.join(custom,'_headers'),'utf8'));
  assert.equal(cloudflareHeaders(customHeaders,'/site/generated.hash.json')['cache-control'],undefined,
    'Native rules must not restore caching removed by the site.');
  assert.equal(customHeaders.length,1);
  assert.equal(worker(custom).probe.SW_ROUTES.length,0);
});

test('invalid and retired policy fields fail the build instead of silently changing caching',()=>{
  const bad=[
    ['old-platform','[edgeone]\nhugoVersion = "0.156.0"',/unknown field/],
    ['old-route','[[routes]]\npath = "/*"\nscope = "asset"',/unknown field/],
    ['old-headers','[[routes]]\npath = "/*"\nheaders.Cache-Control = "no-cache"',/unknown field/],
    ['platform-field','[platform.edgeone.makers]\nheaders = "invalid"',/unsupported platform/],
    ['vendor-only','[platform.edgeone]\nnodeVersion = "22.11.0"',/unsupported platform/],
    ['wrong-product','[platform.edgeone.pages]\nnodeVersion = "22.11.0"',/unsupported platform/],
    ['missing-enabled','[platform.cloudflare.pages]\n',/enabled must be a boolean/],
    ['enabled-type','[platform.edgeone.makers]\nenabled = "false"',/enabled must be a boolean/],
    ['platform-type','platform = false',/must be a table/],
    ['prefetch-type','prefetch = false',/prefetch must be a table/],
    ['old-runtime','[prefetch_runtime]\nmode = "off"',/unknown field "prefetch_runtime"/],
    ['old-speculation','[speculation_rules]\nmode = "off"',/unknown field "speculation_rules"/],
    ['prefetch-enabled','[prefetch]\nenabled = "off"',/prefetch.enabled must be a boolean/],
    ['old-http','[[routes]]\npath = "/*"\nhttp.cloudflare.unset = ["Cache-Control"]',/unknown field/],
    ['headers-type','[[routes]]\npath = "/*"\nhttp.headers = false',/must be a table/],
    ['unset-type','[[routes]]\npath = "/*"\nhttp.cloudflare.pages.unset = false',/array of header names/],
    ['path','[[routes]]\npath = "/a/*/*.json"',/at most one/],
    ['query','[[routes]]\npath = "/a?x=1"',/without whitespace/],
    ['kind','[[routes]]\npath = "/*"\nsw.kind = "navigation"\nsw.bucket = "versioned"',/sw: unknown field "kind"/],
    ['mode','[[routes]]\npath = "/*"\nsw.mode = "cache-first"\nsw.bucket = "versioned"',/sw: unknown field "mode"/],
    ['bucket','[[routes]]\npath = "/*"\nsw.bucket = "ignore"',/sw.bucket must be/],
    ['missing-bucket','[[routes]]\npath = "/*"\nsw = {}',/sw.bucket must be/],
    ['bucket-type','[[routes]]\npath = "/*"\nsw.bucket = false',/sw.bucket must be/],
    ['unset','[[routes]]\npath = "/*"\nhttp.cloudflare.pages.unset = "Cache-Control"',/array of header names/],
    ['header-name','[[routes]]\npath = "/*"\nhttp.headers."X Bad" = "yes"',/invalid or duplicate header/],
    ['header-value','[[routes]]\npath = "/*"\nhttp.headers.X-Test = 1',/values must be strings/],
    ['header-duplicate','[[routes]]\npath = "/*"\nhttp.headers.X_Test = "one"\nhttp.headers.x_test = "two"',/invalid or duplicate header/],
    ['header','[[routes]]\npath = "/*"\nhttp.headers.X-Test = "bad\\nheader"',/without control/],
    ['unset-name','[[routes]]\npath = "/*"\nhttp.cloudflare.pages.unset = ["X Bad"]',/invalid Cloudflare unset header/],
    ['unset-value','[[routes]]\npath = "/*"\nhttp.cloudflare.pages.unset = [1]',/invalid Cloudflare unset header/],
    ['http-field','[[routes]]\npath = "/*"\nhttp.edgeone.makers.unset = ["Cache-Control"]',/unknown field/]
  ];
  for(const [name,policy,message] of bad) {
    const result=build('invalid-'+name,policy);assert.notEqual(result.status,0,name);assert.match(result.log,message);
  }
});

test('site-owned parameter entries and data files do not change delivery',()=>{
  const name='site-owned-config',overlay=path.join(work,name,'data');
  for(const file of ['cache-policy','cache-policy-default'])write(path.join(overlay,file+'.toml'),'routes = []\n');
  const config=['prefetch','prefetch_runtime','speculation_rules','service_worker','link_prefetch']
    .map(key=>'[params.'+key+']\nmode = "site-owned"\n').join('');
  const output=passed(build(name,undefined,config));
  assert.equal(worker(output).probe.getMatchingRoute('/').bucket,'versioned');
  const rules=parseHeaders(fs.readFileSync(path.join(output,'_headers'),'utf8'));
  assert.equal(cloudflareHeaders(rules,'/')['cache-control'],'public, max-age=900, must-revalidate');
});

test('shared Cloudflare parsing and local serving apply append, unset and case-insensitive header names',async()=>{
  const root=path.join(work,'server');write(path.join(root,'index.html'),'fixture');
  const text='/*\n  X-List: first\n  X-Remove: remove\n  Cache-Control: max-age=900\n'+
    '/\n  x-list: second\n  ! x-remove\n  ! cache-control\n  Cache-Control: max-age=0\n';
  write(path.join(root,'_headers'),text);
  assert.equal(cloudflareHeaders(parseHeaders(text),'/')['x-list'],'first, second');
  assert.equal(cloudflareHeaders(parseHeaders('/*\n  Content-Type: custom/type'),'/test',{'Content-Type':'text/html'})['content-type'],'custom/type');
  assert.equal(cloudflareHeaders(parseHeaders('/*\n  ! Content-Type'),'/test',{'Content-Type':'text/html'})['content-type'],undefined);
  assert.throws(()=>parseHeaders('/*\n  ! invalid header'),/Invalid/);
  const server=await createStaticSiteServer(root);await server.start();
  try {
    const response=await fetch(server.getBaseUrl()+'/');
    assert.equal(response.headers.get('x-list'),'first, second');
    assert.equal(response.headers.get('x-remove'),null);
    assert.equal(response.headers.get('cache-control'),'max-age=0');
    await response.text();
  } finally {await server.stop();}
});
