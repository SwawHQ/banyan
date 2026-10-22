import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fixtureEnvironment,directoryPage} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {inspect as inspectSitemap} from '../.agents/skills/swaw-banyan/tasks/check/sitemap/inspect.mjs';
import {inspect as inspectLlms} from '../.agents/skills/swaw-banyan/tasks/check/llms/inspect.mjs';
import {extractTagAttribute,decodeHtmlAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {extractBlocks,stripRawText} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {loadChromium} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {gotoAndWait} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/page.mjs';
import {readFieldValue} from '../module/assets/js/browse/navigation-state.contract.js';

const repository=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/directory-references-tests');
const locales=[['',''],['.zh','/zh'],['.zh-tw','/zh-tw']];
let work,source,output;
function write(file,text) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function article(title,fields='') {return '---\ntitle: '+title+'\ndescription: Description for '+title+'.\ndate: 2026-01-01\n'+
  (/^url:/m.test(fields)?'':'url: p/'+title.toLowerCase().split(' ')[0]+'/\n')+fields+'\n---\nArticle body.\n';}
function refs(values) {return 'refs = '+JSON.stringify(values)+'\n';}
function build(directory=source,destination=output) {
  return spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--enableGitInfo=false','--destination',destination],
    {cwd:directory,env:fixtureEnvironment(work),encoding:'utf8',timeout:30000,windowsHide:true});
}
function passed(result) {assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);}
function read(route,file='index.html',directory=output) {return fs.readFileSync(path.join(directory,route,file),'utf8');}
function debug(prefix='') {return JSON.parse(read(prefix,'directory.json'));}
function sources(html) {
  const tag=html.match(/<body\b[^>]*>/i)?.[0]||'';
  return JSON.parse(decodeHtmlAttribute(extractTagAttribute(tag,'data-entry-breadcrumb-sources')||'[]'));
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));
  source=path.join(work,'site');output=path.join(work,'public');
  fs.mkdirSync(path.join(source,'themes'),{recursive:true});
  fs.cpSync(path.join(repository,'module'),path.join(source,'themes/banyan'),{recursive:true});
  write(path.join(source,'hugo.toml'),'theme="banyan"\nbaseURL="https://example.test/"\ntitle="Reference fixture"\ndefaultContentLanguage="en"\nenableRobotsTXT=true\nprintPathWarnings=true\npanicOnWarning=true\n'+
    '[minify]\ndisableJS=true\n[params]\ndescription="Reference fixture."\n[params.appearance]\npalette="css/theme.css"\n[languages.en]\nlabel="English"\nweight=1\n[languages.zh]\nlabel="中文"\nweight=2\n[languages.zh-tw]\nlabel="繁體"\nweight=3\n'+
    '[taxonomies]\n[cascade.build]\npublishResources=false\n[outputs]\nhome=["HTML","RSS","LLMS","DIRECTORY"]\nsection=["HTML","RSS"]\npage=["HTML"]\n'+
    '[outputFormats.LLMS]\nmediaType="text/plain"\nbaseName="llms"\nisPlainText=true\nnotAlternative=true\n'+
    '[outputFormats.DIRECTORY]\nmediaType="application/json"\nbaseName="directory"\nisPlainText=true\nnotAlternative=true\n');
  write(path.join(source,'layouts/home.directory.json'),
    '{{- $index := partialCached "feature-browse/directory/index.html" .Site .Site.Language.Lang -}}'+
    '{{- $out := dict -}}{{- range $kind := slice "direct" "recursive" "incoming" -}}{{- $groups := dict -}}'+
    '{{- range $key, $pages := index $index $kind -}}{{- $items := slice -}}{{- range $pages -}}'+
    '{{- $items = $items | append (dict "path" .Path "url" .RelPermalink) -}}{{- end -}}'+
    '{{- $groups = merge $groups (dict $key $items) -}}{{- end -}}{{- $out = merge $out (dict $kind $groups) -}}{{- end -}}{{ $out | jsonify }}');
  for(const [suffix] of locales) {
    write(path.join(source,'content/_index'+suffix+'.md'),article('Home','layout: page-article'));
    write(path.join(source,'content/library/_index'+suffix+'.md'),directoryPage('Library','root_nav: true'));
    for(const section of ['original','references','references/nested','second'])
      write(path.join(source,'content/library',section,'_index'+suffix+'.md'),directoryPage(section));
    write(path.join(source,'content/library/original/item/index'+suffix+'.md'),article('Shared '+suffix,'url: p/'+(suffix==='.zh'?'translated-item':'item')+'/'));
    write(path.join(source,'content/library/original/second/index'+suffix+'.md'),article('Second '+suffix));
    write(path.join(source,'content/all/index'+suffix+'.md'),article('All','layout: page-collection\nlist: all\naggregate: /library\nroot_nav: true\nslots: {breadcrumb: true}'));
  }
  write(path.join(source,'content/library/references/_map.toml'),refs(['/library/original/item/']));
  write(path.join(source,'content/library/references/nested/_map.toml'),refs(['/library/original/item','/library/original/second']));
  write(path.join(source,'content/library/second/_map.toml'),refs(['/library/original/item']));
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('regular pages require an explicit URL and article archetypes supply one',()=>{
  const file=path.join(source,'content/library/url-contract.md');
  try {
    for(const fields of ['', 'slug: legacy-only', 'url: ""', 'url: "   "']) {
      write(file,article('URL contract').replace(/^url:.*\n/m,'').replace('\n---\nArticle body.','\n'+fields+'\n---\nArticle body.'));
      const result=build(source,path.join(work,'url-contract'));
      assert.notEqual(result.status,0,fields+' must fail');
      assert.match(result.stdout+result.stderr,/requires a non-empty url field/);
    }
  } finally {fs.rmSync(file,{force:true});}
  for(const kind of ['banyan','blog']) {
    const name='URL Contract '+kind,file=path.join(source,'content/library',name+'.md');
    try {
      const result=spawnSync(toolExecutable('hugo'),['new','content','library/'+name+'.md','--kind',kind],
        {cwd:source,env:fixtureEnvironment(work),encoding:'utf8',windowsHide:true,timeout:30000});
      passed(result);
      const text=fs.readFileSync(file,'utf8');
      assert.ok(text.includes('url: "p/url-contract-'+kind+'/"'));assert.doesNotMatch(text,/^slug:/m);
    } finally {fs.rmSync(file,{force:true});}
  }
});

test('article schema follows the layout independently of visible metadata',()=>{
  const file=path.join(source,'content/library/original/item/index.md'),original=fs.readFileSync(file,'utf8');
  const schemas=html=>[...html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/g)]
    .filter(match=>extractTagAttribute(match[1],'type')==='application/ld+json')
    .map(match=>JSON.parse(match[2])).filter(schema=>schema['@type']==='BlogPosting');
  let expected;
  try {
    for(const meta of [true,false]) {
      write(file,original.replace('\n---\n','\nslots: {breadcrumb: true, meta: '+meta+'}\n---\n'));
      const destination=path.join(work,'article-schema-'+meta);passed(build(source,destination));
      const html=read('p/item','index.html',destination),articleSchemas=schemas(html);
      assert.equal(articleSchemas.length,1,'The article layout must emit one BlogPosting.');
      if(meta)expected=articleSchemas;else assert.deepEqual(articleSchemas,expected,'Hiding metadata must preserve article schema.');
      const metadata=extractBlocks(html,'div',tag=>(extractTagAttribute(tag,'class')||'').split(/\s+/).includes('document-meta'));
      assert.equal(metadata.length,meta?1:0,'The meta slot must control the visible metadata.');
      for(const route of ['language','appearance','powered-by','offline'])
        assert.deepEqual(schemas(read(route,'index.html',destination)),[],route+' must not emit BlogPosting.');
    }
  } finally {write(file,original);}
});

test('ordinary directories share translated references, counts, metadata, source context and canonical outputs',async()=>{
  passed(build());
  for(const [suffix,prefix] of locales) {
    const index=debug(prefix),target='/library/original/item',url=prefix+'/p/'+(suffix==='.zh'?'translated-item':'item')+'/';
    assert.deepEqual(index.direct['/library/references'].map(item=>item.path),[target]);
    assert.deepEqual(index.recursive['/library/references'].map(item=>item.path).toSorted(),[target,'/library/original/second'].toSorted());
    assert.deepEqual(index.incoming[target].map(item=>item.path).toSorted(),['/library/references','/library/references/nested','/library/second']);
    assert.equal(index.recursive['/library'].filter(item=>item.path===target).length,1,'An article in multiple descendants is one ancestor member.');
    const collection=read(prefix+'/library/references/');
    assert.ok(collection.includes(url+'#from=library/references'),'Reference links must retain the source directory.');
    const html=read(url);
    assert.ok(html.includes(prefix+'/library/references/'),'Article metadata must link an incoming reference.');
    assert.ok(sources(html).some(item=>item.logicalPath==='/library/references/'),'Source models must expose a referring directory.');
    const rss=read(prefix+'/library/references/','index.xml');
    assert.equal([...rss.matchAll(new RegExp('<guid>https://example\\.test'+url+'</guid>','g'))].length,1,'RSS must list the canonical article once.');
    const sitemap=read(prefix||'/en','sitemap.xml'),llms=read(prefix,'llms.txt');
    assert.equal([...sitemap.matchAll(new RegExp('<loc>https://example\\.test'+url+'</loc>','g'))].length,1);
    assert.equal([...llms.matchAll(new RegExp('https://example\\.test'+url.replaceAll('/','\\/')+'>','g'))].length,1);
    assert.doesNotMatch(sitemap+llms,/_map|\.toml/);
    assert.equal(fs.existsSync(path.join(output,prefix,'library/references/_map.toml')),false);
    assert.equal(fs.existsSync(path.join(output,prefix,'library/references/item/index.html')),false,'References never create duplicate article pages.');
  }
  assert.deepEqual((await inspectSitemap(output)).issues,[]);
  assert.deepEqual((await inspectLlms(output)).issues,[]);
});

test('reference validation rejects malformed, ambiguous, redundant and missing targets',()=>{
  const file=path.join(source,'content/library/references/_map.toml'),original=fs.readFileSync(file,'utf8');
  const cases=[
    ['refs = [',/unmarshal|parse|toml/i],
    ['other = []\n',/refs/i],
    ['refs = []\nother = []\n',/refs|key/i],
    ['refs = "/library/original/item"\n',/refs/i],
    ['refs = [1]\n',/refs|path|string/i],
    ['refs = []\nrefs = []\n',/toml|duplicate|defined/i],
    [refs(['library/original/item']),/absolute content path/i],
    [refs(['https://example.test/library/original/item/']),/absolute content path/i],
    [refs(['/library/original/item#anchor']),/absolute content path/i],
    [refs(['/library/original/item','/library/original/item/']),/duplicate/i],
    [refs(['/library/original']),/regular article/i],
    [refs(['/library/missing']),/cannot resolve/i]
  ];
  try {
    for(const [value,message] of cases) {
      write(file,value);const result=build(source,path.join(work,'invalid'));
      assert.notEqual(result.status,0,value+' unexpectedly built');
      assert.match(result.stdout+result.stderr,/_map\.toml/);assert.match(result.stdout+result.stderr,message,value);
    }
    write(file,original);
    write(path.join(source,'content/library/original/_map.toml'),refs(['/library/original/item']));
    const result=build(source,path.join(work,'invalid'));
    assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/physical child/i);
    fs.rmSync(path.join(source,'content/library/original/_map.toml'));
    write(path.join(source,'content/library/original/collision/index.md'),article('Collision','url: p/item/'));
    const collision=build(source,path.join(work,'collision'));
    assert.notEqual(collision.status,0);assert.match(collision.stdout+collision.stderr,/Duplicate target paths/i,'Two real pages with one canonical URL must fail.');
  } finally {
    write(file,original);fs.rmSync(path.join(source,'content/library/original/_map.toml'),{force:true});
    fs.rmSync(path.join(source,'content/library/original/collision'),{recursive:true,force:true});
  }
});

test('native taxonomy configuration keeps Hugo RSS members when the site supplies its list layouts',()=>{
  const file=path.join(source,'hugo.toml'),original=fs.readFileSync(file,'utf8');
  const articles=locales.map(([suffix])=>path.join(source,'content/library/original/item/index'+suffix+'.md'));
  const originals=articles.map(file=>fs.readFileSync(file,'utf8'));
  const layout='{{ define "main" }}<h1>{{ .Title }}</h1><ul>{{ range .Pages }}<li><a href="{{ .RelPermalink }}">{{ .Title }}</a></li>{{ end }}</ul>{{ end }}';
  const destination=path.join(work,'native-taxonomy');
  try {
    write(path.join(source,'layouts/taxonomy.html'),layout);
    write(path.join(source,'layouts/term.html'),layout);
    write(file,original
      .replace('[taxonomies]\n','[taxonomies]\nauthor="authors"\n')
      .replace('page=["HTML"]','page=["HTML"]\ntaxonomy=["HTML","RSS"]\nterm=["HTML","RSS"]'));
    for(const [index,file] of articles.entries())write(file,originals[index].replace('date:','authors: [Alex]\ndate:'));
    passed(build(source,destination));
    for(const [,prefix] of locales) {
      assert.ok(read(prefix+'/authors/','index.html',destination).includes(prefix+'/authors/alex/'));
      const name=prefix==='/zh'?'translated-item':'item';
      assert.ok(read(prefix+'/authors/alex/','index.html',destination).includes(prefix+'/p/'+name+'/'));
      assert.deepEqual([...read(prefix+'/authors/','index.xml',destination).matchAll(/<guid>([^<]+)<\/guid>/g)].map(match=>match[1]),
        ['https://example.test'+prefix+'/authors/alex/']);
      assert.deepEqual([...read(prefix+'/authors/alex/','index.xml',destination).matchAll(/<guid>([^<]+)<\/guid>/g)].map(match=>match[1]),
        ['https://example.test'+prefix+'/p/'+name+'/']);
    }
  } finally {
    write(file,original);
    for(const [index,file] of articles.entries())write(file,originals[index]);
    for(const name of ['taxonomy','term'])fs.rmSync(path.join(source,'layouts',name+'.html'),{force:true});
  }
});

test('shared refs omit missing translations and permit explicit empty reference lists',()=>{
  const file=path.join(source,'content/library/references/_map.toml'),original=fs.readFileSync(file,'utf8');
  write(path.join(source,'content/library/original/en-only/index.md'),article('English only'));
  try {
    write(file,refs(['/library/original/en-only']));passed(build(source,path.join(work,'translations')));
    for(const [,prefix] of locales) {
      const contract=JSON.parse(read(prefix,'directory.json',path.join(work,'translations')));
      assert.equal((contract.direct['/library/references']||[]).length,prefix?0:1,'Do not link another language as an invented translation.');
    }
    write(file,'refs = []\n');passed(build(source,path.join(work,'empty')));
    assert.deepEqual(JSON.parse(read('','directory.json',path.join(work,'empty'))).direct['/library/references']||[],[]);
  } finally {write(file,original);fs.rmSync(path.join(source,'content/library/original/en-only'),{recursive:true,force:true});}
});

test('local sections retain refs and map resources require a visible ordinary directory owner',async()=>{
  const local=path.join(source,'content/library/local');
  try {
    for(const [suffix] of locales)write(path.join(local,'_index'+suffix+'.md'),directoryPage('Local','build: {list: local, publishResources: false}'));
    write(path.join(local,'_map.toml'),refs(['/library/original/item']));
    passed(build(source,path.join(work,'local')));
    for(const [,prefix] of locales) {
      const index=JSON.parse(read(prefix,'directory.json',path.join(work,'local')));
      assert.deepEqual(index.direct['/library/local'].map(item=>item.path),['/library/original/item']);
      assert.equal(fs.existsSync(path.join(work,'local',prefix,'library/local/_map.toml')),false);
      const html=read(prefix+'/p/'+(prefix==='/zh'?'translated-item':'item')+'/','index.html',path.join(work,'local'));
      assert.ok(sources(html).some(item=>item.logicalPath==='/library/local/'),'A local directory remains an available article source.');
      assert.ok(html.includes('data-directory-reference="/library/local"')||html.includes('data-directory-reference=/library/local'),'A local directory remains in article metadata.');
    }
    const server=await createStaticSiteServer(path.join(work,'local')),chromium=loadChromium();let browser;
    try {
      await server.start();browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
      const page=await browser.newPage({serviceWorkers:'block'});
      await gotoAndWait(page,server.getBaseUrl()+'/p/item/#from=library/local');
      assert.equal(await page.locator('[data-breadcrumb-collection-href="/library/local/"] [aria-current="page"]').count(),1,'A local source restores its referenced article during navigation.');
    } finally {await browser?.close();await server.stop();}
    const faults=[
      ['content/library/orphan/_map.toml',refs(['/library/original/item']),/_index\.md in the same directory/i],
      ['content/library/original/item/_map.toml',refs(['/library/original/second']),/_index\.md in the same directory/i],
      ['content/library/never/_index.md',directoryPage('Never','build: {list: never}'),null]
    ];
    for(const [name,value,message] of faults) {
      const file=path.join(source,name);write(file,value);
      if(!message){write(path.join(path.dirname(file),'_map.toml'),refs(['/library/original/item']));}
      try {
        const result=build(source,path.join(work,'owner-fault'));
        assert.notEqual(result.status,0,name+' must fail');
        assert.match(result.stdout+result.stderr,message||/build\.list.*never.*local/i);
      } finally {
        fs.rmSync(file,{force:true});
        if(!message)fs.rmSync(path.dirname(file),{recursive:true,force:true});
      }
    }
    for(const [name,fields] of [['legacy',''],['never-legacy','build: {list: never}']]) {
      const directory=path.join(source,'content/library',name);
      write(path.join(directory,'_index.md'),directoryPage('Legacy '+name,fields));
      write(path.join(directory,'_map.yaml'),'refs:\n  - /library/original/item\n');
      try {
        const result=build(source,path.join(work,'legacy-fault'));
        assert.notEqual(result.status,0,'Unsupported relation-file extensions must fail.');
        assert.match(result.stdout+result.stderr,/_map\.toml/,'The error must name the supported relation file.');
      } finally {fs.rmSync(directory,{recursive:true,force:true});}
    }
  } finally {fs.rmSync(local,{recursive:true,force:true});}
});

test('non-rendered and placeholder articles do not enter directory counts or feeds',()=>{
  const directory=path.join(source,'content/library/filter');
  const hidden={never:'build: {render: never}',link:'build: {render: link}',json:'outputs: [JSON]',placeholder:'translation_placeholder: true'};
  try {
    write(path.join(source,'layouts/page-article.json.json'),'{}');
    for(const [suffix] of locales) {
      write(path.join(directory,'_index'+suffix+'.md'),directoryPage('Filter'));
      for(const [name,fields] of Object.entries({visible:'',...hidden}))
        write(path.join(directory,name,'index'+suffix+'.md'),article(name,'url: p/'+name+'/\n'+fields));
    }
    const destination=path.join(work,'filter');passed(build(source,destination));
    for(const [,prefix] of locales) {
      const index=JSON.parse(read(prefix,'directory.json',destination));
      assert.deepEqual(index.direct['/library/filter'].map(item=>item.path),['/library/filter/visible']);
      for(const route of ['', '/library/filter/']) {
        const rss=read(prefix+route,'index.xml',destination);
        assert.ok(rss.includes('https://example.test'+prefix+'/p/visible/'));
        for(const name of Object.keys(hidden))assert.ok(!rss.includes('https://example.test'+prefix+'/p/'+name+'/'),route+' must omit '+name);
      }
    }
  } finally {
    fs.rmSync(directory,{recursive:true,force:true});
    fs.rmSync(path.join(source,'layouts/page-article.json.json'),{force:true});
  }
});

test('non-rendered reference directories do not become article metadata or navigation sources',()=>{
  const owners={hidden:'build: {render: never}',linked:'build: {render: link}',json:'outputs: [JSON]',placeholder:'translation_placeholder: true'};
  try {
    write(path.join(source,'layouts/page-collection.json.json'),'{}');
    for(const [name,fields] of Object.entries(owners)) {
      const directory=path.join(source,'content/library/owner-'+name);
      const safeFields=fields.replace('render: never','render: never, publishResources: false').replace('render: link','render: link, publishResources: false');
      for(const [suffix] of locales)write(path.join(directory,'_index'+suffix+'.md'),directoryPage('Owner '+name,safeFields));
      write(path.join(directory,'_map.toml'),refs(['/library/original/item']));
    }
    const destination=path.join(work,'owners');passed(build(source,destination));
    for(const [,prefix] of locales) {
      const html=read(prefix+'/p/'+(prefix==='/zh'?'translated-item':'item')+'/','index.html',destination);
      const paths=sources(html).map(item=>item.logicalPath);
      for(const name of Object.keys(owners)) {
        assert.ok(!paths.includes('/library/owner-'+name+'/'),'Hidden owners must not appear as navigation sources.');
        assert.ok(!html.includes('data-directory-reference="/library/owner-'+name+'"')&&!html.includes('data-directory-reference=/library/owner-'+name+'>'),'Hidden owners must not appear in article metadata.');
      }
    }
  } finally {
    for(const name of Object.keys(owners))fs.rmSync(path.join(source,'content/library/owner-'+name),{recursive:true,force:true});
    fs.rmSync(path.join(source,'layouts/page-collection.json.json'),{force:true});
  }
});

test('explicit article URLs survive moves to a new root and reject conflicting URLs',()=>{
  const originalDirectory=path.join(source,'content/library/original/item'),movedDirectory=path.join(source,'content/notes/moved/item');
  const maps=['references','references/nested','second'].map(name=>path.join(source,'content/library',name,'_map.toml'));
  const originals=maps.map(file=>fs.readFileSync(file,'utf8'));
  try {
    const before=path.join(work,'flat-before');passed(build(source,before));
    for(const [,prefix] of locales)assert.ok(read(prefix+'/p/'+(prefix==='/zh'?'translated-item':'item')+'/','index.html',before).includes('Shared'));
    for(const [suffix] of locales) {
      write(path.join(source,'content/notes/_index'+suffix+'.md'),directoryPage('Notes'));
      write(path.join(source,'content/notes/moved/_index'+suffix+'.md'),directoryPage('Moved'));
    }
    assert.ok(originalDirectory.startsWith(source+path.sep)&&movedDirectory.startsWith(source+path.sep));
    fs.renameSync(originalDirectory,movedDirectory);
    for(const [index,file] of maps.entries())write(file,originals[index].replaceAll('/library/original/item','/notes/moved/item'));
    const after=path.join(work,'flat-after');passed(build(source,after));
    for(const [,prefix] of locales) {
      const url=prefix+'/p/'+(prefix==='/zh'?'translated-item':'item')+'/';
      assert.ok(read(url,'index.html',after).includes('Shared'));
      assert.ok(read(prefix+'/library/references/','index.html',after).includes(url+'#from=library/references'));
      assert.ok(read(prefix+'/library/references/','index.xml',after).includes('https://example.test'+url));
    }
    write(path.join(source,'content/library/other-intro/index.md'),article('Introduction','url: p/item/'));
    const collision=build(source,path.join(work,'flat-collision'));
    assert.notEqual(collision.status,0);assert.match(collision.stdout+collision.stderr,/Duplicate target paths/i);
    write(path.join(source,'content/library/other-intro/index.md'),article('Introduction','url: p/item-2/'));
    passed(build(source,path.join(work,'flat-disambiguated')));
  } finally {
    if(fs.existsSync(movedDirectory))fs.renameSync(movedDirectory,originalDirectory);
    for(const [index,file] of maps.entries())write(file,originals[index]);
    fs.rmSync(path.join(source,'content/notes'),{recursive:true,force:true});
    fs.rmSync(path.join(source,'content/library/other-intro'),{recursive:true,force:true});
  }
});

test('native output checks catch unlisted pages and retain Hugo alias precedence',()=>{
  const directory=path.join(source,'content/native-url-probe'),file=path.join(directory,'index.md');
  try {
    for(const list of ['local','never']) {
      write(file,article('Native collision','url: p/item/\nlayout: page-article\nbuild: {list: '+list+'}'));
      const result=build(source,path.join(work,'native-collision-'+list));
      assert.notEqual(result.status,0);
      assert.match(result.stdout+result.stderr,/Duplicate target paths/i);
    }
    for(const render of ['never','link']) {
      write(file,article('Unrendered URL','url: p/item/\nlayout: page-article\nbuild: {list: local, render: '+render+'}'));
      passed(build(source,path.join(work,'native-unrendered-'+render)));
    }
    write(file,article('Native alias','url: p/native-alias/\nlayout: page-article\naliases: ["/p/item/"]\nbuild: {list: local}'));
    const destination=path.join(work,'native-alias');passed(build(source,destination));
    assert.ok(read('p/item','index.html',destination).includes('Shared'),'The real page keeps precedence over an alias.');
    assert.doesNotMatch(read('p/item','index.html',destination),/http-equiv=.?refresh/i);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('aggregate feeds share unique articles and hidden-directory fallbacks omit non-HTML pages',()=>{
  const aggregate=path.join(source,'content/library/feed-aggregate'),hidden=path.join(source,'content/library/not-listed');
  try {
    write(path.join(aggregate,'_index.md'),directoryPage('Aggregate','aggregate: /library/references'));
    write(path.join(hidden,'_index.md'),directoryPage('Not listed','build: {list: never, publishResources: false}'));
    write(path.join(hidden,'visible/index.md'),article('Fallback visible','build: {list: local}'));
    write(path.join(hidden,'linked/index.md'),article('Fallback linked','url: p/linked/\nbuild: {list: local, render: link}'));
    write(path.join(hidden,'json/index.md'),article('Fallback JSON','url: p/json/\nbuild: {list: local}\noutputs: [JSON]'));
    write(path.join(source,'layouts/page-article.json.json'),'{}');
    const destination=path.join(work,'feed-members');passed(build(source,destination));
    const feed=read('/library/feed-aggregate/','index.xml',destination);
    const guids=[...feed.matchAll(/<guid>([^<]+)<\/guid>/g)].map(match=>match[1]);
    assert.equal(guids.length,2);assert.equal(new Set(guids).size,2);
    const aggregateHtml=extractBlocks(stripRawText(read('/library/feed-aggregate/','index.html',destination)),'main')[0].inner;
    for(const guid of guids)assert.ok(aggregateHtml.includes(new URL(guid).pathname));
    const hiddenHtml=extractBlocks(stripRawText(read('/library/not-listed/','index.html',destination)),'main')[0].inner;
    assert.ok(hiddenHtml.includes('/p/fallback/'));
    assert.ok(!hiddenHtml.includes('/p/linked/'));
    assert.ok(!hiddenHtml.includes('/p/json/'));
    const hiddenFeed=read('/library/not-listed/','index.xml',destination);
    assert.equal([...hiddenFeed.matchAll(/<guid>/g)].length,1);
    assert.ok(hiddenFeed.includes('/p/fallback/'));
  } finally {
    for(const directory of [aggregate,hidden])fs.rmSync(directory,{recursive:true,force:true});
    fs.rmSync(path.join(source,'layouts/page-article.json.json'),{force:true});
  }
});

test('dotted and Unicode references retain encoded source URLs on a site subpath',()=>{
  const config=path.join(source,'hugo.toml'),original=fs.readFileSync(config,'utf8');
  const directory=path.join(source,'content/library/special');
  try {
    write(config,original.replace('https://example.test/','https://example.test/base/'));
    write(path.join(source,'content/library/node.js/index.md'),article('Dotted node','url: p/dotted-node/'));
    write(path.join(source,'content/library/中文/index.md'),article('Unicode article','url: p/unicode-article/'));
    write(path.join(directory,'_index.md'),directoryPage('Special','url: /topics/A&B/'));
    write(path.join(directory,'_map.toml'),refs(['/library/node.js','/library/中文']));
    const destination=path.join(work,'special-paths');passed(build(source,destination));
    const html=extractBlocks(stripRawText(read('/topics/A&B/','index.html',destination)),'main')[0].inner;
    const links=[...html.matchAll(/<a\b[^>]*>/g)].map(match=>decodeHtmlAttribute(extractTagAttribute(match[0],'href'))).filter(href=>href.includes('#from='));
    assert.equal(links.length,2);
    for(const href of links){assert.ok(href.startsWith('/base/'));assert.equal(readFieldValue(new URL(href,'https://example.test'),'from'),'topics/A&B');}
    write(path.join(directory,'_map.toml'),refs(['/library/node.js/index.md']));
    const invalid=build(source,path.join(work,'file-reference'));
    assert.notEqual(invalid.status,0);assert.match(invalid.stdout+invalid.stderr,/logical content path|cannot resolve/i);
  } finally {
    write(config,original);
    for(const name of ['special','node.js','中文'])fs.rmSync(path.join(source,'content/library',name),{recursive:true,force:true});
  }
});

test('reference directories follow resource publishing and identify unlisted ancestors consistently',()=>{
  const directory=path.join(source,'content/library/resource-policy'),hidden=path.join(source,'content/library/hidden-parent'),
    resourceOnly=path.join(source,'content/library/resource-only');
  try {
    write(path.join(directory,'_map.toml'),refs(['/library/original/item']));
    write(path.join(directory,'attachment.txt'),'Ordinary bundle resource.');
    for(const fields of ['build: {list: local}','build: {list: local, publishResources: true}']) {
      write(path.join(directory,'_index.md'),directoryPage('Resource policy',fields));
      const published=path.join(work,'resource-policy');passed(build(source,published));
      assert.equal(read('library/resource-policy','_map.toml',published),refs(['/library/original/item']));
      assert.equal(read('library/resource-policy','attachment.txt',published),'Ordinary bundle resource.');
      const members=JSON.parse(read('','directory.json',published));
      assert.deepEqual(members.direct['/library/resource-policy'].map(page=>page.path),['/library/original/item']);
    }
    write(path.join(directory,'_index.md'),directoryPage('Resource policy','build: {list: local, publishResources: false}'));
    passed(build(source,path.join(work,'safe-resources')));
    assert.equal(fs.existsSync(path.join(work,'safe-resources/library/resource-policy/_map.toml')),false);
    assert.equal(fs.existsSync(path.join(work,'safe-resources/library/resource-policy/attachment.txt')),false);
    for(const name of ['index.md','_index.md']) {
      write(path.join(resourceOnly,name),article('Resource only','url: native-resources/\nbuild: {list: never, render: never, publishResources: true}'));
      write(path.join(resourceOnly,'_map.toml'),refs(['/library/original/item']));
      write(path.join(resourceOnly,'attachment.txt'),'Unlisted bundle resource.');
      const published=path.join(work,'resource-only');passed(build(source,published));
      assert.equal(read('native-resources','_map.toml',published),refs(['/library/original/item']));
      assert.equal(read('native-resources','attachment.txt',published),'Unlisted bundle resource.');
      assert.equal(fs.existsSync(path.join(published,'native-resources/index.html')),false);
      fs.rmSync(resourceOnly,{recursive:true,force:true});
    }
    write(path.join(hidden,'_index.md'),directoryPage('Hidden parent','build: {list: never, publishResources: false}'));
    write(path.join(hidden,'local/_index.md'),directoryPage('Local child','build: {list: local, publishResources: false}'));
    write(path.join(hidden,'local/_map.toml'),refs(['/library/original/item']));
    for(const populated of [false,true]) {
      if(populated)write(path.join(hidden,'local/physical.md'),article('Physical child'));
      const result=build(source,path.join(work,'hidden-parent'));
      assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/hidden-parent has build\.list: never/);
    }
    fs.rmSync(path.join(hidden,'local/physical.md'));
    write(path.join(hidden,'_index.md'),directoryPage('Local parent','build: {list: local, publishResources: false}'));
    passed(build(source,path.join(work,'local-parent')));
    write(path.join(hidden,'_index.md'),directoryPage('Unrendered parent','build: {list: local, render: never, publishResources: false}'));
    const unrendered=path.join(work,'unrendered-parent');passed(build(source,unrendered));
    const members=JSON.parse(read('','directory.json',unrendered));
    assert.deepEqual(members.direct['/library/hidden-parent/local'].map(page=>page.path),['/library/original/item']);
  } finally {
    for(const folder of [directory,hidden,resourceOnly])fs.rmSync(folder,{recursive:true,force:true});
  }
});

test('preview rebuilds invalidate refs and target URLs; renamed section trees survive restart',async()=>{
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base='http://127.0.0.1:'+port,file=path.join(source,'content/library/second/_map.toml');
  const original=fs.readFileSync(file,'utf8'),target=path.join(source,'content/library/original/item/index.md'),originalTarget=fs.readFileSync(target,'utf8');
  let logs='';
  function start() {
    const server=spawn(toolExecutable('hugo'),['server','--noBuildLock','--enableGitInfo=false','--disableLiveReload','--disableFastRender','--bind','127.0.0.1','--port',String(port),'--baseURL',base,'--destination',path.join(work,'preview')],
      {cwd:source,env:fixtureEnvironment(work),windowsHide:true,stdio:['ignore','pipe','pipe']});
    server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});return server;
  }
  let server=start();
  async function stop() {if(server.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill();await exited;}}
  async function until(check) {
    const deadline=Date.now()+15000;let last;
    while(Date.now()<deadline) {
      assert.equal(server.exitCode,null,logs);
      try {if(await check()){await delay(600);if(await check())return;}} catch(error) {last=error;}
      await delay(100);
    }
    assert.fail('Directory rebuild timed out. '+(last||'')+'\n'+JSON.stringify(await state().catch(()=>null))+'\n'+logs);
  }
  async function state() {const response=await fetch(base+'/directory.json',{signal:AbortSignal.timeout(1000),headers:{Connection:'close'}});assert.equal(response.status,200);return response.json();}
  async function text(route) {const response=await fetch(base+route,{signal:AbortSignal.timeout(1000),headers:{Connection:'close'}});assert.equal(response.status,200,route);return response.text();}
  try {
    await until(async()=>((await state()).direct['/library/second']||[]).some(item=>item.path==='/library/original/item'));
    write(file,refs(['/library/original/second']));
    await until(async()=>{const items=(await state()).direct['/library/second']||[];return items.length===1&&items[0].path==='/library/original/second';});
    const main=extractBlocks(stripRawText(await text('/library/second/')),'main')[0].inner;
    assert.ok(main.includes('/p/second/#from=library/second'));
    assert.ok(!main.includes('/p/item/'));
    const feed=await text('/library/second/index.xml');
    assert.ok(feed.includes('/p/second/'));assert.ok(!feed.includes('/p/item/'));
    assert.doesNotMatch(await text('/p/item/'),/data-directory-reference=(?:"\/library\/second"|\/library\/second(?:\s|>))/);
    fs.unlinkSync(file);await until(async()=>((await state()).direct['/library/second']||[]).length===0);
    write(file,original);await until(async()=>((await state()).direct['/library/second']||[]).some(item=>item.path==='/library/original/item'));
    write(target,originalTarget.replace('url: p/item/','url: p/renamed-item/'));
    await until(async()=>((await state()).direct['/library/second']||[]).some(item=>item.url==='/p/renamed-item/'));
    for(const route of ['/en/sitemap.xml','/llms.txt']) {
      const content=await text(route);assert.ok(content.includes(base+'/p/renamed-item/'));
      assert.ok(!content.includes(base+'/p/item/'),'Discovery outputs must remove the old canonical URL.');
    }
    // Hugo 0.157 on Windows needs a restart to discover a renamed section tree.
    await stop();fs.renameSync(path.join(source,'content/library/second'),path.join(source,'content/library/renamed'));server=start();
    await until(async()=>{const index=await state();return !index.direct['/library/second']&&(index.incoming['/library/original/item']||[]).some(item=>item.path==='/library/renamed');});
    fs.rmSync(path.join(source,'content/library/renamed'),{recursive:true,force:true});
    await until(async()=>!(await state()).incoming['/library/original/item']?.some(item=>item.path==='/library/renamed'));
  } finally {
    await stop();
    write(target,originalTarget);
  }
});
