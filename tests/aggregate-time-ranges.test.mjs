import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fixtureEnvironment,fixtureSiteMounts,fixtureSiteFiles,fixtureSitePages,directoryPage} from './_shared/hugo.mjs';
import {collectionPayload} from './_shared/navigation.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {readBreadcrumbData} from '../.agents/skills/swaw-banyan/tasks/_shared/html/breadcrumb.mjs';
import {decodeHtmlAttribute,extractStartTags,extractTagAttribute,extractCanonicalHref} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {loadChromium} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer,listenOnLoopback} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {gotoAndWait} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/page.mjs';
import {afterPaint,waitForBrowse} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/viewport.mjs';
import {check as checkSource} from '../.agents/skills/swaw-banyan/tasks/check/browser/breadcrumb/source/check.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/aggregate-time-ranges-tests');
const locales=[['',''],['.zh','/zh'],['.zh-tw','/zh-tw'],['.ar','/ar']];
const articles=[
  ['before','1999-12-31T23:59:59+08:00'],
  ['start','2000-01-01T00:00:00+08:00'],
  ['fallback',null,'2001-06-01T00:00:00+08:00'],
  ['middle','2002-01-01T00:00:00+08:00'],
  ['end','2005-02-01T00:00:00+08:00'],
  ['after','2010-01-01T00:00:00+08:00'],
  ['override','2001-07-01T00:00:00+08:00','2009-01-01T00:00:00+08:00'],
  ['offset','1999-12-31T16:00:00Z'],
  ['latest','2012-01-01T00:00:00+08:00']
];
let work,source,output,config;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function range(start,end){return 'time_range:\n    start: '+JSON.stringify(start)+'\n    end: '+JSON.stringify(end);}
function collection(title,params='',fields=''){
  return '---\ntitle: '+title+'\nlayout: page-collection-directory-all\n'+fields+
    'params:\n  slots: [breadcrumb]\n'+(params?'  '+params+'\n':'')+'---\n';
}
function article(name,lastmod,date=lastmod){
  return '---\ntitle: Range '+name+'\nurl: p/range-'+name+'/\ndate: '+JSON.stringify(date)+'\n'+
    (lastmod?'lastmod: '+JSON.stringify(lastmod)+'\n':'')+'---\nRange fixture article.\n';
}
function build(destination=output){
  return spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--enableGitInfo=false','--destination',destination],
    {cwd:source,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
}
function passed(result){assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);}
function read(route,prefix='',directory=output,file='index.html'){return fs.readFileSync(path.join(directory,prefix,route,file),'utf8');}
function sources(html,directory=output){
  const data=readBreadcrumbData(html,{directory});assert.equal(data.error,'');return data.sources;
}
function payloadRows(data){
  return Array.from({length:data.rv.length/data.f.length},(_,row)=>
    ({...data.c,...Object.fromEntries(data.f.map((name,index)=>[name,data.rv[row*data.f.length+index]]))}));
}
function collectionRows(html,route,directory=output){
  const logicalPath=extractTagAttribute(extractStartTags(html,'body')[0],'data-collection-path');
  assert.equal(logicalPath,'/'+route+'/');
  const data=collectionPayload(directory,logicalPath,new URL(extractCanonicalHref(html)).pathname);
  return {source:{logicalPath:data.lp,sortVariant:data.sv,defaultSort:data.ds,href:data.href,label:data.label},rows:payloadRows(data)};
}
function rows(route,prefix='',directory=output){return collectionRows(read(route,prefix,directory),route,directory);}
function mainRows(route,prefix='',directory=output){
  const html=extractBlocks(read(route,prefix,directory),'main')[0].html;
  return extractBlocks(html,'div',tag=>/\bdata-list-item(?:\s|=|>)/.test(tag)).flatMap(block=>{
    const link=extractStartTags(block.html,'a').find(tag=>/\bdata-list-entry(?:\s|=|>)/.test(tag));
    if(!link)return [];
    const fields=Object.fromEntries(extractBlocks(block.html,'span',tag=>/\bdata-item-field(?:\s|=|>)/.test(tag))
      .map(field=>[extractTagAttribute(field.open,'data-item-field'),decodeHtmlAttribute(field.inner.replace(/<[^>]*>/g,'')).replace(/\s/g,'')]));
    return [{href:extractTagAttribute(link,'href'),fields}];
  });
}
function hrefs(route,prefix='',directory=output){return rows(route,prefix,directory).rows.map(row=>row.href).sort();}
function articleHrefs(names,prefix=''){return names.map(name=>prefix+'/p/range-'+name+'/').sort();}

before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));
  source=path.join(work,'site');output=path.join(work,'public');
  fixtureSiteFiles(source);fixtureSitePages(source,['appearance','language','my','_res','rss','powered-by']);
  fs.mkdirSync(path.join(source,'themes'),{recursive:true});
  fs.cpSync(path.join(repository,'module'),path.join(source,'themes/banyan'),{recursive:true});
  config=path.join(source,'hugo.toml');
  write(config,'theme="banyan"\nbaseURL="https://example.test/"\ntitle="Range fixture"\ntimeZone="Asia/Shanghai"\n'+
    'defaultContentLanguage="en"\nenableRobotsTXT=true\nprintPathWarnings=true\npanicOnWarning=true\n'+
    '[frontmatter]\nlastmod=["lastmod","date"]\n[minify]\ndisableJS=true\n[params.appearance]\npalette="css/theme.css"\n'+
    '[languages.en]\nlabel="English"\nweight=1\n[languages.zh]\nlabel="中文"\nweight=2\n'+
    '[languages.zh-tw]\nlabel="繁體"\nweight=3\n[languages.ar]\nlabel="العربية"\ndirection="rtl"\nweight=4\n'+
    '[taxonomies]\n[[cascade]]\n[cascade.build]\npublishResources=false\n'+
    '[outputs]\nhome=["HTML","RSS","LLMS"]\nsection=["HTML","RSS"]\npage=["HTML"]\n'+
    '[outputFormats.LLMS]\nmediaType="text/plain"\nbaseName="llms"\nisPlainText=true\nnotAlternative=true\n'+fixtureSiteMounts);
  for(const [suffix] of locales){
    write(path.join(source,'content/_index'+suffix+'.md'),'---\ntitle: Home\ndescription: Range fixture home.\nlayout: page-article-norss\n---\nHome.\n');
    write(path.join(source,'content/d/_index'+suffix+'.md'),directoryPage('Source'));
    write(path.join(source,'content/other/_index'+suffix+'.md'),directoryPage('Other source'));
    for(const [name,lastmod,date] of articles)write(path.join(source,'content/d',name+suffix+'.md'),article(name,lastmod,date));
    write(path.join(source,'content/d/refs/_index'+suffix+'.md'),directoryPage('Duplicate reference'));
    write(path.join(source,'content/archive/_index'+suffix+'.md'),collection('Archive','aggregate: /d',
      'cascade:\n  - target: {kind: section}\n    layout: page-collection-directory-all\n    params:\n      aggregate: /d\n      slots: [breadcrumb]\n'));
    for(const [name,start,end] of [['a','2000-01-01','2005-02-01'],['a/b','2000-01-01','2002-01-01'],['a/b/reserved','2001-12-01','2002-01-01'],
      ['c','2005-02-01','2010-01-01'],['empty','2030-01-01','2031-01-01']])
      write(path.join(source,'content/archive',name,'_index'+suffix+'.md'),collection('Range '+name,range(start,end)));
    write(path.join(source,'content/flat/_index'+suffix+'.md'),collection('Flat','aggregate: /d'));
    write(path.join(source,'content/window/_index'+suffix+'.md'),collection('Window','aggregate: /d\n  '+range('2000-01-01','2002-01-01')));
    write(path.join(source,'content/leaf/_index'+suffix+'.md'),collection('Leaf','aggregate: /d\n  '+range('2000-01-01','2002-01-01')));
  }
  write(path.join(source,'content/d/refs/_map.toml'),'refs = ["/d/start"]\n');
  passed(build());
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('manual time trees partition Lastmod once, retain remainder articles and empty reservations',()=>{
  for(const [,prefix] of locales){
    assert.deepEqual(hrefs('archive',prefix),[prefix+'/archive/a/',prefix+'/archive/c/',prefix+'/archive/empty/',
      ...articleHrefs(['before','after','latest'],prefix)].sort());
    assert.deepEqual(hrefs('archive/a',prefix),[prefix+'/archive/a/b/',...articleHrefs(['middle'],prefix)].sort());
    assert.deepEqual(hrefs('archive/a/b',prefix),[prefix+'/archive/a/b/reserved/',...articleHrefs(['start','fallback','override','offset'],prefix)].sort());
    assert.deepEqual(hrefs('archive/c',prefix),articleHrefs(['end'],prefix));
    assert.deepEqual(hrefs('archive/empty',prefix),[]);
    const direct=['archive','archive/a','archive/a/b','archive/c','archive/empty']
      .flatMap(route=>rows(route,prefix).rows.filter(row=>row.kind==='page').map(row=>row.href));
    assert.deepEqual(direct.sort(),articleHrefs(articles.map(([name])=>name),prefix),'Each source article belongs to exactly one direct list.');
    assert.equal(new Set(direct).size,direct.length);
  }
});

test('navigation columns publish flat shared JSON with stable content fingerprints',()=>{
  const repeated=path.join(work,'same-content');passed(build(repeated));
  const languageURLs=[];
  for(const [,prefix] of locales){
    const article=readBreadcrumbData(read('p/range-start',prefix),{directory:output});
    const second=readBreadcrumbData(read('p/range-fallback',prefix),{directory:output});
    const rebuilt=readBreadcrumbData(read('p/range-start',prefix,repeated),{directory:repeated});
    assert.equal(article.error,'');assert.equal(second.error,'');assert.equal(rebuilt.error,'');
    assert.deepEqual(rebuilt.columnURLs,article.columnURLs,'Unchanged content keeps the same resource URLs.');
    for(const [logicalPath,url] of Object.entries(article.columnURLs)){
      assert.equal(typeof url,'string');
      if(second.columnURLs[logicalPath])assert.equal(second.columnURLs[logicalPath],url,'Articles reuse each column resource.');
      const text=fs.readFileSync(path.join(output,new URL(url,'https://example.test').pathname),'utf8');
      assert.equal(url,'/site/navigation/'+createHash('sha256').update(text).digest('hex')+'.json');
      assert.equal(JSON.parse(text).lp,logicalPath);assert.ok(!Object.hasOwn(JSON.parse(text),'selected'));
      assert.match(url,/^\/site\/navigation\/[a-f0-9]{64}\.json$/,'Navigation resources use a flat content-addressed namespace.');
    }
    languageURLs.push(new Set(Object.values(article.columnURLs)));
  }
  assert.equal(new Set(languageURLs.flatMap(urls=>[...urls])).size,languageURLs.reduce((count,urls)=>count+urls.size,0),
    'Languages must not overwrite each other’s column resources.');
  const emptyPayloads=locales.map(([,prefix])=>collectionPayload(output,'/archive/empty/',prefix+'/archive/empty/'));
  assert.ok(emptyPayloads.every(payload=>payload.rv.length===0),'Empty collections publish their shared payload.');
  assert.equal(new Set(emptyPayloads.map(payload=>createHash('sha256').update(JSON.stringify(payload)).digest('hex'))).size,locales.length,
    'Language-specific header links remain part of the content fingerprint.');
  const resources=fs.readdirSync(path.join(output,'site/navigation'),{withFileTypes:true});
  assert.ok(resources.every(entry=>entry.isFile()&&/^[a-f0-9]{64}\.json$/.test(entry.name)),
    'Navigation resources contain no language, column path or items prefix.');
  for(const entry of resources){
    const content=fs.readFileSync(path.join(output,'site/navigation',entry.name));
    assert.equal(entry.name,createHash('sha256').update(content).digest('hex')+'.json');
  }
});

test('time-tree rows share directory counts, navigation and ItemList without descendant expansion',()=>{
  for(const [,prefix] of locales){
    const root=rows('archive',prefix),a=rows('archive/a',prefix);
    assert.equal(root.source.sortVariant,'section');assert.equal(a.source.sortVariant,'section');
    for(const [route,href,count] of [['archive','/archive/a/','5'],['archive','/archive/c/','1'],
      ['archive','/archive/empty/','0'],['archive/a','/archive/a/b/','4']]){
      const row=rows(route,prefix).rows.find(row=>row.href===prefix+href);
      assert.equal(row.kind,'section');assert.equal(row.sort_count,count);
      const visible=mainRows(route,prefix).find(row=>row.href.split('#')[0]===prefix+href);
      assert.equal(visible.fields.count,count,'Folder counts include descendants without listing them.');
    }
    for(const route of ['archive','archive/a','archive/a/b','archive/c','archive/empty']){
      const html=read(route,prefix),visible=mainRows(route,prefix),current=rows(route,prefix);
      assert.deepEqual(visible.map(row=>row.href.split('#')[0]).sort(),current.rows.map(row=>row.href).sort());
      for(const row of visible.filter(row=>row.href.includes('/p/range-')))
        assert.equal(new URLSearchParams(new URL(row.href,'https://example.test').hash.slice(1)).get('from'),route);
      const itemList=[...html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/g)]
        .filter(match=>extractTagAttribute(match[1],'type')==='application/ld+json')
        .map(match=>JSON.parse(match[2])).find(schema=>schema['@type']==='ItemList');
      if(current.rows.length)assert.equal(itemList.itemListElement.length,current.rows.length,'Schema follows direct rows.');
      else assert.ok(!itemList||itemList.itemListElement.length===0);
    }
    const articleHtml=read('p/range-start',prefix),articleSources=sources(articleHtml),paths=articleSources.map(source=>source.logicalPath);
    const body=extractStartTags(articleHtml,'body')[0];
    const manifest=JSON.parse(extractTagAttribute(body,'data-navigation'));
    assert.equal(typeof manifest.default,'string');
    assert.ok(manifest.default,'The physical path retains its terminal owner.');
    assert.ok(!['routes','from','paths'].some(key=>Object.hasOwn(manifest,key)));
    const navigation=extractBlocks(articleHtml,'nav',tag=>extractTagAttribute(tag,'data-slot')==='breadcrumb');
    assert.equal(navigation.length,1);assert.equal(extractStartTags(navigation[0].html,'a').length,0,'Article path rows load from shared JSON.');
    const decoded=readBreadcrumbData(articleHtml,{directory:output});
    assert.ok(decoded.defaultColumns.length>0,'Default prefixes are derived from one terminal owner.');
    assert.ok(decoded.sources.some(source=>source.columns.some(column=>column.payload===decoded.defaultColumns[0].payload)),
      'Sources share the same ancestor payload.');
    for(const [logicalPath,url] of Object.entries(decoded.columnURLs)){
      assert.match(manifest.columns[logicalPath],/^[a-f0-9]{64}$/,'Inline columns contain only content hashes.');
      assert.match(url,/^\/site\/navigation\/[a-f0-9]{64}\.json$/);
      const data=decoded.columns[logicalPath];
      assert.deepEqual(data,collectionPayload(output,logicalPath,prefix+logicalPath),'Navigation and collection use one shared payload.');
      assert.equal(data.lp,logicalPath);assert.equal(typeof data.label,'string');assert.equal(typeof data.href,'string');
      assert.ok(!data.f.includes('key')&&!data.f.includes('sort_group'),'Navigation rows omit derived values.');
      assert.ok([...data.f,...Object.keys(data.c||{})].every(field=>!field.endsWith('_text')&&!['size_unit','count_unit'].includes(field)),
        'Navigation columns omit display-only fields.');
    }
    assert.ok(paths.includes('/archive/a/b/'));assert.ok(!paths.includes('/archive/a/'));assert.ok(!paths.includes('/archive/'));
    const selected=articleSources.find(source=>source.logicalPath==='/archive/a/b/');
    assert.ok(selected.columns.some(column=>column.source?.logicalPath==='/archive/'));
    assert.ok(selected.columns.some(column=>column.source?.logicalPath==='/archive/a/'));
    for(const column of selected.columns.filter(column=>column.payload)){
      const data=column.payload,hrefIndex=data.f.indexOf('href');
      const values=Array.from({length:data.rv.length/data.f.length},(_,index)=>data.rv[index*data.f.length+hrefIndex]);
      if(column.source.logicalPath==='/archive/')assert.ok(!values.includes(prefix+'/p/range-start/'),'Root payload must not repeat a descendant article.');
    }
  }
});

test('flat aggregates, original directories and scoped feeds keep their existing contracts',()=>{
  for(const [,prefix] of locales){
    assert.equal(rows('flat',prefix).source.sortVariant,'all');
    assert.deepEqual(hrefs('flat',prefix),articleHrefs(articles.map(([name])=>name),prefix));
    assert.equal(rows('d',prefix).rows.filter(row=>row.kind==='page').length,articles.length);
    assert.deepEqual(hrefs('window',prefix),articleHrefs(['start','fallback','override','offset'],prefix));
    for(const [route,count] of [['archive',9],['archive/a',5],['archive/a/b',4],['archive/c',1],['archive/empty',0],['flat',9],['window',4]])
      assert.equal((read(route,prefix,output,'index.xml').match(/<item>/g)||[]).length,count,route+' RSS follows its full range.');
  }
});

test('a section can provide a filtered aggregate without child sections',()=>{
  for(const [,prefix] of locales){
    assert.deepEqual(hrefs('leaf',prefix),articleHrefs(['start','fallback','override','offset'],prefix));
    assert.equal(rows('leaf',prefix).source.sortVariant,'section');
    assert.ok(sources(read('p/range-start',prefix)).some(source=>source.logicalPath==='/leaf/'));
    for(const row of mainRows('leaf',prefix))
      assert.equal(new URLSearchParams(new URL(row.href,'https://example.test').hash.slice(1)).get('from'),'leaf');
  }
});

test('Hugo frontmatter configuration owns Lastmod fallback and partition membership',()=>{
  const original=fs.readFileSync(config,'utf8'),destination=path.join(work,'configured-lastmod');
  try{
    write(config,original.replace('lastmod=["lastmod","date"]','lastmod=["date"]'));
    passed(build(destination));
    assert.deepEqual(hrefs('archive/a/b','',destination),['/archive/a/b/reserved/',...articleHrefs(['start','fallback','offset'])].sort());
    assert.deepEqual(hrefs('archive/c','',destination),articleHrefs(['end','override']));
  }finally{write(config,original);}
});

test('invalid ranges, sibling overlap, source changes and children outside parents fail the build',{timeout:180000},()=>{
  const target=path.join(source,'content/archive/a/b/_index.md'),original=fs.readFileSync(target,'utf8');
  const sibling=path.join(source,'content/archive/c/_index.md'),siblingOriginal=fs.readFileSync(sibling,'utf8');
  const cases=[
    ['invalid date',collection('Invalid',range('not-a-date','2002-01-01'))],
    ['reversed range',collection('Invalid',range('2002-01-01','2000-01-01'))],
    ['empty range',collection('Invalid',range('2000-01-01','2000-01-01'))],
    ['missing end',collection('Invalid','time_range: {start: "2000-01-01"}')],
    ['array range',collection('Invalid','time_range: ["2000-01-01", "2002-01-01"]')],
    ['scalar range',collection('Invalid','time_range: true')],
    ['unknown range key',collection('Invalid','time_range: {start: "2000-01-01", end: "2002-01-01", extra: true}')],
    ['outside parent',collection('Invalid',range('1999-01-01','2002-01-01'))],
    ['outside parent end',collection('Invalid',range('2000-01-01','2006-01-01'))],
    ['different source',collection('Invalid','aggregate: /other\n  '+range('2000-01-01','2002-01-01'))],
    ['missing child range',collection('Invalid')]
  ];
  try{
    for(const [label,text] of cases){
      write(target,text);const result=build(path.join(work,'invalid'));
      assert.ifError(result.error);assert.notEqual(result.status,0,label+' must fail.');
      assert.match(result.stdout+result.stderr,/time_range|time range|range|aggregate/i,label+' reports the range contract.');
      assert.match(result.stdout+result.stderr,/archive\/a\/b|archive\\a\\b/,label+' identifies the invalid child.');
    }
    write(target,original);write(sibling,collection('Overlap',range('2004-01-01','2010-01-01')));
    const overlap=build(path.join(work,'overlap'));assert.notEqual(overlap.status,0);assert.match(overlap.stdout+overlap.stderr,/overlap/i);
    assert.match(overlap.stdout+overlap.stderr,/archive\/a|archive\\a/);assert.match(overlap.stdout+overlap.stderr,/archive\/c|archive\\c/);
    write(sibling,siblingOriginal);
    const unsupported=path.join(source,'content/unsupported/_index.md');
    try{
      write(unsupported,collection('Unsupported',range('2000-01-01','2002-01-01')).replace('layout: page-collection-directory-all','layout: page-collection-directory'));
      const result=build(path.join(work,'unsupported-layout'));assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/time_range/);
    }finally{fs.rmSync(unsupported,{force:true});fs.rmdirSync(path.dirname(unsupported));}
  }finally{write(target,original);write(sibling,siblingOriginal);}
});

test('time ranges accept Hugo-parsed date values and retain their exact boundary',()=>{
  const file=path.join(source,'content/window/_index.md'),original=fs.readFileSync(file,'utf8'),destination=path.join(work,'native-dates');
  try{
    write(file,original.replace('"2000-01-01"','2000-01-01').replace('"2002-01-01"','2002-01-01'));
    passed(build(destination));assert.deepEqual(hrefs('window','',destination),articleHrefs(['start','fallback','override','offset']));
  }finally{write(file,original);}
});

test('adjacent second and subsecond intervals assign boundary articles once',()=>{
  const directory=path.join(source,'content/seconds'),destination=path.join(work,'second-boundaries');
  const fractional=path.join(source,'content/d/fractional.md');
  try{
    write(path.join(directory,'_index.md'),collection('Seconds','aggregate: /d',
      'cascade:\n  - target: {kind: section}\n    layout: page-collection-directory-all\n    params:\n      aggregate: /d\n      slots: [breadcrumb]\n'));
    write(path.join(directory,'before/_index.md'),collection('Before boundary',range('1999-12-31T23:59:59+08:00','2000-01-01T00:00:00+08:00')));
    write(path.join(directory,'after/_index.md'),collection('After boundary',range('2000-01-01T00:00:00+08:00','2000-01-01T00:00:01+08:00')));
    write(path.join(directory,'after/a-later/_index.md'),collection('A later',range('2000-01-01T00:00:00.5+08:00','2000-01-01T00:00:01+08:00')));
    write(path.join(directory,'after/z-earlier/_index.md'),collection('Z earlier',range('2000-01-01T00:00:00+08:00','2000-01-01T00:00:00.5+08:00')));
    write(fractional,article('fractional','2000-01-01T00:00:00.5+08:00'));
    passed(build(destination));
    assert.deepEqual(hrefs('seconds/before','',destination),articleHrefs(['before']));
    assert.deepEqual(hrefs('seconds/after','',destination),['/seconds/after/a-later/','/seconds/after/z-earlier/']);
    assert.deepEqual(hrefs('seconds/after/z-earlier','',destination),articleHrefs(['start','offset']));
    assert.deepEqual(hrefs('seconds/after/a-later','',destination),articleHrefs(['fractional']));
  }finally{
    fs.rmSync(fractional,{force:true});
    assert.ok(path.resolve(directory).startsWith(path.resolve(source)+path.sep));fs.rmSync(directory,{recursive:true,force:true});
  }
});

test('time-tree article entry preserves source columns, sorting, reload and fragment history',{timeout:60000},async()=>{
  const server=await createStaticSiteServer(output);let browser;
  try{
    await server.start();const type=loadChromium();browser=await type.launch({headless:true,executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
    for(const prefix of ['','/zh']){
      await checkSource({page,baseUrl:server.getBaseUrl(),options:{page:prefix+'/archive/a/b/reserved/',column:prefix+'/archive/a/b/',article:prefix+'/p/range-start/'}});
      const hrefs=await page.locator('[data-slot=breadcrumb] [data-breadcrumb-collection-href]').evaluateAll(nodes=>nodes.map(node=>node.dataset.breadcrumbCollectionHref));
      for(const route of ['/archive/','/archive/a/','/archive/a/b/'])assert.ok(hrefs.includes(prefix+route),'Article retains the complete manual source path.');
    }
  }finally{try{if(browser)await browser.close();}finally{await server.stop();}}
});

test('a Lastmod edit removes the old source and an old from value restores the default path',{timeout:60000},async()=>{
  const file=path.join(source,'content/d/override.md'),original=fs.readFileSync(file,'utf8'),destination=path.join(work,'moved-article');
  let server,browser;
  try{
    write(file,original.replace('2001-07-01T00:00:00+08:00','2003-07-01T00:00:00+08:00'));passed(build(destination));
    const paths=sources(read('p/range-override','',destination),destination).map(source=>source.logicalPath);
    assert.ok(paths.includes('/archive/a/'));assert.ok(!paths.includes('/archive/a/b/'));
    server=await createStaticSiteServer(destination);await server.start();
    const type=loadChromium();browser=await type.launch({headless:true,executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
    const snapshot=()=>page.locator('[data-slot=breadcrumb]').evaluate(nav=>({
      columns:[...nav.children].map(column=>column.dataset.breadcrumbCollectionHref||''),
      current:[...nav.querySelectorAll('[data-list-entry][aria-current=page]')].map(link=>new URL(link.href).pathname)
    }));
    await gotoAndWait(page,server.getBaseUrl()+'/p/range-override/');await waitForBrowse(page);await afterPaint(page);const defaults=await snapshot();
    await gotoAndWait(page,server.getBaseUrl()+'/p/range-override/#from=archive/a/b');await waitForBrowse(page);await afterPaint(page);
    assert.deepEqual(await snapshot(),defaults,'A stale source must not retain obsolete date columns.');
  }finally{write(file,original);try{if(browser)await browser.close();}finally{if(server)await server.stop();}}
});

test('ordinary ancestors include a nested time tree in counts and feeds without changing physical aggregate sources',()=>{
  const directory=path.join(source,'content/top'),probe=path.join(source,'content/physical-probe');
  const destination=path.join(work,'ordinary-ancestors');
  try{
    for(const [suffix] of locales){
      write(path.join(directory,'_index'+suffix+'.md'),directoryPage('Top'));
      write(path.join(directory,'hub/_index'+suffix+'.md'),directoryPage('Hub'));
      write(path.join(directory,'hub/ref/_index'+suffix+'.md'),directoryPage('Repeated reference'));
      write(path.join(probe,'_index'+suffix+'.md'),collection('Physical source','aggregate: /top'));
    }
    write(path.join(directory,'hub/ref/_map.toml'),'refs = ["/d/start"]\n');
    fs.cpSync(path.join(source,'content/archive'),path.join(directory,'hub/archive'),{recursive:true});
    passed(build(destination));
    for(const [,prefix] of locales){
      for(const [route,child] of [['top','top/hub'],['top/hub','top/hub/archive']]){
        const row=rows(route,prefix,destination).rows.find(row=>row.href===prefix+'/'+child+'/');
        assert.equal(row.sort_count,String(articles.length),route+' counts unique articles in the nested time tree.');
        assert.equal((read(route,prefix,destination,'index.xml').match(/<item>/g)||[]).length,articles.length,
          route+' RSS includes the nested time tree once.');
      }
      assert.deepEqual(hrefs('physical-probe',prefix,destination),articleHrefs(['start'],prefix),
        'An aggregate source still reads physical descendants and map references, not child aggregate views.');
      const entry=sources(read('p/range-start',prefix,destination),destination)
        .find(entry=>entry.logicalPath==='/top/hub/archive/a/b/');
      assert.ok(entry,'An article registers the complete nested time-tree entry path.');
      for(const route of ['/top/','/top/hub/','/top/hub/archive/','/top/hub/archive/a/'])
        assert.ok(entry.columns.some(column=>column.source?.logicalPath===route),route+' remains an ancestor navigation column.');
    }
  }finally{
    for(const target of [directory,probe]){
      assert.ok(path.resolve(target).startsWith(path.resolve(source)+path.sep));
      fs.rmSync(target,{recursive:true,force:true});
    }
  }
});

test('preview rebuilds update time membership, counts, feeds and source paths',{timeout:90000},async()=>{
  const articleFile=path.join(source,'content/d/override.md'),articleOriginal=fs.readFileSync(articleFile,'utf8');
  const rangeFile=path.join(source,'content/archive/a/b/_index.md'),rangeOriginal=fs.readFileSync(rangeFile,'utf8');
  const added=path.join(source,'content/archive/a/new-range');
  const probe=net.createServer();await listenOnLoopback(probe);
  const port=probe.address().port;await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
  const base='http://127.0.0.1:'+port;
  const server=spawn(toolExecutable('hugo'),['server','--noBuildLock','--bind','127.0.0.1','--port',String(port),
    '--baseURL',base,'--disableLiveReload','--enableGitInfo=false','--destination',path.join(work,'preview')],
    {cwd:source,env:fixtureEnvironment(work),windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='',launchError;server.on('error',error=>{launchError=error;});
  server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  async function html(route){
    const response=await fetch(base+'/'+route,{signal:AbortSignal.timeout(2000),headers:{Connection:'close'}});
    assert.equal(response.status,200,route);return response.text();
  }
  async function liveRows(route){
    await html(route+'/');
    const data=readBreadcrumbData(await html('p/range-start/'));assert.equal(data.error,'');
    const url=data.columnURLs['/'+route+'/'];assert.equal(typeof url,'string');
    const text=await html(url.replace(/^\//,''));
    assert.equal(url,'/site/navigation/'+createHash('sha256').update(text).digest('hex')+'.json',
      'Preview HTML references the current JSON content fingerprint.');
    const payload=JSON.parse(text);assert.equal(payload.lp,'/'+route+'/');return payloadRows(payload);
  }
  async function until(check){
    const deadline=Date.now()+20000;let last;
    while(Date.now()<deadline){
      if(launchError)throw launchError;if(server.exitCode!==null)throw new Error(logs);
      try{await check();return;}catch(error){last=error;}await delay(150);
    }
    throw new Error('Preview did not update: '+last+'\n'+logs);
  }
  async function state(direct,leaf,count){
    const parentRows=await liveRows('archive/a'),childRows=await liveRows('archive/a/b');
    assert.equal(parentRows.find(row=>row.href==='/archive/a/b/').sort_count,String(count));
    assert.equal(parentRows.some(row=>row.href==='/p/range-override/'),direct);
    assert.equal(childRows.some(row=>row.href==='/p/range-override/'),leaf==='archive/a/b');
    const articleHTML=await html('p/range-override/'),navigation=readBreadcrumbData(articleHTML);
    const paths=(await Promise.all(Object.entries(navigation.columnURLs).map(async([logicalPath,url])=>{
      const payload=JSON.parse(await html(url.replace(/^\//,'')));
      return payloadRows(payload).some(row=>row.href==='/p/range-override/')?logicalPath:null;
    }))).filter(Boolean);
    assert.ok(paths.includes('/'+leaf+'/'));assert.ok(!paths.includes('/'+(leaf==='archive/a'?'archive/a/b':'archive/a')+'/'));
    assert.equal(((await html('archive/a/b/index.xml')).match(/<item>/g)||[]).length,count);
    assert.equal(((await html('archive/a/index.xml')).match(/<item>/g)||[]).length,5);
  }
  try{
    await until(()=>state(false,'archive/a/b',4));
    write(articleFile,articleOriginal.replace('2001-07-01T00:00:00+08:00','2003-07-01T00:00:00+08:00'));
    await until(()=>state(true,'archive/a',3));
    write(rangeFile,rangeOriginal.replace('"2002-01-01"','"2003-01-01"'));
    await until(()=>state(true,'archive/a',4));
    write(path.join(added,'_index.md'),collection('Added range',range('2003-01-01','2004-01-01')));
    await until(()=>state(false,'archive/a/new-range',4));
    assert.ok(path.resolve(added).startsWith(path.resolve(source)+path.sep));fs.rmSync(added,{recursive:true,force:true});
    await until(()=>state(true,'archive/a',4));
  }finally{
    if(server.exitCode===null&&server.pid){
      const exited=new Promise(resolve=>server.once('exit',resolve));
      if(process.platform==='win32'){
        const stopped=spawnSync('taskkill',['/pid',String(server.pid),'/t','/f'],{windowsHide:true});
        assert.equal(stopped.status,0,String(stopped.stderr||stopped.error||'Could not stop preview.'));
      }else server.kill();
      await exited;
    }
    write(articleFile,articleOriginal);write(rangeFile,rangeOriginal);
    if(fs.existsSync(added)){assert.ok(path.resolve(added).startsWith(path.resolve(source)+path.sep));fs.rmSync(added,{recursive:true,force:true});}
  }
});
