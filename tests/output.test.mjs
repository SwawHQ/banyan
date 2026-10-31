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
import {readBreadcrumbData} from '../.agents/skills/swaw-banyan/tasks/_shared/html/breadcrumb.mjs';

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

const encodeNavigation=value=>JSON.stringify(value).replaceAll('&','&amp;').replaceAll('"','&quot;');
const columnHash='a'.repeat(64);
function fixtureNavigation(resources='/site/navigation/') {
  return {home:'/',resources,columns:{'/shared/':columnHash},default:'/shared/'};
}
const navigationHtml=value=>'<html lang=en><link rel=canonical href="https://example.test/article/"><body data-navigation="'+encodeNavigation(value)+'"></body></html>';

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

test('breadcrumb payload and collection source budgets remain repository contracts',async()=>{
  const directory=fixture(),navigation={home:'/',resources:'/site/navigation/',columns:{'/one/':columnHash,'/two/':'b'.repeat(64)},default:''};
  for(const [logicalPath,hash] of Object.entries(navigation.columns))write(directory,'site/navigation/'+hash+'.json',JSON.stringify({
    v:1,p:'collection',lp:logicalPath,label:'Source',href:logicalPath,f:['href','text'],rv:['/article/','Article']}));
  for(const name of ['articles-all','articles','products-all','products']) {
    write(directory,name+'/index.html',navigationHtml(navigation));
    assert.match((await inspectHtmlBudget(directory)).issues.join('\n'),/source count exceeded budget/);
  }
  write(directory,'article/index.html',navigationHtml({...navigation,error:'x'.repeat(65536)}));
  assert.match((await inspectHtmlBudget(directory)).issues.join('\n'),/site-wide limit/);
});

test('breadcrumb references count inline bytes and shared external items once',async()=>{
  const navigation=fixtureNavigation(),url=navigation.resources+columnHash+'.json';
  const payload={v:1,p:'collection',lp:'/shared/',label:'Shared',href:'/shared/',f:['href','text'],rv:['/article/','Article','/two/','Literal &quot;quote&quot;']};
  const html=navigationHtml(navigation),directory=fixture();write(directory,url.slice(1),JSON.stringify(payload));
  const [row]=breadcrumbRows([{text:html,relativePath:'article/index.html'}],{directory});
  assert.equal(row.breadcrumbParseError,'');assert.equal(row.breadcrumbSourceCount,1);assert.equal(row.breadcrumbItemCount,2);
  assert.equal(row.breadcrumbPayloadBytes,Buffer.byteLength(JSON.stringify(navigation)));
  const parsed=readBreadcrumbData(html,{directory});
  assert.equal(parsed.columns['/shared/'].rv[3],'Literal &quot;quote&quot;','JSON strings are not HTML-decoded.');
  assert.deepEqual(parsed.columnURLs,{'/shared/':url});
  assert.equal(parsed.defaultColumns[0].payload,parsed.sources[0].currentColumn.payload,'Default and alternate paths share one payload.');
  const rootOnly=readBreadcrumbData(navigationHtml({...navigation,default:''}),{directory});
  assert.deepEqual(rootOnly.defaultColumns,[]);assert.deepEqual(rootOnly.sources[0].columns,[],'Root-only references do not describe a complete path.');
  assert.deepEqual(readBreadcrumbData(html).columns,{},'Metadata can be inspected without reading resources.');
  write(directory,url.slice(1),JSON.stringify({...payload,rv:['/one/','x'.repeat(65536)]}));write(directory,'article/index.html',html);
  assert.doesNotMatch((await inspectHtmlBudget(directory)).issues.join('\n'),/site-wide limit/,'External JSON is excluded from inline budgets.');
  write(directory,'article/index.html',navigationHtml({...navigation,resources:'/site/'+ 'x'.repeat(65536)+'/'}));
  assert.match((await inspectHtmlBudget(directory)).issues.join('\n'),/site-wide limit/,'Resource references count toward inline budgets.');
  write(directory,'article/index.html',navigationHtml({...navigation,columns:[]}));
  assert.match((await inspectBreadcrumb(directory)).issues.join('\n'),/Navigation columns is not a JSON object/);
  write(directory,'article/index.html',navigationHtml({...navigation,default:0}));
  assert.match((await inspectBreadcrumb(directory)).issues.join('\n'),/Navigation default is not a column path/);
});

test('breadcrumb readers validate external JSON, site paths and base URL prefixes',async()=>{
  const directory=fixture(),payload={v:1,p:'collection',lp:'/shared/',label:'Shared',href:'/base/shared/',f:['href','text'],rv:['/one/','One']};
  write(directory,'index.html','<link rel=canonical href="https://example.test/base/">');
  write(directory,'site/navigation/'+columnHash+'.json',JSON.stringify(payload));
  const navigation=fixtureNavigation('/base/site/navigation/'),html=value=>navigationHtml({...navigation,resources:value});
  const resource='/base/site/navigation/',parsed=readBreadcrumbData(html(resource),{directory});
  assert.equal(parsed.error,'');assert.deepEqual(parsed.columns['/shared/'],payload,'The URL prefix is not a physical output directory.');
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
  const file='site/navigation/'+columnHash+'.json';write(directory,file,'{broken');
  assert.match(readBreadcrumbData(html(resource),{directory}).error,/Invalid breadcrumb column JSON/);
  write(directory,file,JSON.stringify({...payload,lp:'/different/'}));
  assert.match(readBreadcrumbData(html(resource),{directory}).error,/Invalid breadcrumb column payload for \/shared\//);
  write(directory,file,JSON.stringify(payload));write(directory,'article/index.html',html(resource));
  assert.deepEqual((await inspectBreadcrumb(directory)).issues,[]);
  assert.match(readBreadcrumbData(navigationHtml({...navigation,columns:{}}),{directory}).error,/Missing breadcrumb column URL/);
  assert.match(readBreadcrumbData(navigationHtml({...navigation,columns:{'/shared/':payload}})).error,/Invalid breadcrumb column hash/);
  const literal=fixtureNavigation();literal.error='Literal &quot;quote&quot;';
  assert.equal(readBreadcrumbData(navigationHtml(literal)).navigation.error,'Literal &quot;quote&quot;','HTML entities are decoded once.');
});

test('breadcrumb readers resolve the published root behind Hugo language redirects',async()=>{
  const directory=fixture();
  write(directory,'index.html','<!DOCTYPE html>\n<html lang="en">\n<head>\n'+
    '<title>https://example.test/base/en/</title>\n<link rel="canonical" href="https://example.test/base/en/">\n'+
    '<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url=https://example.test/base/en/">\n</head>\n</html>');
  for(const lang of ['en','zh']) {
    const hash=(lang==='en'?'a':'b').repeat(64),payload={v:1,p:'collection',lp:'/shared/',label:'Shared',href:'/base/'+lang+'/shared/',f:['href','text'],rv:['/base/'+lang+'/one/',lang==='en'?'One':'一']};
    write(directory,'site/navigation/'+hash+'.json',JSON.stringify(payload));
    const navigation=fixtureNavigation('/base/site/navigation/');navigation.columns['/shared/']=hash;
    const html='<html lang="'+lang+'"><head><link rel="canonical" href="https://example.test/base/'+lang+'/article/"></head>'+navigationHtml(navigation).split('<body')[1].replace(/^/, '<body');
    write(directory,lang+'/article/index.html',html);
    const data=readBreadcrumbData(html,{directory});assert.equal(data.error,'');assert.deepEqual(data.columns['/shared/'],payload);
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
