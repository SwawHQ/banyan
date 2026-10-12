import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {hugoEnvironment} from '../.agents/skills/swaw-banyan/scripts.js/hugo/index.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {inspectDocumentMetadata} from '../.agents/skills/swaw-banyan/tasks/check/html/metadata/document.mjs';
import {inspectDocumentControls} from '../.agents/skills/swaw-banyan/tasks/check/html/scripts/controls.mjs';

const source = fileURLToPath(new URL('../.agents/skills/swaw-banyan/',import.meta.url));
const parent = path.resolve(os.tmpdir());
let work,skill,site,origin,server;
const hash = value => createHash('sha256').update(value).digest('hex');
const security = {
  'Content-Security-Policy':"default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin'
};
const rules = JSON.stringify({prefetch:[{source:'document',where:{selector_matches:'a[data-prefetch-slot=nav]'},eagerness:'eager'}]});
const rulesPath = '/site/speculation-rules/document.' + hash(rules) + '.json';
const updatePanel='<div data-site-update-panel><p>Controlled: <span data-pwa-controlled>—</span></p><p data-site-update-status role=status aria-live=polite></p></div>';
const updateAction='<button type=button data-site-update-action=check><span data-site-update-action-label>Check</span></button>';
const dateRow=value=>'<div class=document-meta__row><span><svg><use href=#icon-clock></use></svg></span><time datetime="'+value+'">'+value+'</time></div>';
const metadata=inner=>'<div class=document-meta>'+inner+'</div>';
const asideScript='<script src=/js/document/aside.fixture.js></script>';
const tocScript='<script src=/js/document/toc.fixture.js></script>';
const toggle='<button id=document-aside-toggle type=button aria-controls=document-aside>Chapters</button>';
const close='<button id=document-aside-close type=button aria-controls=document-aside>Hide</button>';
function write(root,name,text) {
  const file = path.join(root,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text);
}
function cli(command,args=[],cwd=site) {
  const result = spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),command,...args],{cwd,encoding:'utf8',timeout:15000});
  assert.ifError(result.error); return result;
}
function cliAsync(command,args) {
  return new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),command,...args],{cwd:site,stdio:['ignore','pipe','pipe']});
    let stdout = '',stderr = '';
    const timer = setTimeout(() => child.kill(),15000);
    child.stdout.on('data',chunk => {stdout += chunk;});
    child.stderr.on('data',chunk => {stderr += chunk;});
    child.on('error',error => {clearTimeout(timer); reject(error);});
    child.on('close',status => {clearTimeout(timer); resolve({status,stdout,stderr});});
  });
}
function output(name,text) {
  const root = path.join(site,name);
  fs.cpSync(path.join(site,'public'),root,{recursive:true});
  if (text !== undefined) write(root,'index.html',text);
  return root;
}
function checked(command,directory,pattern) {
  const result = cli(command,[directory]);
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stderr,pattern);
}
before(async () => {
  work = fs.mkdtempSync(path.join(parent,'banyan-checks-'));
  skill = path.join(work,'skill with spaces'); site = path.join(work,'site');
  fs.mkdirSync(skill); fs.mkdirSync(site);
  for (const name of fs.readdirSync(source)) if (!['.tools','node_modules'].includes(name)) fs.cpSync(path.join(source,name),path.join(skill,name),{recursive:true,filter:file => !file.split(path.sep).includes('node_modules')});
  const runtime = process.versions.bun ? 'bun' : 'node';
  const {resolveBinding} = await import(pathToFileURL(path.join(source,'scripts.js/_toolchain/bindings.mjs')));
  const tools = {};
  for (const name of ['hugo','go','git']) tools[name] = {...resolveBinding(name),source:'path'};
  tools[runtime] = {source:'path',path:process.execPath,version:process.versions.bun ?? process.versions.node};
  const {writeBindings} = await import(pathToFileURL(path.join(skill,'scripts.js/_toolchain/bindings.mjs')));
  writeBindings({schema:'swaw-banyan.bindings/v1',runtime,tools},path.join(skill,'.tools'));
  write(site,'hugo.toml','baseURL = "https://example.test/"\n[params.media.responsive_images]\nmax_width = 600\nsizes = "auto, 600px"\n');
  write(site,'content/_index.md','---\ntitle: Home\nshare_image: false\n---\n');
  write(site,'public/index.html','<html lang=en><head><title>Home</title><meta name=description content="Home description"><link rel=canonical href="https://example.test/"></head><body><h1>Home</h1><script src="/js/main.0123456789abcdef.js"></script></body></html>');
  write(site,'public/js/main.0123456789abcdef.js','void 0;');
  write(site,'public/robots.txt','User-agent: *\nSitemap: https://example.test/sitemap.xml');
  write(site,'public/sitemap.xml','<urlset><url><loc>https://example.test/</loc></url></urlset>');
  server = createServer((request,response) => {
    const url = new URL(request.url,'http://localhost');
    if (url.pathname.startsWith('/site/speculation-rules/')) {
      response.setHeader('Content-Type','application/json');
      response.end(url.searchParams.has('bad') ? '{}' : rules); return;
    }
    if (url.pathname === '/failed') {response.statusCode=503; response.end(); return;}
    for (const [key,value] of Object.entries(security)) response.setHeader(key,value);
    response.setHeader('Cache-Control','no-cache, max-age=0, must-revalidate');
    if (url.searchParams.has('bad-csp')) response.removeHeader('Content-Security-Policy');
    if (url.searchParams.has('bad-cache')) response.setHeader('Cache-Control','public, max-age=3600, immutable');
    if (url.searchParams.has('spec')) response.setHeader('Speculation-Rules','"' + rulesPath + '"');
    if (url.searchParams.has('bad-spec')) response.setHeader('Speculation-Rules','"https://other.test/rules.json"');
    response.end();
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (work) {assert.equal(path.dirname(work),parent); assert.ok(path.basename(work).startsWith('banyan-checks-')); fs.rmSync(work,{recursive:true,force:true});}
});

test('individual HTML checks and reports ignore defects outside their own responsibility',() => {
  const html = fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const directory = output('bad jsonld',html.replace('</head>','<script type="application/ld+json">{broken}</script></head>'));
  checked('check/html/jsonld',directory,/Invalid JSON-LD/);
  for (const command of ['check/html/metadata','check/html/headings','check/html/scripts','check/sitemap','report/size/html','report/size/js']) {
    assert.equal(cli(command,[directory]).status,0,command);
  }
  const headings = output('multiple h1',html.replace('</body>','<h1>Second</h1></body>'));
  checked('check/html/headings',headings,/multiple H1/);
  assert.equal(cli('check/html/metadata',[headings]).status,0);
  const scripts = output('missing script',html.replace('/js/main.0123456789abcdef.js','/js/main.missing.js'));
  checked('check/html/scripts',scripts,/Missing script asset/);
  assert.equal(cli('check/html/jsonld',[scripts]).status,0);
  const pathEntry=output('home path entry',html.replace('</body>','<script src="/js/browse/path-entry.fixture.js"></script></body>'));
  write(pathEntry,'js/browse/path-entry.fixture.js','void 0;');
  checked('check/html/scripts',pathEntry,/Home page must not load the path entry bundle/);
  assert.equal(cli('check/html/metadata',[pathEntry]).status,0);
});

test('stylesheet checks reject any family outside the current contract',()=>{
  const html=fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const stylesheet='css/page.'+'a'.repeat(32)+'.min.'+'b'.repeat(64)+'.css';
  const link='<link rel=stylesheet href="/'+stylesheet+'">';
  const directory=output('styles',html.replace('</head>',link+'</head>'));
  write(directory,stylesheet,'body{}');
  assert.equal(cli('check/html/styles',[directory]).status,0);
  for(const name of ['article-core','unknown']) {
    write(directory,'index.html',html.replace('</head>',link+'<link rel=stylesheet href="/css/'+name+'.css"></head>'));
    write(directory,'css/'+name+'.css','body{}');
    checked('check/html/styles',directory,/unexpected stylesheet families/);
  }
});
test('script controllers follow declared page capabilities and stay out of shared bundles',() => {
  const html=fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const cases=[['preferences/language-page','<div data-language-settings></div>'],
    ['preferences/back-links','<a data-page-action=back href=/>Back</a>'],['updates/page',updatePanel]];
  for(const [family,marker] of cases) {
    const src='/js/'+family+'.0123456789abcdef.js',script='<script src="'+src+'"></script>';
    const directory=output('controller-'+family.replaceAll('/','-'),html.replace('</body>',marker+script+'</body>'));
    write(directory,src.slice(1),'void 0;');
    assert.equal(cli('check/html/scripts',[directory]).status,0,family);
    write(directory,'index.html',html.replace('</body>',marker+'</body>'));
    checked('check/html/scripts',directory,/Controller loading boundary.*expected 1/);
    write(directory,'index.html',html.replace('</body>',script+'</body>'));
    checked('check/html/scripts',directory,/Controller loading boundary.*expected 0/);
  }
  const global=output('shared-sw-controller');write(global,'js/sw-manager.enable.0123456789abcdef.js','document.querySelector("[data-site-update-panel]");');
  write(global,'index.html',html.replace('</body>','<script src=/js/sw-manager.enable.0123456789abcdef.js></script></body>'));
  checked('check/html/scripts',global,/stay out of shared bundle/);
});

test('shared HTML extraction keeps nested elements and excludes raw text',()=>{
  const html='<div title="a > b"><div>x</div><a href=/zh/><span>home</span></a></div><script>const fake="<div></div>"</script><style>x::after{content:"<div></div>"}</style><!--<div></div>-->';
  const divs=extractBlocks(html,'div');
  assert.equal(divs.length,2);
  assert.equal(divs[0].inner,'<div>x</div><a href=/zh/><span>home</span></a>');
  assert.equal(extractBlocks(divs[0].inner,'a')[0].open,'<a href=/zh/>');
  assert.throws(()=>extractBlocks('</div>','div'),/Unexpected closing/);
  assert.throws(()=>extractBlocks('<div>','div'),/Unclosed/);
});

test('shared metadata accepts optional dates and rejects merged or reordered rows',()=>{
  const dates=[dateRow('2026-10-11'),dateRow('2026-10-10')];
  const taxonomy='<nav class="document-meta__row document-meta__row--taxonomy-path"><a href=/topics/test/>Test</a></nav>';
  const directory='<nav class="document-meta__row document-meta__row--path"><a href=/>Home</a></nav>';
  for(const count of [0,1,2])assert.deepEqual(inspectDocumentMetadata(metadata(dates.slice(0,count).join('')+taxonomy+directory)),[]);
  const merged=dates.join('').replace('</time></div><div class=document-meta__row><span><svg><use href=#icon-clock></use></svg></span>','</time>');
  assert.match(inspectDocumentMetadata(metadata(merged))[0],/separate metadata rows/);
  assert.match(inspectDocumentMetadata(metadata(taxonomy+dates.join('')))[0],/first, adjacent/);
  assert.match(inspectDocumentMetadata(metadata(dates[0]+directory+dates[1]))[0],/first, adjacent/);
  assert.match(inspectDocumentMetadata(metadata(dates[0].replace('#icon-clock','#icon-calendar')))[0],/clock icon/);
  assert.match(inspectDocumentMetadata(metadata(directory+taxonomy))[0],/Taxonomy paths precede/);
  const html=fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const directoryOutput=output('metadata order',html.replace('</body>',metadata(directory+taxonomy)+'</body>'));
  checked('check/html/metadata',directoryOutput,/Taxonomy paths precede.*index.html/s);
});

test('shared controls distinguish metadata-only and chapter-only asides',()=>{
  const toc='<nav class=document-toc><ul><li><a href=#chapter>Chapter</a></li></ul></nav>';
  const aside=inner=>'<aside id=document-aside>'+inner+'</aside>';
  const metaOnly=toggle+aside(metadata('')+close)+asideScript;
  const tocOnly=toggle+aside(toc+close)+asideScript+tocScript;
  for(const html of ['',aside(metadata('')),metaOnly,tocOnly])assert.deepEqual(inspectDocumentControls(html),[]);
  assert.match(inspectDocumentControls(metaOnly.replace(close,''))[0],/pair with one toggle/);
  assert.match(inspectDocumentControls(metaOnly.replace('aria-controls=document-aside','aria-controls=missing'))[0],/reference the aside/);
  assert.match(inspectDocumentControls(tocOnly.replace(tocScript,''))[0],/toc controller/);
  assert.match(inspectDocumentControls(asideScript)[0],/aside controller/);
  assert.match(inspectDocumentControls(metaOnly+tocScript)[0],/toc controller/);
  const html=fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const bad=output('unneeded aside controller',html.replace('</body>',asideScript+'</body>'));
  write(bad,'js/document/aside.fixture.js','void 0;');
  checked('check/html/scripts',bad,/aside controller.*index.html/s);
  assert.equal(cli('check/html/metadata',[bad]).status,0);
});

test('shared update controls accept a disabled worker and reject broken static controls',()=>{
  const enabled=updatePanel.replace('</div>',updateAction+'</div>');
  for(const html of [updatePanel,enabled])assert.deepEqual(inspectDocumentControls(html),[]);
  assert.match(inspectDocumentControls(enabled.replace('type=button','type=submit'))[0],/native button/);
  assert.match(inspectDocumentControls(enabled.replace('data-site-update-action-label','data-removed-label'))[0],/one label/);
  assert.match(inspectDocumentControls(enabled.replace('aria-live=polite','aria-live=off'))[0],/polite announcements/);
  assert.match(inspectDocumentControls(enabled.replace('</div>',updateAction+'</div>'))[0],/at most one action/);
  assert.match(inspectDocumentControls(enabled.replace('</div>','<time>Build</time></div>'))[0],/outside the update panel/);
  assert.match(inspectDocumentControls(updatePanel+updatePanel)[0],/at most once/);
});

test('sitemap checks cross-file indexing and robots checks its own declaration',() => {
  const directory = output('empty sitemap');
  write(directory,'sitemap.xml','<urlset></urlset>');
  checked('check/sitemap',directory,/Indexable page must appear/);
  const html = fs.readFileSync(path.join(directory,'index.html'),'utf8');
  write(directory,'index.html',html.replace(/<html\b/,'<html data-sitemap-disabled="true"'));
  assert.equal(cli('check/sitemap',[directory]).status,0);
  write(directory,'sitemap.xml','<urlset><url><loc>https://example.test/</loc></url></urlset>');
  checked('check/sitemap',directory,/Sitemap-disabled page must not appear/);
  write(directory,'index.html',html.replace('</head>','<meta name="robots" content="none"></head>'));
  checked('check/sitemap',directory,/Noindex page must not appear/);
  write(directory,'sitemap.xml','<urlset></urlset>');
  assert.equal(cli('check/sitemap',[directory]).status,0);
  write(directory,'index.html',html);
  assert.equal(cli('check/html/metadata',[directory]).status,0);
  write(directory,'robots.txt','User-agent: *');
  checked('check/robots',directory,/Sitemap directive/);
});
test('breadcrumb and prefetch payload checks keep parsing failures and runtime pairing separate',() => {
  const html = fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const breadcrumb = output('bad breadcrumb',html.replace('<body>','<body><div data-slot=breadcrumb data-entry-breadcrumb-sources="{"><a href=/other/>Other</a></div>'));
  checked('check/html/breadcrumb',breadcrumb,/Invalid breadcrumb payload/);
  assert.equal(cli('check/prefetch/payload',[breadcrumb]).status,0);
  const prefetch = output('bad prefetch',html.replace('</body>','<script type=application/json id=site-prefetch-data>{broken}</script></body>'));
  checked('check/prefetch/payload',prefetch,/Invalid prefetch payload/);
  assert.equal(cli('check/html/breadcrumb',[prefetch]).status,0);
  const paired = output('unpaired prefetch',html.replace('</body>','<script type=application/json id=site-prefetch-data>{"tt":{}}</script></body>'));
  checked('check/prefetch/payload',paired,/Missing prefetch runtime/);
});
test('shared rules checking covers disabled, enabled, stale, changed and mismatched outputs',() => {
  const directory = output('rules');
  function headers(value) {
    write(directory,'_headers',value ? '/*\n  Speculation-Rules: "' + value + '"' : '/*\n  Cache-Control: no-cache');
    write(directory,'edgeone.json',JSON.stringify({headers:[{source:'/*',headers:value ? [{key:'Speculation-Rules',value:'"' + value + '"'}] : []}]}));
  }
  headers('');
  assert.equal(cli('check/prefetch/rules',[directory]).status,0);
  headers(rulesPath); write(directory,rulesPath.slice(1),rules);
  assert.equal(cli('check/prefetch/rules',[directory]).status,0);
  write(directory,rulesPath.slice(1),'{}');
  checked('check/prefetch/rules',directory,/fingerprint differs/);
  write(directory,rulesPath.slice(1),rules); headers('');
  checked('check/prefetch/rules',directory,/stale files/);
  headers(rulesPath); write(directory,'_headers','/*\n  Speculation-Rules: "/wrong.json"');
  checked('check/prefetch/rules',directory,/must agree/);
});
test('build version checks compare the rendered version with service-worker bytes',() => {
  const html = fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const directory = output('version',html.replace('</body>','<time data-site-update-version title=v20261008120000 datetime=2026-10-08T12:00:00Z>2026-10-08 12:00</time></body>'));
  write(directory,'sw.js','const cache = "nav-html-v20261008120000";');
  assert.equal(cli('check/build-version',[directory]).status,0);
  write(directory,'sw.js','const cache = "nav-html-v20261008130000";');
  checked('check/build-version',directory,/does not appear to use|outside update/);
});
test('image checks split responsive, share and icon failures and read resolved Hugo config',() => {
  const html = fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const image = '/media/content/photo.' + 'a'.repeat(64) + '.jpg';
  const candidate = '/media/content/photo.' + 'b'.repeat(64) + '.webp';
  const markup = '<a class=md-image-link target=_blank rel=noopener><picture class=md-responsive-image><source type=image/webp srcset="' + candidate + ' 600w" sizes="auto, 600px"><img src="' + image + '" width=900 height=600 loading=lazy decoding=async></picture></a>';
  const directory = output('responsive',html.replace('</body>',markup + '</body>'));
  write(directory,image.slice(1),'original'); write(directory,candidate.slice(1),'candidate');
  assert.equal(cli('check/img/responsive',[directory]).status,0);
  assert.equal(fs.existsSync(path.join(site,'node_modules')),false);
  write(directory,'index.html',html.replace('</body>',markup.replace('auto, 600px','wrong') + '</body>'));
  checked('check/img/responsive',directory,/sizes must match resolved/);
  assert.equal(cli('check/img/share',[directory]).status,0);
  const icons = output('icons',html.replace('</body>','<img class=icon--image src=/missing.png></body>'));
  checked('check/img/icons',icons,/existing hashed resource/);
  assert.equal(cli('check/img/responsive',[icons]).status,0);
  const shares = output('shares',html.replace('</head>','<meta property=og:image content="' + image + '"></head>'));
  write(shares,image.slice(1),'invalid JPEG');
  checked('check/img/share',shares,/not a readable JPEG/);
});
test('content checks parse YAML, TOML and JSON and validate only declared fields',() => {
  for (const [name,text] of [
    ['yaml.md','---\nshare_image: false\ntranslation_placeholder: true\nbuild: {list: never}\n---\nBody'],
    ['toml.md','+++\nshare_image = false\ntranslation_placeholder = true\n[build]\nlist = "never"\n+++\nBody'],
    ['json.md','{"title":"Escaped \\" } brace","share_image":false,"translation_placeholder":true,"build":{"list":"never"}}\nBody'],
    ['inherit.md','---\ntitle: Uses Hugo inheritance\n---\nBody']
  ]) write(site,'content/' + name,text);
  for (const command of ['check/content/share-image','check/content/translation-placeholder']) {
    const result = cli(command); assert.equal(result.status,0,result.stderr);
  }
  write(site,'content/toml.md','+++\nshare_image = true\n+++\nBody');
  checked('check/content/share-image',site,/share_image must be false/);
  assert.equal(cli('check/content/translation-placeholder').status,0);
  fs.unlinkSync(path.join(site,'content/toml.md'));
  write(site,'content/yaml.md','---\ntranslation_placeholder: true\n---\n');
  checked('check/content/translation-placeholder',site,/build.list to never/);
  assert.equal(cli('check/content/share-image').status,0);
  fs.unlinkSync(path.join(site,'content/yaml.md'));
  write(site,'content/bad.md','+++\ntitle = [\n+++\n');
  checked('check/content/share-image',site,/Invalid front matter/);
  fs.unlinkSync(path.join(site,'content/bad.md'));
});
test('HTTP checks validate supplied URLs and separate security, cache and speculation failures',async () => {
  for (const [command,url] of [['check/http/security',origin],['check/http/cache',origin+'/sw.js'],['check/http/speculation',origin+'/?spec']]) {
    const result = await cliAsync(command,[url]); assert.equal(result.status,0,result.stderr);
  }
  const securityResult = await cliAsync('check/http/security',[origin+'/?bad-csp']);
  assert.equal(securityResult.status,1); assert.match(securityResult.stderr,/Content-Security-Policy/);
  const cacheResult = await cliAsync('check/http/cache',[origin+'/sw.js?bad-cache']);
  assert.equal(cacheResult.status,1); assert.match(cacheResult.stderr,/no-cache|immutable/);
  const spec = await cliAsync('check/http/speculation',[origin+'/?bad-spec']);
  assert.equal(spec.status,1); assert.match(spec.stderr,/same-origin/);
  assert.equal((await cliAsync('check/http/speculation',[origin])).status,0);
  assert.equal((await cliAsync('check/http/security',[origin+'/failed'])).status,1);
  for (const command of ['check/http/security','check/http/cache','check/http/speculation']) for (const args of [[],['file:///etc/passwd'],[origin,origin]]) {
    assert.equal(cli(command,args).status,1);
  }
});
test('every declared task exposes help before consulting output, content or tools; parent and retired routes stay absent',{timeout:60000},() => {
  const tasksRoot = path.join(skill,'tasks');
  const commands = fs.readdirSync(tasksRoot,{recursive:true}).filter(name => path.basename(name) === 'entry.mjs').map(name => path.dirname(name).split(path.sep).join('/'));
  for (const command of commands) {
    for (const arg of ['--help','-h']) {
      const result=cli(command,[arg],work);
      assert.equal(result.status,0,command);
      assert.ok(result.stdout.includes('swban '+command),'Help must identify its task: '+command);
    }
    assert.equal(cli(command,['--unknown'],work).status,1,command);
  }
  for (const command of ['check/html','report/html','report/assets','check/http','check/img','check/content','check/browser/settings','check/html/budget','sync/edgeone','deploy/edgeone','deploy/edgeone/build']) {
    const result = cli(command); assert.equal(result.status,1); assert.match(result.stderr,/unknown_command:/);
  }
});

test('native Hugo generates EdgeOne config and respects its Hugo version override',() => {
  const theme = fileURLToPath(new URL('../module/',import.meta.url));
  const defaults = fs.readFileSync(path.join(theme,'data/cache-policy-default.toml'),'utf8');
  for (const override of ['', '0.156.0']) {
    const fixture = path.join(work,'edgeone '+(override || 'default'));
    write(fixture,'hugo.toml','baseURL = "https://example.test/"\ndisableKinds = ["taxonomy","term","RSS","sitemap"]\n');
    write(fixture,'content/_index.md','---\ntitle: Fixture\n---\n');
    write(fixture,'layouts/home.html','{{ partial "edgeone-config.html" (dict "edgeone" .Site.Data.policy.platform.edgeone) | jsonify }}');
    write(fixture,'layouts/_partials/edgeone-config.html',fs.readFileSync(path.join(theme,
      'layouts/_partials/system-delivery/deployment/edgeone-config.html')));
    write(fixture,'layouts/_partials/system-delivery/deployment/cache-header-routes.html',fs.readFileSync(path.join(theme,
      'layouts/_partials/system-delivery/deployment/cache-header-routes.html')));
    write(fixture,'data/policy.toml',override ? defaults.replace('[platform.edgeone]',
      '[platform.edgeone]\nhugoVersion = "'+override+'"') : defaults);
    const result = spawnSync(toolExecutable('hugo'),['--minify'],{cwd:fixture,
      env:hugoEnvironment({...process.env,GIT_OPTIONAL_LOCKS:'0',HUGO_CACHEDIR:path.join(fixture,'cache'),
        HUGO_RESOURCEDIR:path.join(fixture,'resources')}),encoding:'utf8',timeout:30000});
    assert.ifError(result.error); assert.equal(result.status,0,result.stdout+result.stderr);
    const rendered = JSON.parse(fs.readFileSync(path.join(fixture,'public/index.html'),'utf8'));
    assert.equal(rendered.hugoVersion,override || result.stdout.match(/hugo v(\d+\.\d+\.\d+)/)[1]);
    assert.equal(rendered.buildCommand,'hugo --minify --gc --cleanDestinationDir');
    assert.equal(rendered.installCommand,'');
    assert.equal(rendered.outputDirectory,'public');
  }
});
