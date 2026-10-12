import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {parseHeaders,cloudflareHeaders} from '../.agents/skills/swaw-banyan/tasks/_shared/headers.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),parent=fs.realpathSync(os.tmpdir());
let work;
function write(file,body) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}
function build(name,policy,config='') {
  const directory=path.join(work,name),overlay=path.join(directory,'data'),assets=path.join(work,'assets');
  if(policy!==undefined)write(path.join(overlay,'cache-policy.toml'),policy);
  const mounts=[['assets',assets],['assets','assets'],...(policy===undefined?[]:[['data',overlay],['data','data']])]
    .map(([target,source])=>'[[module.mounts]]\nsource = '+JSON.stringify(source.replaceAll('\\','/'))+'\ntarget = "'+target+'"\n').join('');
  const configFile=path.join(directory,'fixture.toml'),output=path.join(directory,'public');
  write(configFile,mounts+'[params.service_worker]\nmode = "enable"\n'+config);
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+configFile,'--destination',output],
    {cwd:root,env:fixtureEnvironment(directory),encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
  assert.ifError(result.error);
  return {...result,log:result.stdout+result.stderr,output};
}
function passed(result) {assert.equal(result.status,0,result.log);assert.doesNotMatch(result.log,/\bWARN\b/);return result.output;}
function worker(output,environment={}) {
  const listeners={};
  const context=vm.createContext({URL,URLSearchParams,Request,Response,...environment,
    self:{location:new URL('https://example.test/sw.js'),addEventListener:(name,handler)=>{listeners[name]=handler;}}});
  vm.runInContext(fs.readFileSync(path.join(output,'sw.js'),'utf8'),context);
  return {probe:context.probe,listeners};
}
function cachedWorker(output,respond) {
  const stores=new Map(),requests=[];
  const caches={async open(name) {
    if(!stores.has(name))stores.set(name,new Map());
    const entries=stores.get(name);
    return {
      async match(request){return entries.get(request.url)?.clone();},
      async put(request,response){entries.set(request.url,response.clone());}
    };
  }};
  const runtime=worker(output,{caches,fetch:async request=>{requests.push(request);return respond(request);}});
  return {...runtime,stores,requests};
}
function requestFor(pathname,navigation=false) {
  const request=new Request('https://example.test'+pathname);
  if(navigation)Object.defineProperty(request,'mode',{value:'navigate'});
  return request;
}
function dispatch(listeners,request) {
  let response;
  listeners.fetch({request,respondWith:promise=>{response=promise;}});
  return response;
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-policy-'));
  const source=fs.readFileSync(path.join(root,'module/assets/js/pwa/worker-enable.js.tmpl'),'utf8');
  write(path.join(work,'assets/js/pwa/worker-enable.js.tmpl'),source+
    '\nglobalThis.probe = {SW_ROUTES,matchesRoutePath,getMatchingRoute,getRequestPathname,isHtmlDocumentRequest,getCacheNameForRoute,warmNavigationUrl};\n');
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
    ['/sw.js','no-cache, max-age=0, must-revalidate']])
    assert.equal(cloudflareHeaders(rules,url)['cache-control'],expected,url);
  assert.equal(cloudflareHeaders(rules,'/site/pwa/app.hash.webmanifest')['content-type'],'application/manifest+json; charset=utf-8');
  const xml=cloudflareHeaders(rules,'/zh/index.xml')['content-security-policy'];
  assert.match(xml,/^default-src 'none';/);assert.ok(!xml.includes('script-src'));
  assert.equal(edge.headers.find(rule=>rule.source==='/site/pwa/*.webmanifest').headers.length,1);
  const {probe}=worker(output);
  assert.equal(probe.getMatchingRoute('/icp/').bucket,'versioned');
  assert.equal(probe.getMatchingRoute('/site/pwa/app.hash.webmanifest').bucket,'fingerprinted');
  assert.equal(probe.getMatchingRoute('/sw.js').bucket,'off');
  assert.equal(probe.getMatchingRoute('/unconfigured.txt').bucket,'versioned');
  for(const route of probe.SW_ROUTES) assert.deepEqual(Object.keys(route).sort(),['bucket','path']);
  assert.equal(fs.existsSync(path.join(output,'sw-policy.json')),false);
});

test('platform values override common values only within their own route and platform',()=>{
  const policy='[platform.edgeone]\nnodeVersion = "20.18.0"\n'+
    '[[routes]]\npath = "/*"\nhttp.headers.X-Common = "yes"\nhttp.headers.X-Value = "common"\n'+
    'http.cloudflare.headers.x-value = "cf"\nhttp.edgeone.headers.X-Value = "eo"\n'+
    '[[routes]]\npath = "/cf-only/*"\nhttp.cloudflare.headers.X-Only = "cf"\n'+
    '[[routes]]\npath = "/eo-only/*"\nhttp.edgeone.headers.X-Only = "eo"\n'+
    '[[routes]]\npath = "/remove/*"\nhttp.cloudflare.unset = ["X-Value"]\n';
  const output=passed(build('platform',policy)),rules=parseHeaders(fs.readFileSync(path.join(output,'_headers'),'utf8'));
  const edge=JSON.parse(fs.readFileSync(path.join(output,'edgeone.json'),'utf8'));
  assert.equal(cloudflareHeaders(rules,'/')['x-value'],'cf');
  assert.equal(cloudflareHeaders(rules,'/remove/a')['x-value'],undefined);
  assert.equal(cloudflareHeaders(rules,'/')['x-common'],'yes');
  assert.equal(edge.headers[0].headers.find(header=>header.key.toLowerCase()==='x-value').value,'eo');
  assert.ok(!edge.headers.some(route=>route.source==='/cf-only/*'||route.source==='/remove/*'));
  assert.ok(!rules.some(route=>route.source==='/eo-only/*'));
  assert.equal(edge.nodeVersion,'20.18.0');assert.equal(edge.buildCommand,'hugo --minify --gc --cleanDestinationDir');
  assert.equal(worker(output).probe.SW_ROUTES.length,0);
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

test('bucket caching preserves query keys, validates versioned responses and warms only fingerprinted resources',async()=>{
  const output=passed(build('cache-behavior'));
  let offline=false;
  const runtime=cachedWorker(output,request=>{
    if(offline)throw new TypeError('Network unavailable');
    const url=new URL(request.url);
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
  await probe.warmNavigationUrl('https://example.test/about/?from=notes&sort=title&sorts=date&keep=1');
  assert.equal(requests.find(request=>new URL(request.url).pathname==='/about/').cache,'no-cache');
  assert.equal(requests.find(request=>new URL(request.url).pathname==='/js/app.hash.js').cache,'default');
  assert.equal(requests.some(request=>['/unvisited/','/data.json','/sw.js'].includes(new URL(request.url).pathname)
    &&!new URL(request.url).search),false,'Page links, versioned assets and off rules must not become asset warmups.');
  const navigationCache=stores.get(probe.getCacheNameForRoute(probe.getMatchingRoute('/about/'),true));
  assert.ok(navigationCache.has('https://example.test/about/?keep=1'));
  const beforeNavigation=requests.length;
  await dispatch(listeners,requestFor('/about/?from=tags&sort=date&keep=1',true));
  assert.equal(requests.length,beforeNavigation,'Changing UI parameters must reuse the page cache.');
  for(let attempt=0;attempt<2;attempt++) {
    assert.equal((await dispatch(listeners,requestFor('/error/',true))).status,404);
    assert.match((await dispatch(listeners,requestFor('/not-html/',true))).headers.get('content-type'),/json/);
  }
  assert.equal(navigationCache.has('https://example.test/error/'),false);
  assert.equal(navigationCache.has('https://example.test/not-html/'),false);
  let installed;listeners.install({waitUntil:promise=>{installed=promise;}});await installed;
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
  const {listeners,requests}=cachedWorker(passed(build('offline-off',policy)),()=>{throw new TypeError('Offline');});
  let installed;listeners.install({waitUntil:promise=>{installed=promise;}});await installed;
  assert.equal(requests.length,0);
  await assert.rejects(dispatch(listeners,requestFor('/uncached/',true)),/no cached response/);
  assert.equal(requests.length,1,'Disabled offline pages must not be fetched through fallback.');
});

test('empty route overrides and disabled optional assets do not restore defaults',()=>{
  const empty=passed(build('empty','routes = []\n'));
  assert.equal(worker(empty).probe.SW_ROUTES.length,0);
  const headers=parseHeaders(fs.readFileSync(path.join(empty,'_headers'),'utf8'));
  assert.equal(headers.length,1);assert.ok(cloudflareHeaders(headers,'/')['content-security-policy']);
  assert.equal(cloudflareHeaders(headers,'/')['cache-control'],undefined);
  const optional=passed(build('optional',undefined,'[params.web_app_manifest]\nmode = "off"\n[params.speculation_rules]\nmode = "header"\nnav = "prefetch_moderate"\n'));
  const rules=parseHeaders(fs.readFileSync(path.join(optional,'_headers'),'utf8'));
  assert.ok(!rules.some(rule=>rule.source==='/site/pwa/*.webmanifest'));
  assert.equal(cloudflareHeaders(rules,'/site/speculation-rules/document.hash.json')['cache-control'],'public, max-age=31536000, immutable');
  assert.equal(cloudflareHeaders(rules,'/site/speculation-rules/document.hash.json')['content-type'],'application/speculationrules+json');
  assert.equal(worker(optional).probe.getMatchingRoute('/site/speculation-rules/document.hash.json').bucket,'fingerprinted');
  assert.deepEqual(rules.find(rule=>rule.source==='/site/speculation-rules/*').headers,
    [{key:'Content-Type',value:'application/speculationrules+json'}]);
  const custom=passed(build('optional-no-cache','routes = []\n',
    '[params.speculation_rules]\nmode = "header"\nnav = "prefetch_moderate"\n'));
  const customHeaders=parseHeaders(fs.readFileSync(path.join(custom,'_headers'),'utf8'));
  assert.equal(cloudflareHeaders(customHeaders,'/site/speculation-rules/document.hash.json')['cache-control'],undefined,
    'Generated MIME headers must not restore caching removed by the site.');
  assert.equal(worker(custom).probe.SW_ROUTES.length,0);
});

test('invalid and retired policy fields fail the build instead of silently changing caching',()=>{
  const bad=[
    ['old-platform','[edgeone]\nhugoVersion = "0.156.0"',/unknown field/],
    ['old-route','[[routes]]\npath = "/*"\nscope = "asset"',/unknown field/],
    ['old-headers','[[routes]]\npath = "/*"\nheaders.Cache-Control = "no-cache"',/unknown field/],
    ['platform-field','[platform.edgeone]\nheaders = "invalid"',/unsupported platform/],
    ['platform-type','platform = false',/must be a table/],
    ['headers-type','[[routes]]\npath = "/*"\nhttp.headers = false',/must be a table/],
    ['unset-type','[[routes]]\npath = "/*"\nhttp.cloudflare.unset = false',/array of header names/],
    ['path','[[routes]]\npath = "/a/*/*.json"',/at most one/],
    ['query','[[routes]]\npath = "/a?x=1"',/without whitespace/],
    ['kind','[[routes]]\npath = "/*"\nsw.kind = "navigation"\nsw.bucket = "versioned"',/sw: unknown field "kind"/],
    ['mode','[[routes]]\npath = "/*"\nsw.mode = "cache-first"\nsw.bucket = "versioned"',/sw: unknown field "mode"/],
    ['bucket','[[routes]]\npath = "/*"\nsw.bucket = "ignore"',/sw.bucket must be/],
    ['missing-bucket','[[routes]]\npath = "/*"\nsw = {}',/sw.bucket must be/],
    ['bucket-type','[[routes]]\npath = "/*"\nsw.bucket = false',/sw.bucket must be/],
    ['unset','[[routes]]\npath = "/*"\nhttp.cloudflare.unset = "Cache-Control"',/array of header names/],
    ['header','[[routes]]\npath = "/*"\nhttp.headers.X-Test = "bad\\nheader"',/without control/],
    ['http-field','[[routes]]\npath = "/*"\nhttp.edgeone.unset = ["Cache-Control"]',/unknown field/]
  ];
  for(const [name,policy,message] of bad) {
    const result=build('invalid-'+name,policy);assert.notEqual(result.status,0,name);assert.match(result.log,message);
  }
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
