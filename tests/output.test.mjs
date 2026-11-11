import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {inspectHtmlBudget,inspectShareImageBudget,maxShareImageBytes} from './output/budget.mjs';
import {verifyRetiredOutput} from './output/retired.mjs';
import {inspect as inspectShareImage} from '../.agents/skills/swaw-banyan/tasks/check/img/share/inspect.mjs';
import {breadcrumbRows,inspect as inspectBreadcrumb} from '../.agents/skills/swaw-banyan/tasks/check/html/breadcrumb/inspect.mjs';
import {readBreadcrumbData,readNavigationFragment} from '../.agents/skills/swaw-banyan/tasks/_shared/html/breadcrumb.mjs';
import {extractStartTags,extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {fixtureEnvironment,fixtureSiteMounts} from './_shared/hugo.mjs';

const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/output-tests'),budget=fileURLToPath(new URL('./output/budget.mjs',import.meta.url));
let work,count=0;
function write(root,name,text) {
  const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);
}
function fixture(body='') {
  const directory=path.join(work,String(++count));
  write(directory,'index.html','<html lang=en><head><title>Fixture</title><link rel=canonical href="https://example.test/"></head><body>'+body+'</body></html>');
  write(directory,'_headers','/*\n  Cache-Control: no-cache\n');
  write(directory,'edgeone.json','{"headers":[]}');
  return directory;
}
before(()=>{fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('repository HTML budgets keep raw and gzip failures outside published checks',async()=>{
  const small=fixture();assert.deepEqual((await inspectHtmlBudget(small)).issues,[]);
  const raw=fixture('x'.repeat(22000));
  assert.match((await inspectHtmlBudget(raw)).issues.join('\n'),/home raw HTML exceeded budget/);
  const text=Array.from({length:260},(_,index)=>createHash('sha256').update(String(index)).digest('hex')).join('');
  const compressed=await inspectHtmlBudget(fixture(text));
  assert.match(compressed.issues.join('\n'),/home gzip HTML exceeded budget/);
  assert.doesNotMatch(compressed.issues.join('\n'),/raw HTML exceeded/);
  for(const [directory,status] of [[small,0],[raw,1]]) {
    const result=spawnSync(process.execPath,[budget,directory],{cwd:work,encoding:'utf8',timeout:10000});
    assert.ifError(result.error);assert.equal(result.status,status,result.stdout+result.stderr);
  }
});

test('collection heads prefetch their own column and missing breadcrumb runtime without adding a visible path',{timeout:60000},()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),content=path.join(work,'prefetch-content'),output=path.join(work,'prefetch-build');
  const languages=[['',''],['.zh','zh/'],['.ar','ar/']];
  for(const [suffix,prefix] of languages) {
    write(content,'prefetch-name/_index'+suffix+'.md','---\ntitle: Name collection\nlayout: page-collection-directory-name-only\nparams:\n  slots: [breadcrumb]\n---\n');
    write(content,'prefetch-name/article'+suffix+'.md','---\ntitle: Name article\nlayout: page-article-norss\nurl: /'+prefix+'p/prefetch-name/\nparams:\n  slots: [breadcrumb]\n---\n');
    write(content,'prefetch-unlisted/_index'+suffix+'.md','---\ntitle: Unlisted aggregate\nlayout: page-collection-directory-all\nbuild: {list: never}\nparams:\n  aggregate: /articles\n  slots: []\n---\n');
  }
  const mount=(source,target)=>'\n[[module.mounts]]\nsource = '+JSON.stringify(source.replaceAll('\\','/'))+'\ntarget = '+JSON.stringify(target)+'\n';
  const config=path.join(work,'prefetch.toml');
  fs.writeFileSync(config,mount(content,'content')+mount('content','content')+fixtureSiteMounts);
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  const prefetches=html=>extractStartTags(html,'link').filter(tag=>extractTagAttribute(tag,'rel').split(/\s+/).includes('prefetch'));
  const read=(prefix,route)=>fs.readFileSync(path.join(output,prefix,route,'index.html'),'utf8');
  for(const [,prefix] of languages) {
    const urls={};
    const runtime=extractStartTags(read(prefix,'p/example-product'),'script').find(tag=>extractTagAttribute(tag,'src').includes('/browse/breadcrumb-entry.'));
    assert.ok(runtime,'The target article must load the breadcrumb runtime.');
    const runtimeUrl=extractTagAttribute(runtime,'src'),runtimeIntegrity=extractTagAttribute(runtime,'integrity');
    assert.match(runtimeUrl,/^\/js\/browse\/breadcrumb-entry\.[a-f0-9]{64}\.js$/);
    assert.equal(runtimeIntegrity,'sha256-'+createHash('sha256').update(fs.readFileSync(path.join(output,runtimeUrl.slice(1)))).digest('base64'));
    for(const route of ['articles','articles/category1','articles-all','products','products/examples','products-all','prefetch-name','prefetch-unlisted']) {
      const html=read(prefix,route),links=prefetches(html),logicalPath='/'+route+'/';
      const hasBreadcrumb=['articles/category1','products/examples'].includes(route);
      const fragments=links.filter(tag=>extractTagAttribute(tag,'href').startsWith('/site/navigation/'));
      const scripts=links.filter(tag=>extractTagAttribute(tag,'as')==='script');
      const executing=extractStartTags(html,'script').filter(tag=>extractTagAttribute(tag,'src').includes('/browse/breadcrumb-entry.'));
      assert.equal(fragments.length,1,prefix+route+' prefetches exactly one current column.');
      assert.equal(scripts.length,hasBreadcrumb?0:1,prefix+route+' only prefetches the runtime when it is not executing.');
      assert.equal(links.length,fragments.length+scripts.length);
      assert.equal(executing.length,hasBreadcrumb?1:0,'Prefetch must not execute the runtime on collections without breadcrumb columns.');
      if(hasBreadcrumb) {
        assert.equal(extractTagAttribute(executing[0],'src'),runtimeUrl);
        assert.equal(extractTagAttribute(executing[0],'integrity'),runtimeIntegrity);
      } else assert.equal(extractTagAttribute(scripts[0],'href'),runtimeUrl,'The next page uses the same fingerprinted runtime.');
      const href=extractTagAttribute(fragments[0],'href');
      assert.match(href,/^\/site\/navigation\/[a-f0-9]{64}\.txt$/);
      assert.ok(links.every(tag=>html.indexOf(tag)<html.indexOf('<body')),'The browser sees each hint in the head.');
      const payload=readNavigationFragment(fs.readFileSync(path.join(output,href.slice(1)),'utf8'));
      assert.equal(payload.logicalPath,logicalPath);
      const body=extractStartTags(html,'body')[0],navigation=JSON.parse(extractTagAttribute(body,'data-navigation'));
      assert.equal(navigation.columns[logicalPath],undefined,'Prefetch does not add the current column to the path manifest.');
      if(route==='prefetch-name') {
        assert.equal(navigation.default,'');
        assert.equal(extractTagAttribute(extractStartTags(html,'html')[0],'data-has-breadcrumb-columns'),'false');
      }
      if(route==='prefetch-unlisted')assert.equal(navigation.default,'','Disabled slots keep their empty default path.');
      urls[logicalPath]=href;
    }
    for(const route of ['','language','appearance','p/example-product','p/prefetch-name']) {
      const html=read(prefix,route);
      assert.deepEqual(prefetches(html),[],prefix+route+' is not a sortable collection.');
      if(!route.startsWith('p/'))continue;
      const navigation=JSON.parse(extractTagAttribute(extractStartTags(html,'body')[0],'data-navigation'));
      for(const [logicalPath,hash] of Object.entries(navigation.columns))if(urls[logicalPath])
        assert.equal(urls[logicalPath],navigation.resources+hash+'.txt','The next page reuses the prefetched hash.');
    }
  }
});

const encodeNavigation=value=>JSON.stringify(value).replaceAll('&','&amp;').replaceAll('"','&quot;');
const columnHash='a'.repeat(64);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function fixtureNavigation(resources='/site/navigation/') {
  return {home:'/',resources,columns:{'/shared/':columnHash},default:'/shared/'};
}
const navigationHtml=value=>'<html lang=en><link rel=canonical href="https://example.test/article/"><body data-navigation="'+encodeNavigation(value)+'"></body></html>';
function fragment({logicalPath='/shared/',href='/shared/',label='Shared',sortVariant='section',defaultSort='date-desc',rows=[]}={}) {
  return '<div class="item-list item-list--breadcrumb-column" role="group" aria-label="'+escape(label)+'" data-collection-href="'+escape(href)+'" data-breadcrumb-column-path="'+escape(logicalPath)+'" data-sort-variant="'+sortVariant+'" data-default-sort="'+defaultSort+'">'+
    '<div class="list-item list-header list-header--breadcrumb" data-list-header>'+
    (sortVariant?'<a class="breadcrumb-column-sort" data-breadcrumb-sort-toggle="true" href="'+escape(href)+'"><span class="breadcrumb-sort-label">Date</span><span data-sort-indicator>↓</span></a>':'')+'</div>'+
    rows.map(row=>'<div class="list-item" data-list-item data-kind="'+escape(row.kind||'page')+'"'+
      Object.entries(row).filter(([key])=>key.startsWith('sort_')).map(([key,value])=>' data-'+key.replaceAll('_','-')+'="'+escape(value)+'"').join('')+'>'+
      '<a class="item-control item-field item-field--name" data-list-entry href="'+escape(row.href)+'"'+(row.title?' title="'+escape(row.title)+'"':'')+'>'+
      (row.icon?row.icon:'<span class="item-icon"><svg class="icon icon-file"><use href="#icon-file"></use></svg></span>')+
      '<span class="item-title"><bdi>'+escape(row.text)+'</bdi></span></a></div>').join('')+'</div>';
}

test('empty navigation needs no resource directory while referenced columns still do',async()=>{
  const navigation={home:'/',resources:'',columns:{},default:''},html=navigationHtml(navigation),directory=fixture();
  for(const options of [{},{directory}]) {
    const parsed=readBreadcrumbData(html,options);
    assert.equal(parsed.error,'');assert.deepEqual(parsed.columns,{});assert.deepEqual(parsed.defaultColumns,[]);
  }
  write(directory,'article/index.html',html);
  assert.deepEqual((await inspectBreadcrumb(directory)).issues,[]);
  assert.match(readBreadcrumbData(navigationHtml(fixtureNavigation(''))).error,/Navigation resources directory is missing/);
  for(const resources of [undefined,null,'/missing-trailing-slash'])
    assert.match(readBreadcrumbData(navigationHtml({...navigation,resources})).error,/Navigation resources directory is missing/);
});

test('breadcrumb index and collection source budgets remain repository contracts',async()=>{
  const directory=fixture(),navigation={home:'/',resources:'/site/navigation/',columns:{'/one/':columnHash,'/two/':'b'.repeat(64)},default:''};
  for(const [logicalPath,hash] of Object.entries(navigation.columns))write(directory,'site/navigation/'+hash+'.txt',fragment({
    logicalPath,href:logicalPath,label:'Source',rows:[{href:'/article/',text:'Article'}]}));
  for(const name of ['articles-all','articles','products-all','products']) {
    write(directory,name+'/index.html',navigationHtml(navigation));
    assert.match((await inspectHtmlBudget(directory)).issues.join('\n'),/source count exceeded budget/);
  }
  write(directory,'article/index.html',navigationHtml({...navigation,error:'x'.repeat(65536)}));
  assert.match((await inspectHtmlBudget(directory)).issues.join('\n'),/site-wide limit/);
});

test('breadcrumb references count inline bytes and shared external items once',async()=>{
  const navigation=fixtureNavigation(),url=navigation.resources+columnHash+'.txt';
  const content=fragment({rows:[{href:'/article/',text:'Article'},{href:'/two/',text:'Literal &quot;quote&quot;'}]});
  const html=navigationHtml(navigation),directory=fixture();write(directory,url.slice(1),content);
  const [row]=breadcrumbRows([{text:html,relativePath:'article/index.html'}],{directory});
  assert.equal(row.breadcrumbParseError,'');assert.equal(row.breadcrumbSourceCount,1);assert.equal(row.breadcrumbItemCount,2);
  assert.equal(row.breadcrumbPayloadBytes,Buffer.byteLength(JSON.stringify(navigation)));
  const parsed=readBreadcrumbData(html,{directory});
  assert.equal(parsed.columns['/shared/'].rows[1].text,'Literal &quot;quote&quot;','Fragment entities are decoded once.');
  assert.deepEqual(parsed.columnURLs,{'/shared/':url});
  assert.equal(parsed.defaultColumns[0].payload,parsed.sources[0].currentColumn.payload,'Default and alternate paths share one parsed fragment.');
  const rootOnly=readBreadcrumbData(navigationHtml({...navigation,default:''}),{directory});
  assert.deepEqual(rootOnly.defaultColumns,[]);assert.deepEqual(rootOnly.sources[0].columns,[],'Root-only references do not describe a complete path.');
  assert.deepEqual(readBreadcrumbData(html).columns,{},'Metadata can be inspected without reading resources.');
  write(directory,url.slice(1),fragment({rows:[{href:'/one/',text:'x'.repeat(65536)}]}));write(directory,'article/index.html',html);
  assert.doesNotMatch((await inspectHtmlBudget(directory)).issues.join('\n'),/site-wide limit/,'External fragments are excluded from inline budgets.');
  write(directory,'article/index.html',navigationHtml({...navigation,resources:'/site/'+ 'x'.repeat(65536)+'/'}));
  assert.match((await inspectHtmlBudget(directory)).issues.join('\n'),/site-wide limit/,'Resource references count toward inline budgets.');
  write(directory,'article/index.html',navigationHtml({...navigation,columns:[]}));
  assert.match((await inspectBreadcrumb(directory)).issues.join('\n'),/Navigation columns is not a JSON object/);
  write(directory,'article/index.html',navigationHtml({...navigation,default:0}));
  assert.match((await inspectBreadcrumb(directory)).issues.join('\n'),/Navigation default is not a column path/);
});

test('breadcrumb readers validate external fragments, site paths and base URL prefixes',async()=>{
  const directory=fixture(),content=fragment({href:'/base/shared/',rows:[{href:'/one/',text:'One'}]});
  write(directory,'index.html','<link rel=canonical href="https://example.test/base/">');
  write(directory,'site/navigation/'+columnHash+'.txt',content);
  const navigation=fixtureNavigation('/base/site/navigation/'),html=value=>navigationHtml({...navigation,resources:value});
  const resource='/base/site/navigation/',parsed=readBreadcrumbData(html(resource),{directory});
  assert.equal(parsed.error,'');assert.deepEqual(parsed.columns['/shared/'],readNavigationFragment(content),'The URL prefix is not a physical output directory.');
  const cache=new Map(),first=readBreadcrumbData(html(resource),{directory,cache}),second=readBreadcrumbData(html(resource),{directory,cache});
  assert.equal(first.columns['/shared/'],second.columns['/shared/'],'Inspections reuse loaded column objects.');
  const rows=breadcrumbRows([{text:html(resource),relativePath:'zh/one/index.html'},{text:html(resource),relativePath:'zh/two/index.html'}],{directory});
  assert.deepEqual(rows.map(row=>row.breadcrumbItemCount),[1,1]);
  for(const [reference,expected] of [
    ['/base/missing/',/Cannot read breadcrumb column.*ENOENT/],
    ['https://other.test/base/site/',/leaves the published site/],
    ['/outside/',/leaves the published site/],
    ['/base/%2e%2e/outside/',/leaves the published site/],
    ['/base/site/%2e%2e%5coutside/',/Invalid output reference/],
  ])assert.match(readBreadcrumbData(html(reference),{directory}).error,expected);
  const file='site/navigation/'+columnHash+'.txt';write(directory,file,'{broken');
  assert.match(readBreadcrumbData(html(resource),{directory}).error,/Invalid breadcrumb column fragment/);
  write(directory,file,fragment({logicalPath:'/different/'}));
  assert.match(readBreadcrumbData(html(resource),{directory}).error,/Invalid breadcrumb column fragment for \/shared\//);
  write(directory,file,content);write(directory,'article/index.html',html(resource));
  assert.deepEqual((await inspectBreadcrumb(directory)).issues,[]);
  assert.match(readBreadcrumbData(navigationHtml({...navigation,columns:{}}),{directory}).error,/Missing breadcrumb column URL/);
  assert.match(readBreadcrumbData(navigationHtml({...navigation,columns:{'/shared/':{}}})).error,/Invalid breadcrumb column hash/);
  const literal=fixtureNavigation();literal.error='Literal &quot;quote&quot;';
  assert.equal(readBreadcrumbData(navigationHtml(literal)).navigation.error,'Literal &quot;quote&quot;','Index entities are decoded once.');
});

test('navigation fragments retain names, sorting fields and all supported icons',()=>{
  const content=fragment({logicalPath:'/书签/',label:'A & B <C>',rows:[
    {kind:'section',href:'/a/',text:'A & B <C>',sort_name:'1',sort_count:'0',sort_date:'2026-10-01'},
    {href:'/b/',text:'Literal &quot;quote&quot;',title:'Full & exact',sort_name:'2',sort_date:'20261109000000',sort_price:'0',icon:'<span class="item-icon item-icon--text"><span class="icon icon--text">💡 &amp; ✨</span></span>'},
    {href:'/c/',text:'Image',icon:'<span class="item-icon"><img class="icon icon--image icon--monochrome" src="/media/icon.hash.svg" alt="" width="16" height="16" decoding="async"></span>'}
  ]});
  const data=readNavigationFragment(content);
  assert.equal(data.logicalPath,'/书签/');assert.equal(data.label,'A & B <C>');assert.equal(data.rows[0].text,'A & B <C>');
  assert.deepEqual(data.rows[0],{kind:'section',href:'/a/',text:'A & B <C>',sort_name:'1',sort_date:'2026-10-01',sort_count:'0',icon:'file'});
  assert.equal(data.rows[1].text,'Literal &quot;quote&quot;');assert.equal(data.rows[1].title,'Full & exact');
  assert.equal(data.rows[1].sort_date,'20261109000000');assert.equal(data.rows[1].sort_price,'0');assert.deepEqual(data.rows[1].icon,{text:'💡 & ✨'});
  assert.deepEqual(data.rows[2].icon,{image:'/media/icon.hash.svg',monochrome:true});
  assert.deepEqual(readNavigationFragment(fragment({sortVariant:'',defaultSort:''})).rows,[],'Read-only empty columns are valid.');
  assert.equal(readNavigationFragment(fragment({sortVariant:'products'})).defaultSort,'date-desc');
  assert.throws(()=>readNavigationFragment(fragment({sortVariant:'products',defaultSort:'version-asc'})),/Invalid navigation fragment metadata/);
  const empty=fragment({rows:[{href:'/empty/',text:'Empty',sort_date:'',sort_price:''}]}).replace('data-sort-date=""','data-sort-date').replace('data-sort-price=""','data-sort-price');
  const emptyRow=readNavigationFragment(empty).rows[0];assert.equal(emptyRow.sort_date,'');assert.equal(emptyRow.sort_price,'','Minified empty sort attributes retain empty values.');
});

test('navigation fragments preserve literal entities in labels, rows, icons and attributes',()=>{
  const literal='Literal &lt;tag&gt; &amp; &#60; &#x3e;';
  const href='/p/&lt;tag&gt;/',title=literal+' full';
  const data=readNavigationFragment(fragment({label:literal,href:'/shared/&lt;tag&gt;/',rows:[{
    href,text:literal,title,
    icon:'<span class="item-icon item-icon--text"><span class="icon icon--text">'+escape(literal)+'</span></span>'
  }]}));
  assert.equal(data.label,literal);assert.equal(data.href,'/shared/&lt;tag&gt;/');
  assert.equal(data.rows[0].text,literal);assert.equal(data.rows[0].title,title);assert.equal(data.rows[0].href,href);
  assert.deepEqual(data.rows[0].icon,{text:literal});
});

test('navigation fragments reject malformed roots, active markup and unsafe links',()=>{
  const valid=fragment({rows:[{href:'/one/',text:'One'}]});
  for(const content of [valid+valid,'<!DOCTYPE html><html>'+valid+'</html>',valid.replace('data-sort-variant="section"','data-sort-variant="unknown"'),
    valid.replace('aria-label="Shared"',''),valid.replace('role="group"',''),
    valid.replace('data-collection-href="/shared/"','data-collection-href="https://outside.test/"'),
    valid.replace('data-default-sort="date-desc"','data-default-sort="price-desc"'),valid.replace('data-list-header',''),
    valid.replace('<span class="breadcrumb-sort-label">Date</span>',''),valid.replace('data-sort-indicator',''),
    valid.replace('href="#icon-file"','href="/same-origin.svg#file"'),
    valid.replace('data-kind="page"',''),valid.replace('<bdi>One</bdi>',''),
    valid.replace('<bdi>One</bdi>','<script>alert(1)</script><bdi>One</bdi>'),valid.replace('<a class="item-control','<a onclick="alert(1)" class="item-control'),
    valid.replace('href="/one/"','href="javascript:alert(1)"'),valid.replace('href="/one/"','href="https://outside.test/"')])
    assert.throws(()=>readNavigationFragment(content));
  assert.throws(()=>readNavigationFragment(fragment({rows:[{href:'/one/',text:'One'},{href:'/one/',text:'Again'}]})),/duplicate/);
  assert.throws(()=>readNavigationFragment(valid.replace('</div>','')),/Unclosed|Unexpected/);
});

test('breadcrumb readers resolve the published root behind Hugo language redirects',async()=>{
  const directory=fixture();
  write(directory,'index.html','<!DOCTYPE html>\n<html lang="en">\n<head>\n'+
    '<title>https://example.test/base/en/</title>\n<link rel="canonical" href="https://example.test/base/en/">\n'+
    '<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url=https://example.test/base/en/">\n</head>\n</html>');
  for(const lang of ['en','zh']) {
    const hash=(lang==='en'?'a':'b').repeat(64),content=fragment({href:'/base/'+lang+'/shared/',rows:[{href:'/base/'+lang+'/one/',text:lang==='en'?'One':'一'}]});
    write(directory,'site/navigation/'+hash+'.txt',content);
    const navigation=fixtureNavigation('/base/site/navigation/');navigation.columns['/shared/']=hash;
    const html='<html lang="'+lang+'"><head><link rel="canonical" href="https://example.test/base/'+lang+'/article/"></head>'+navigationHtml(navigation).split('<body')[1].replace(/^/, '<body');
    write(directory,lang+'/article/index.html',html);
    const data=readBreadcrumbData(html,{directory});assert.equal(data.error,'');assert.deepEqual(data.columns['/shared/'],readNavigationFragment(content));
    assert.match(readBreadcrumbData(html.replace('/base/site/navigation/','/outside/'),{directory}).error,/leaves the published site/);
  }
  assert.deepEqual((await inspectBreadcrumb(directory)).issues,[]);
});

test('share image validity and repository size budgets fail independently',async()=>{
  const src='/media/content/pixel.jpg',directory=fixture('<meta property=og:image content="'+src+'"><meta name=twitter:image content="'+src+'">');
  const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=','base64');
  write(directory,src.slice(1),jpeg);
  assert.deepEqual((await inspectShareImage(directory)).issues,[]);
  assert.deepEqual((await inspectShareImageBudget(directory)).issues,[]);
  write(directory,src.slice(1),Buffer.concat([jpeg,Buffer.alloc(maxShareImageBytes)]));
  assert.deepEqual((await inspectShareImage(directory)).issues,[],'A valid image can exceed a repository budget.');
  assert.equal((await inspectShareImageBudget(directory)).issues.length,1,'OG and Twitter references share one resource budget.');
  write(directory,src.slice(1),'invalid JPEG');
  assert.match((await inspectShareImage(directory)).issues.join('\n'),/not a readable JPEG/);
  assert.deepEqual((await inspectShareImageBudget(directory)).issues,[]);
});

test('source guards reject retired controls without rejecting text or similar class names',async()=>{
  await verifyRetiredOutput(fixture('<pre>site-nav-utilities</pre><div class=site-nav-utilities-extra></div>'));
  await assert.rejects(verifyRetiredOutput(fixture('<div class="custom site-nav-utilities"></div>')),/Retired settings controls/);
});
