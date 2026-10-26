import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {hugoEnvironment} from '../.agents/skills/swaw-banyan/tasks/base/hugo/run.mjs';
import {loadDependency} from '../.agents/skills/swaw-banyan/tasks/_shared/dependencies.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {inspectDocumentMetadata} from '../.agents/skills/swaw-banyan/tasks/check/html/metadata/document.mjs';
import {inspectDocumentControls} from '../.agents/skills/swaw-banyan/tasks/check/html/scripts/controls.mjs';
import {breadcrumbRows} from '../.agents/skills/swaw-banyan/tasks/check/html/breadcrumb/inspect.mjs';
import {fixturePairing,fixtureEnvironment} from './_shared/hugo.mjs';

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
const rules = JSON.stringify({prefetch:[{source:'document',where:{and:[{selector_matches:'html[data-prefetch-native-ready] a'},{selector_matches:'html[data-prefetch-ready] a:has(> .item-icon > svg.icon-folder)'},{href_matches:'/*',relative_to:'document'}]},eagerness:'eager'}]});
const updatePanel='<div data-site-update-panel><p data-site-update-status role=status aria-live=polite></p></div>';
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
  const result = spawnSync(process.execPath,[path.join(skill,'tasks/_cli/main.mjs'),command,...args],{cwd,env:fixtureEnvironment(work),encoding:'utf8',timeout:15000});
  assert.ifError(result.error); return result;
}
function cliAsync(command,args) {
  return new Promise((resolve,reject) => {
    const child = spawn(process.execPath,[path.join(skill,'tasks/_cli/main.mjs'),command,...args],{cwd:site,env:fixtureEnvironment(work),stdio:['ignore','pipe','pipe']});
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
  const runtime = 'node';
  const {resolveBinding} = await import(pathToFileURL(path.join(source,'tasks/_shared/tools/bindings.mjs')));
  const tools = {};
  for (const name of ['hugo','go','git']) tools[name] = {...resolveBinding(name),source:'path'};
  tools[runtime] = {source:'path',path:process.execPath,version:process.versions.node};
  const {writeBindings} = await import(pathToFileURL(path.join(skill,'tasks/_shared/tools/bindings.mjs')));
  writeBindings({schema:'swaw-banyan.bindings/v1',runtime,tools},path.join(skill,'.tools'));
  write(site,'hugo.toml','baseURL = "https://example.test/"\n[params.media.responsive_images]\nwidths = [600]\n');
  fs.cpSync(path.join(source,'node_modules'),path.join(skill,'node_modules'),{recursive:true});
  fixturePairing(site);
  write(site,'content/_index.md','---\ntitle: Home\nparams: {share_image: false}\n---\n');
  write(site,'public/index.html','<html lang=en><head><title>Home</title><meta name=description content="Home description"><link rel=canonical href="https://example.test/"></head><body><h1>Home</h1><script src="/js/main.0123456789abcdef.js"></script></body></html>');
  write(site,'public/js/main.0123456789abcdef.js','void 0;');
  write(site,'public/robots.txt','User-agent: *\nSitemap: https://example.test/sitemap.xml');
  write(site,'public/sitemap.xml','<urlset><url><loc>https://example.test/</loc></url></urlset>');
  server = createServer((request,response) => {
    const url = new URL(request.url,'http://localhost');
    if (url.pathname === '/failed') {response.statusCode=503; response.end(); return;}
    for (const [key,value] of Object.entries(security)) response.setHeader(key,value);
    response.setHeader('Cache-Control','no-cache, max-age=0, must-revalidate');
    if (url.searchParams.has('bad-csp')) response.removeHeader('Content-Security-Policy');
    if (url.searchParams.has('bad-cache')) response.setHeader('Cache-Control','public, max-age=3600, immutable');
    response.setHeader('Content-Type','text/html');
    const documentRules=url.searchParams.has('bad-spec')?'{broken':rules;
    response.end(url.searchParams.has('spec')||url.searchParams.has('bad-spec')?'<script id=site-speculation-rules type=speculationrules>'+documentRules+'</script>':'');
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

function llmsText(siteURL,sitemapURL,urls) {
  return '# Fixture\nCanonical site: '+siteURL+'\nSitemap: '+sitemapURL+'\n\n## Pages\n'+urls.map(url=>'- [Guide \\[one\\]](<'+url+'>): A \\[literal\\]\\(description\\).').join('\n');
}
function sitemapText(urls,index=false) {
  const root=index?'sitemapindex':'urlset',entry=index?'sitemap':'url';
  return '<'+root+'>'+urls.map(url=>'<'+entry+'><loc>'+url.replaceAll('&','&amp;')+'</loc></'+entry+'>').join('')+'</'+root+'>';
}

test('LLMS compares sitemap coverage with escaped Markdown and a site subpath',()=>{
  const directory=output('llms subpath'),siteURL='https://example.test/base/';
  const urls=[siteURL,siteURL+'guide(one)/'];
  write(directory,'guide(one)/index.html','<h1>Guide</h1>');
  write(directory,'sitemap.xml',sitemapText(urls));
  write(directory,'llms.txt',llmsText(siteURL,siteURL+'sitemap.xml',urls));
  const result=cli('check/llms',[directory]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  write(directory,'llms.txt',llmsText(siteURL,siteURL+'sitemap.xml',[...urls,urls[1]]));
  checked('check/llms',directory,/duplicate link/);
  write(directory,'llms.txt',llmsText(siteURL,siteURL+'sitemap.xml',[urls[0]]));
  checked('check/llms',directory,/missing a sitemap link.*guide\(one\)/);
  write(directory,'extra/index.html','<h1>Extra</h1>');
  write(directory,'llms.txt',llmsText(siteURL,siteURL+'sitemap.xml',[...urls,siteURL+'extra/']));
  checked('check/llms',directory,/extra link absent from its sitemap/);
  write(directory,'llms.txt',llmsText(siteURL,siteURL+'sitemap.xml',[...urls,siteURL+'missing/']));
  checked('check/llms',directory,/missing local file.*missing/);
  write(directory,'llms.txt',llmsText(siteURL,siteURL+'sitemap.xml',[...urls,'https://elsewhere.test/']));
  checked('check/llms',directory,/outside Canonical site/);
});

test('LLMS permits cross-group page references and rejects repeats within a group',()=>{
  const directory=output('llms groups'),siteURL='https://example.test/';
  const urls=[siteURL,siteURL+'guide/'];
  write(directory,'guide/index.html','<h1>Guide</h1>');
  write(directory,'sitemap.xml',sitemapText(urls));
  const valid=llmsText(siteURL,siteURL+'sitemap.xml',urls);
  const reference='- [Reference](<'+urls[1]+'>)';
  for(const heading of ['## Other','## Pages','## Pages ##']) {
    write(directory,'llms.txt',valid+'\n\n'+heading+'\n'+reference);
    const result=cli('check/llms',[directory]);
    assert.equal(result.status,0,result.stdout+result.stderr);
  }
  write(directory,'llms.txt',valid+'\n\n### Other\n'+reference);
  checked('check/llms',directory,/duplicate link in its group/);
  write(directory,'llms.txt',valid+'\n\n## Other\n'+reference+'\n'+reference);
  checked('check/llms',directory,/duplicate link in its group/);
  write(directory,'llms.txt',valid.replace('\n\n## Pages\n','\n\n')+'\n'+reference);
  checked('check/llms',directory,/duplicate link in its group/);
});

test('LLMS verifies every sitemap language index without requiring a root LLMS file',()=>{
  const directory=output('llms languages'),siteURL='https://example.test/base/';
  const languages=['en','zh'];
  write(directory,'sitemap.xml',sitemapText(languages.map(language=>siteURL+language+'/sitemap.xml'),true));
  for(const language of languages) {
    const home=siteURL+language+'/';
    write(directory,language+'/index.html','<h1>Language home</h1>');
    write(directory,language+'/sitemap.xml',sitemapText([home]));
    write(directory,language+'/llms.txt',llmsText(siteURL,home+'sitemap.xml',[home]));
  }
  const directoryText=llmsText(siteURL,siteURL+'sitemap.xml',languages.map(language=>siteURL+language+'/llms.txt'));
  write(directory,'llms.txt',directoryText);
  let result=cli('check/llms',[directory]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  fs.unlinkSync(path.join(directory,'llms.txt'));
  result=cli('check/llms',[directory]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  write(directory,'llms.txt',directoryText.replace(siteURL+'zh/llms.txt',siteURL+'en/llms.txt'));
  checked('check/llms',directory,/duplicate link/);
  checked('check/llms',directory,/missing a sitemap link.*zh\/llms\.txt/);
  write(directory,'llms.txt',directoryText);
  fs.unlinkSync(path.join(directory,'zh/llms.txt'));
  checked('check/llms',directory,/missing its language llms\.txt.*zh\/sitemap\.xml/);
  write(directory,'zh/llms.txt',llmsText(siteURL,siteURL+'en/sitemap.xml',[siteURL+'en/']));
  checked('check/llms',directory,/multiple llms\.txt files for one language sitemap/);
  checked('check/llms',directory,/missing its language llms\.txt.*zh\/sitemap\.xml/);
  write(directory,'zh/llms.txt',llmsText(siteURL,siteURL+'zh/sitemap.xml',[siteURL+'zh/']));
  fs.unlinkSync(path.join(directory,'en/llms.txt'));
  const rootCatalog=llmsText(siteURL,siteURL+'en/sitemap.xml',[siteURL+'en/',siteURL+'zh/llms.txt']);
  write(directory,'llms.txt',rootCatalog);
  result=cli('check/llms',[directory]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  write(directory,'llms.txt',rootCatalog+'\n- [中文](<'+siteURL+'zh/llms.txt>)');
  checked('check/llms',directory,/duplicate link.*zh\/llms\.txt/);
  write(directory,'llms.txt',rootCatalog+'\n\n## Other\n- [中文](<'+siteURL+'zh/llms.txt>)');
  checked('check/llms',directory,/duplicate link to a language index.*zh\/llms\.txt/);
});

test('LLMS rejects invalid metadata, malformed XML and Markdown links',()=>{
  const directory=output('llms invalid'),siteURL='https://example.test/';
  const valid=llmsText(siteURL,siteURL+'sitemap.xml',[siteURL]);
  for(const [text,pattern] of [
    [valid.replace('Canonical site: '+siteURL,'Canonical site: invalid'),/Canonical site is not a valid absolute/],
    [valid.replace('Canonical site: '+siteURL+'\n',''),/missing a Canonical site/],
    [valid.replace('Sitemap: '+siteURL+'sitemap.xml','Sitemap: /sitemap.xml'),/Sitemap is not a valid absolute/],
    [valid.replace('Sitemap: '+siteURL+'sitemap.xml\n',''),/missing a Sitemap line/],
    [valid.replace('<'+siteURL+'>','<http://[invalid>'),/link is not a valid absolute/],
    [valid.replace('>):',':'),/malformed Markdown link/],
    [valid.replace('<'+siteURL+'>','<'+siteURL+'%2e%2e%2fescape/>'),/invalid output reference/]
  ]) {
    write(directory,'llms.txt',text);
    checked('check/llms',directory,pattern);
  }
  write(directory,'llms.txt',valid);
  write(directory,'sitemap.xml','<urlset><url><loc>'+siteURL+'</loc></url>');
  checked('check/llms',directory,/Invalid sitemap XML/);
  write(directory,'sitemap.xml','<urlset><url><loc>invalid</loc></url></urlset>');
  checked('check/llms',directory,/loc is not a valid absolute/);
  write(directory,'sitemap.xml','<urlset><url></url></urlset>');
  checked('check/llms',directory,/entry without one loc/);
  fs.unlinkSync(path.join(directory,'sitemap.xml'));
  checked('check/llms',directory,/Missing sitemap file/);
  fs.unlinkSync(path.join(directory,'llms.txt'));
  checked('check/llms',directory,/Missing llms\.txt/);
});

test('prefetch cost reports omit retired URL counts and retain bytes and rule counts',()=>{
  const html=fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const empty=cli('report/payload/prefetch',[output('empty-prefetch-report',html)]);
  assert.equal(empty.status,0,empty.stdout+empty.stderr);
  assert.match(empty.stdout,/Total bytes\t0/);
  assert.doesNotMatch(empty.stdout,/Unique URLs/);
  const payload=JSON.stringify({enabled:true,modes:{default:'moderate','folder/root':'off'},
    prerender:{default:'off','folder/tail':'moderate'},sw:{enabled:false,url:'/sw.js',scope:'/'}});
  const configured=cli('report/payload/prefetch',[output('configured-prefetch-report',
    html.replace('</body>','<script id=site-prefetch-data type=application/json>'+payload+'</script></body>'))]);
  assert.equal(configured.status,0,configured.stdout+configured.stderr);
  assert.match(configured.stdout,new RegExp('Total bytes\\t'+Buffer.byteLength(payload)));
  assert.match(configured.stdout,/index.html\tbytes=\d+\trules=1\tprerender=1/);
  assert.doesNotMatch(configured.stdout,/Unique URLs/);
});

test('stylesheet checks allow CSS attachments and retain stylesheet contracts',()=>{
  const html=fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const stylesheet='css/page.'+'a'.repeat(32)+'.min.'+'b'.repeat(64)+'.css';
  const link='<link rel=stylesheet href="/'+stylesheet+'">';
  const directory=output('styles',html.replace('</head>',link+'</head>'));
  write(directory,stylesheet,'body{}');
  write(directory,'downloads/example.css','h1{color:red}');
  write(directory,'index.html',html.replace('</head>',link+'</head>').replace('</body>','<a href="/downloads/example.css" download>Download CSS example</a></body>'));
  assert.equal(cli('check/html/styles',[directory]).status,0);
  fs.rmSync(path.join(directory,stylesheet));
  checked('check/html/styles',directory,/Missing stylesheet asset/);
  write(directory,stylesheet,'body{}');
  for(const name of ['article-core','unknown']) {
    write(directory,'index.html',html.replace('</head>',link+'<link rel=stylesheet href="/css/'+name+'.css"></head>'));
    write(directory,'css/'+name+'.css','body{}');
    checked('check/html/styles',directory,/unexpected stylesheet families/);
  }
});
test('script controllers follow declared page capabilities and stay out of shared bundles',() => {
  const html=fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const cases=[['preferences/language-page','<div data-language-settings></div>'],
    ['preferences/back-links','<a data-page-action=back href=/>Back</a>'],['updates/page',updatePanel],
    ['pages/offline','<p data-page-actions><a data-page-action=reload href=/>Retry</a></p>']];
  for(const [family,marker] of cases) {
    const src='/js/'+family+'.0123456789abcdef.js',script='<script src="'+src+'"></script>';
    const directory=output('controller-'+family.replaceAll('/','-'),html.replace('</body>',marker+script+'</body>'));
    write(directory,src.slice(1),'void 0;');
    assert.equal(cli('check/html/scripts',[directory]).status,0,family);
    write(directory,'index.html',html.replace('</body>',marker+script+script+'</body>'));
    checked('check/html/scripts',directory,/Controller loading boundary.*found 2/);
    write(directory,'index.html',html.replace('</body>',marker+'</body>'));
    checked('check/html/scripts',directory,/Controller loading boundary.*expected 1/);
    write(directory,'index.html',html.replace('</body>',script+'</body>'));
    checked('check/html/scripts',directory,/Controller loading boundary.*expected 0/);
  }
  const independent=cases.filter(([family])=>family!=='preferences/language-page');
  const combined=output('combined-controllers',html.replace('</body>',independent.map(([family,marker])=>
    marker+'<script src="/js/'+family+'.0123456789abcdef.js"></script>').join('')+'</body>'));
  for(const [family] of independent)write(combined,'js/'+family+'.0123456789abcdef.js','void 0;');
  assert.equal(cli('check/html/scripts',[combined]).status,0,'Page capabilities must load their controllers independently.');
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
  const directory='<nav class="document-meta__row document-meta__row--path"><a href=/>Home</a></nav>';
  for(const count of [0,1,2])assert.deepEqual(inspectDocumentMetadata(metadata(dates.slice(0,count).join('')+directory)),[]);
  const merged=dates.join('').replace('</time></div><div class=document-meta__row><span><svg><use href=#icon-clock></use></svg></span>','</time>');
  assert.match(inspectDocumentMetadata(metadata(merged))[0],/separate metadata rows/);
  assert.match(inspectDocumentMetadata(metadata(directory+dates.join('')))[0],/first, adjacent/);
  assert.match(inspectDocumentMetadata(metadata(dates[0]+directory+dates[1]))[0],/first, adjacent/);
  assert.match(inspectDocumentMetadata(metadata(dates[0].replace('#icon-clock','#icon-calendar')))[0],/clock icon/);
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

test('sitemap checks cross-file indexing and robots validates declared Sitemap URLs',() => {
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
  assert.equal(cli('check/robots',[directory]).status,0);
  write(directory,'robots.txt','User-agent: ExampleBot\nSitemap: /sitemap.xml');
  checked('check/robots',directory,/Sitemap is not a valid absolute HTTP\(S\) URL/);
});
test('breadcrumb and prefetch payload checks keep parsing failures and runtime pairing separate',() => {
  const html = fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const breadcrumb = output('bad breadcrumb',html.replace('<body>','<body><nav data-slot=breadcrumb data-entry-breadcrumb-sources="{"><a href=/other/>Other</a></nav>'));
  checked('check/html/breadcrumb',breadcrumb,/Invalid breadcrumb payload/);
  assert.equal(cli('check/prefetch/payload',[breadcrumb]).status,0);
  const prefetch = output('bad prefetch',html.replace('</body>','<script type=application/json id=site-prefetch-data>{broken}</script></body>'));
  checked('check/prefetch/payload',prefetch,/Invalid prefetch payload/);
  assert.equal(cli('check/html/breadcrumb',[prefetch]).status,0);
  const paired = output('unpaired prefetch',html.replace('</body>','<script type=application/json id=site-prefetch-data>{"enabled":true,"modes":{"default":"moderate"},"prerender":{},"sw":{"enabled":false,"url":"/sw.js","scope":"/"}}</script></body>'));
  checked('check/prefetch/payload',paired,/Missing prefetch runtime/);
});
test('breadcrumb checks count merged navigation anchors and reject legacy slot markers',() => {
  const html = fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const nav = '<nav class="slot path-navigation" data-slot=breadcrumb aria-label=Breadcrumb><div class=page-column><a href=/one/>One</a><div><a href=/two/>Two</a></div></div></nav>';
  const text = html.replace('</body>',nav+'<a href=/outside/>Outside</a></body>');
  const row = breadcrumbRows([{text}])[0];
  assert.equal(row.breadcrumbAnchorCount,2);
  assert.deepEqual(row.breadcrumbPrefetchIssues,[]);
  assert.equal(cli('check/html/breadcrumb',[output('merged breadcrumb',text)]).status,0);
  for (const [name,slot] of [['empty','data-prefetch-slot'],['old','data-prefetch-slot=crumb']]) {
    const broken = text.replace('href=/one/', 'href=/one/ '+slot);
    const fault = breadcrumbRows([{text:broken}])[0];
    assert.equal(fault.breadcrumbAnchorCount,2);
    assert.equal(fault.breadcrumbPrefetchIssues.length,1);
    assert.equal(fault.breadcrumbPrefetchIssues[0].href,'/one/');
    checked('check/html/breadcrumb',output(name+' merged breadcrumb',broken),/Breadcrumb anchor must not use/);
  }
});
test('shared inline rules checks cover disabled, accepted, invalid JSON and missing native gate',() => {
  const directory=output('rules');
  write(directory,'_headers','/*\n  Cache-Control: no-cache');
  write(directory,'edgeone.json',JSON.stringify({headers:[{source:'/*',headers:[]}]}));
  const html=fs.readFileSync(path.join(directory,'index.html'),'utf8');
  const put=value=>write(directory,'index.html',html.replace('</body>','<script id=site-speculation-rules type=speculationrules>'+value+'</script></body>'));
  assert.equal(cli('check/prefetch/rules',[directory]).status,0);
  put(rules);assert.equal(cli('check/prefetch/rules',[directory]).status,0);
  put('{broken');checked('check/prefetch/rules',directory,/Invalid speculation rules JSON/);
  put(JSON.stringify({prefetch:[{source:'document',where:{and:[{selector_matches:'a'}]},eagerness:'moderate'}]}));
  checked('check/prefetch/rules',directory,/Invalid shared document rules/);
  put(rules);write(directory,'_headers','/*\n  Speculation-Rules: "/wrong.json"');
  checked('check/prefetch/rules',directory,/must not also/);
});
test('build version checks compare the rendered version with the content-version JSON',() => {
  const html = fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const directory = output('version',html.replace('</body>','<time data-site-update-version title=v20261008120000 datetime=2026-10-08T12:00:00Z>v20261008120000</time></body>'));
  write(directory,'sw.js','const versionURL = "/sw-version.json";');
  write(directory,'sw-version.json',JSON.stringify({version:'v20261008120000'}));
  assert.equal(cli('check/build-version',[directory]).status,0);
  write(directory,'sw-version.json',JSON.stringify({version:'v20261008130000'}));
  checked('check/build-version',directory,/sw-version\.json.*does not match/);
  write(directory,'sw-version.json','{broken');
  checked('check/build-version',directory,/Invalid sw-version\.json/);
  write(directory,'sw-version.json','{}');
  checked('check/build-version',directory,/version undefined does not match/);
  fs.unlinkSync(path.join(directory,'sw-version.json'));
  assert.equal(cli('check/build-version',[directory]).status,0,'Disabled service workers do not publish a content version.');
  const index=path.join(directory,'index.html');
  fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('</body>','<script src="/js/sw-manager.enable.fixture.js"></script></body>'));
  checked('check/build-version',directory,/sw-version\.json must be published/);
  write(directory,'sw-version.json',JSON.stringify({version:'v20261008120000'}));
  assert.equal(cli('check/build-version',[directory]).status,0);
  fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('>v20261008120000</time>','>v-wrong</time>'));
  checked('check/build-version',directory,/displayed version.*does not match/);
});
test('image checks split responsive, share and icon failures and read resolved Hugo config',() => {
  const html = fs.readFileSync(path.join(site,'public/index.html'),'utf8');
  const image = '/media/content/photo.' + 'a'.repeat(64) + '.jpg';
  const candidate = '/media/content/photo.' + 'b'.repeat(64) + '.webp';
  const markup = '<a class=md-image-link target=_blank rel=noopener><picture class=md-responsive-image><source type=image/webp srcset="' + candidate + ' 600w" sizes="auto, 600px"><img src="' + image + '" width=900 height=600 sizes=auto loading=lazy decoding=async></picture></a>';
  const directory = output('responsive',html.replace('</body>',markup + '</body>'));
  write(directory,image.slice(1),'original'); write(directory,candidate.slice(1),'candidate');
  assert.equal(cli('check/img/responsive',[directory]).status,0);
  assert.equal(fs.existsSync(path.join(site,'node_modules')),false);
  write(directory,'index.html',html.replace('</body>',markup.replace(' sizes=auto','') + '</body>'));
  checked('check/img/responsive',directory,/img sizes must be auto/);
  write(directory,'index.html',html.replace('</body>',markup.replace('auto, 600px','wrong') + '</body>'));
  checked('check/img/responsive',directory,/webp sizes must start with auto/);
  write(directory,'index.html',html.replace('</body>',markup.replace('auto, 600px','auto')+'</body>'));
  assert.equal(cli('check/img/responsive',[directory]).status,0);
  assert.equal(cli('check/img/share',[directory]).status,0);
  const icons = output('icons',html.replace('</body>','<img class=icon--image src=/missing.png></body>'));
  checked('check/img/icons',icons,/existing hashed resource/);
  assert.equal(cli('check/img/responsive',[icons]).status,0);
  const shares = output('shares',html.replace('</head>','<meta property=og:image content="' + image + '"></head>'));
  write(shares,image.slice(1),'invalid JPEG');
  checked('check/img/share',shares,/not a readable JPEG/);
  const config=fs.readFileSync(path.join(site,'hugo.toml'),'utf8');
  try {
    write(directory,'index.html',html.replace('</body>',markup+'</body>'));
    for(const widths of ['[]','[0]','[-1]','[600.5]','"600"']) {
      write(site,'hugo.toml',config.replace('widths = [600]','widths = '+widths));
      checked('check/img/responsive',directory,/must define positive integer widths/);
    }
    write(site,'hugo.toml',config+'\n[languages.en]\nlocale = "en-US"\n[languages.fr]\nlocale = "fr-FR"\n[languages.fr.params.media.responsive_images]\nwidths = [420]\n');
    const localized=output('responsive-locale',html.replace('lang=en','lang=fr-FR').replace('</body>',markup.replace('600w','420w').replace('auto, 600px','auto, 420px')+'</body>'));
    write(localized,image.slice(1),'original');write(localized,candidate.slice(1),'candidate');
    assert.equal(cli('check/img/responsive',[localized]).status,0);
    write(localized,'index.html',fs.readFileSync(path.join(localized,'index.html'),'utf8').replace('lang=fr-FR','lang=en-US'));
    checked('check/img/responsive',localized,/expected 600w/);
  } finally {write(site,'hugo.toml',config);}
});
test('content checks parse nested params in YAML, TOML and JSON',() => {
  for (const [name,text] of [
    ['yaml.md','---\nparams:\n  share_image: false\n---\nBody'],
    ['toml.md','+++\n[PaRaMs]\nShArE_ImAgE = "cover.jpg"\n+++\nBody'],
    ['json.md',JSON.stringify({title:'Escaped " } brace',PaRaMs:{ShArE_ImAgE:false}})+'\nBody'],
    ['inherit.md','---\ntitle: Uses Hugo inheritance\n---\nBody']
  ]) write(site,'content/' + name,text);
  const result = cli('check/content/share-image'); assert.equal(result.status,0,result.stderr);
  for (const [text,command,pattern] of [
    ['---\nparams: {share_image: true}\n---\n','share-image',/params.share_image must be false/],
    ['+++\n[params]\nshare_image = " "\n+++\n','share-image',/params.share_image must be false/],
    [JSON.stringify({params:{share_image:[]}}),'share-image',/params.share_image must be false/],
    ['---\nparams: {share_image: null}\n---\n','share-image',/params.share_image must be false/],
    ['---\nparams: {images: []}\n---\n','share-image',/Use params.share_image instead of params.images/],
    ['---\nparams: []\n---\n','share-image',/params must be an object/],
    ['+++\nparams = "invalid"\n+++\n','share-image',/params must be an object/],
    ['+++\nparams = 2026-10-24T00:00:00Z\n+++\n','share-image',/params must be an object/],
    [JSON.stringify({params:null}),'share-image',/params must be an object/],
    ['+++\ntitle = [\n+++\n','share-image',/Invalid front matter/]
  ]) {
    write(site,'content/invalid.md',text);
    try { checked('check/content/'+command,site,pattern); }
    finally { fs.unlinkSync(path.join(site,'content/invalid.md')); }
  }
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
  assert.equal(spec.status,1); assert.match(spec.stderr,/Invalid speculation rules JSON/);
  assert.equal((await cliAsync('check/http/speculation',[origin])).status,0);
  assert.equal((await cliAsync('check/http/security',[origin+'/failed'])).status,1);
  for (const command of ['check/http/security','check/http/cache','check/http/speculation']) for (const args of [[],['file:///etc/passwd'],[origin,origin]]) {
    assert.equal(cli(command,args).status,1);
  }
});
test('every declared task exposes help before consulting output, content or tools; parent and retired routes stay absent',{timeout:60000},() => {
  const tasksRoot = path.join(skill,'tasks');
  const commands = fs.readdirSync(tasksRoot,{recursive:true}).filter(name => path.basename(name) === 'entry.mjs').map(name => path.dirname(name).split(path.sep).join('/'));
  for (const command of commands.filter(command=>command!=='help'&&!/^(?:base\/(?:bun|node|git|gh|go|hugo|uv(?:\/python)?)(?:\/(?:npm|npx))?|deploy\/(?:cloudflare\/(?:cli|wrangler)|tencent\/cli))$/.test(command))) {
    for (const arg of ['--help','-h']) {
      const result=cli(command,[arg],work);
      assert.equal(result.status,0,command);
      assert.ok(result.stdout.includes('swban '+command),'Help must identify its task: '+command);
    }
    const invalid=spawnSync(process.execPath,[path.join(skill,'tasks',command,'entry.mjs'),'--unknown'],
      {cwd:work,env:fixtureEnvironment(work),encoding:'utf8',timeout:15000});
    assert.ifError(invalid.error);assert.equal(invalid.status,1,command);
  }
  for (const command of ['check/html','report/html','report/assets','check/http','check/img','check/content','check/browser/settings','check/html/budget','check/browser/pwa/activate','check/browser/pwa/cancel','check/browser/pwa/error','check/browser/pwa/timeout','sync/edgeone','deploy/edgeone','deploy/edgeone/build']) {
    const result = cli(command); assert.equal(result.status,1); assert.match(result.stderr,/unknown_command:/);
  }
});

test('native Hugo generates EdgeOne config and respects its Hugo version override',() => {
  const theme = fileURLToPath(new URL('../module/',import.meta.url));
  const toml = loadDependency('@iarna/toml');
  const defaults = toml.parse(fs.readFileSync(new URL('../assets/site/delivery.toml',import.meta.url),'utf8'));
  for (const override of ['', '0.156.0']) {
    const policy = structuredClone(defaults);
    if (override) policy.platform.edgeone.makers.hugoVersion = override;
    const fixture = path.join(work,'edgeone '+(override || 'default'));
    write(fixture,'hugo.toml','baseURL = "https://example.test/"\ndisableKinds = ["RSS","sitemap"]\n[taxonomies]\n');
    write(fixture,'content/_index.md','---\ntitle: Fixture\n---\n');
    write(fixture,'layouts/home.html','{{ $policy := resources.Get "site/policy.toml" | transform.Unmarshal }}{{ partial "system-delivery/deployment/edgeone-config.html" (dict "edgeone" $policy.platform.edgeone.makers) | jsonify }}');
    write(fixture,'layouts/_partials/system-delivery/deployment/edgeone-config.html',fs.readFileSync(path.join(theme,
      'layouts/_partials/system-delivery/deployment/edgeone-config.html')));
    write(fixture,'layouts/_partials/system-delivery/deployment/cache-header-routes.html',fs.readFileSync(path.join(theme,
      'layouts/_partials/system-delivery/deployment/cache-header-routes.html')));
    write(fixture,'assets/site/policy.toml',toml.stringify(policy));
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
