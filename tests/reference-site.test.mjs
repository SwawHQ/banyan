import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {verifyCspOutput} from '../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {inspect as inspectSitemap} from '../.agents/skills/swaw-banyan/tasks/check/sitemap/inspect.mjs';
import {inspect as inspectBuildVersion} from '../.agents/skills/swaw-banyan/tasks/check/build-version/inspect.mjs';
import {inspect as inspectLlms} from '../.agents/skills/swaw-banyan/tasks/check/llms/inspect.mjs';
import {inspect as inspectDelivery} from '../.agents/skills/swaw-banyan/tasks/check/delivery/inspect.mjs';
import {inspect as inspectScripts} from '../.agents/skills/swaw-banyan/tasks/check/html/scripts/inspect.mjs';
import {extractStartTags,extractTagAttribute,extractCanonicalHref} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {extractBlocks,stripRawText} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {filesUnder} from '../.agents/skills/swaw-banyan/tasks/_shared/output.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),origin='https://banyan.swaw.com';
let work,output;
before(()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/reference-site-tests');
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));
  output=path.join(work,'build');
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
});
after(()=>{if(work){assert.equal(path.basename(path.dirname(fs.realpathSync(work))),'reference-site-tests');fs.rmSync(work,{recursive:true,force:true});}});

test('functional articles keep their shortcode scripts without article metadata, chapters or BlogPosting',async()=>{
  assert.deepEqual((await inspectScripts(output)).issues,[]);
  for(const prefix of ['','zh/','zh-tw/'])for(const [route,family] of [['powered-by','updates/page'],['_res/offline','pages/offline']]) {
    const html=fs.readFileSync(path.join(output,prefix,route,'index.html'),'utf8');
    const scripts=extractStartTags(html,'script').map(tag=>extractTagAttribute(tag,'src')||'');
    assert.equal(scripts.filter(src=>src.includes('/js/'+family+'.')).length,1,prefix+route+' loads its controller once.');
    assert.doesNotMatch(html,/document-meta|document-toc|document-aside-toggle|"@type"\s*:\s*"BlogPosting"/);
  }
});

test('the reference site owns its images, manifest and robots templates',()=>{
  for(const relative of ['assets/site/favicon.ico','assets/site/favicon.link.svg','assets/site/icon-180.png','assets/site/icon-192.png',
    'assets/site/icon-256.png','assets/site/icon-512.png',
    'assets/site/icon-1200.png','assets/site/manifest.webmanifest.tmpl','assets/site/robots.txt.tmpl']) {
    assert.ok(fs.existsSync(path.join(root,relative)),'Site identity file: '+relative);
    assert.equal(fs.existsSync(path.join(root,'module',relative)),false,'Identity stays outside the Module: '+relative);
  }
  const home=fs.readFileSync(path.join(output,'index.html'),'utf8');
  const manifest=extractStartTags(home,'link').find(tag=>extractTagAttribute(tag,'rel')==='manifest');
  const manifestHref=extractTagAttribute(manifest||'','href');
  assert.match(manifestHref,/^\/site\/site\.[a-f0-9]{64}\.webmanifest$/);
  assert.ok(fs.existsSync(path.join(output,manifestHref)));
  assert.deepEqual(fs.readFileSync(path.join(output,'favicon.ico')),fs.readFileSync(path.join(root,'assets/site/favicon.ico')));
  assert.equal(fs.existsSync(path.join(output,'favicon.svg')),false);
  assert.equal(fs.existsSync(path.join(root,'static')),false);
  const icon=extractStartTags(home,'link').find(tag=>extractTagAttribute(tag,'rel')==='icon');
  assert.match(extractTagAttribute(icon,'href'),/^\/site\/favicon\.link\.[a-f0-9]{64}\.svg$/);
});

test('the reference site owns its delivery data, icons and interface translations',()=>{
  for(const relative of ['assets/site/delivery.toml','assets/site/icons.toml','assets/i18n/en.toml','assets/i18n/zh.toml','assets/i18n/zh-tw.toml']) {
    assert.ok(fs.existsSync(path.join(root,relative)),'Site-owned file: '+relative);
    assert.equal(fs.existsSync(path.join(root,'module',relative)),false,'Configuration stays outside the Module: '+relative);
  }
  assert.equal(fs.existsSync(path.join(root,'data')),false);
  assert.equal(fs.existsSync(path.join(root,'i18n')),false);
  assert.equal(fs.existsSync(path.join(output,'i18n')),false,'Interface dictionaries are not published as assets');
  assert.deepEqual(fs.readdirSync(path.join(output,'site')).filter(file=>/\.(?:toml|ya?ml)$/.test(file)),[],
    'Configuration sources stay unpublished, including fingerprinted copies');
});

test('the reference site owns its columns and keeps documentation on Swaw',async()=>{
  assert.equal(fs.existsSync(path.join(root,'module/content')),false,'All site content stays outside the Module');
  for(const name of ['my','_res/offline','rss','powered-by'])for(const suffix of ['','.zh','.zh-tw'])
    assert.ok(fs.existsSync(path.join(root,'content',name,'index'+suffix+'.md')),'Reference page: '+name+suffix);
  for(const name of ['appearance','language'])for(const suffix of ['','.zh','.zh-tw']) {
    assert.ok(fs.existsSync(path.join(root,'content',name,'_index'+suffix+'.md')),'Reference section: '+name+suffix);
    assert.equal(fs.existsSync(path.join(root,'content',name,'index'+suffix+'.md')),false,'Settings have one section source.');
  }
  assert.equal(fs.existsSync(path.join(root,'content/_res/debug/index.md')),false,'Diagnostics belong to Powered by.');
  for(const name of ['offline','powered-by.debug'])assert.equal(fs.existsSync(path.join(root,'content',name)),false,'Resource sources use the shared branch.');
  assert.equal(fs.existsSync(path.join(root,'content/discover/docs')),false);
  assert.equal(fs.existsSync(path.join(root,'content/changelog')),false);
  for(const prefix of ['','zh/','zh-tw/']) {
    const home=fs.readFileSync(path.join(output,prefix,'index.html'),'utf8');
    const roots=extractStartTags(home,'a').map(tag=>extractTagAttribute(tag,'data-root-href')).filter(Boolean);
    for(const name of ['articles','articles-all','products','products-all','about']) {
      const pathname='/'+prefix+name+'/';
      const html=fs.readFileSync(path.join(output,pathname,'index.html'),'utf8');
      assert.equal(extractCanonicalHref(html),origin+pathname);
      assert.ok(roots.includes(pathname),'Direct child pages appear without an opt-in field: '+pathname);
    }
    assert.ok(roots.includes('/'+prefix),'The homepage remains a root entry.');
    for(const pathname of roots)assert.ok(!pathname.includes('/_res/'),'Resource pages stay out of root navigation.');
    assert.equal(fs.existsSync(path.join(output,prefix,'_res/index.html')),false,'The resource branch has no landing page.');
    assert.equal(fs.existsSync(path.join(output,prefix,'offline/index.html')),false,'The old offline URL has no output.');
    assert.equal(fs.existsSync(path.join(output,prefix,'powered-by.debug/index.html')),false,'The old diagnostic URL has no output.');
    assert.equal(fs.existsSync(path.join(output,prefix,'_res/powered-by.debug/index.html')),false,'The renamed diagnostic URL has no output.');
    assert.equal(fs.existsSync(path.join(output,prefix,'_res/debug/index.html')),false,'Diagnostics have no standalone output.');
    const offlinePath='/'+prefix+'_res/offline/';
    const offline=fs.readFileSync(path.join(output,offlinePath,'index.html'),'utf8');
    assert.equal(extractCanonicalHref(offline),origin+offlinePath);
    assert.ok(extractStartTags(offline,'meta').some(tag=>extractTagAttribute(tag,'name')==='robots'&&extractTagAttribute(tag,'content')==='noindex, follow'));
    assert.equal(extractBlocks(offline,'aside').length,0,'Resource pages do not inherit the document sidebar.');
    assert.equal(extractBlocks(offline,'nav',tag=>extractTagAttribute(tag,'data-slot')==='breadcrumb').length,0,'Resource pages do not inherit path columns.');
    for(const file of [path.join(output,prefix||'en/','sitemap.xml'),path.join(output,prefix,'llms.txt')])
      assert.ok(!fs.readFileSync(file,'utf8').includes('/_res/'),'Resource pages stay out of discovery outputs.');
    assert.equal(roots.includes('/'+prefix+'github/'),false,'No standalone GitHub entry.');
    for(const name of ['notes','notes-all','discover','all','catalog','catalog-all','changelog','github'])
      assert.equal(fs.existsSync(path.join(output,prefix,name)),false,'No retired or unconfigured column is published: '+name);
    assert.ok(extractStartTags(home,'a').some(tag=>extractTagAttribute(tag,'href').startsWith('https://swaw.com/')&&extractTagAttribute(tag,'href').includes('/d/banyan/docs/')));
  }
  assert.deepEqual((await inspectSitemap(output)).issues,[]);
  assert.deepEqual((await inspectLlms(output)).issues,[]);
  assert.deepEqual((await inspectDelivery(output)).issues,[]);
  verifyCspOutput(output);
});

test('settings sections use choice controls without article collection capabilities',()=>{
  for(const prefix of ['','zh/','zh-tw/'])for(const name of ['language','appearance']) {
    const pathname='/'+prefix+name+'/',html=fs.readFileSync(path.join(output,prefix,name,'index.html'),'utf8');
    const main=extractBlocks(html,'main')[0].inner,body=extractStartTags(html,'body')[0];
    assert.equal(extractCanonicalHref(html),origin+pathname);
    assert.equal(fs.existsSync(path.join(output,prefix,name,'index.xml')),false,'Settings publish HTML without RSS.');
    assert.ok(extractStartTags(main,'div').some(tag=>extractTagAttribute(tag,'data-list-view')==='choice'));
    assert.doesNotMatch(main,/\bdata-sortable\b/,'Choices keep their declared order.');
    assert.doesNotMatch(html,/\/js\/browse\/collection-sort\./,'Choices do not load article sorting.');
    assert.deepEqual(JSON.parse(extractTagAttribute(body,'data-page-collection-source')),{});
    assert.deepEqual(JSON.parse(extractTagAttribute(body,'data-entry-breadcrumb-sources')),[]);
    const schemas=extractBlocks(html,'script',tag=>extractTagAttribute(tag,'type')==='application/ld+json').map(block=>JSON.parse(block.inner));
    assert.ok(schemas.every(schema=>!['ItemList','BlogPosting'].includes(schema['@type'])),'Choices do not publish article collection schema.');
    const links=extractStartTags(main,'a'),back=links.filter(tag=>extractTagAttribute(tag,'data-page-action')==='back');
    assert.equal(back.length,1);assert.equal(extractTagAttribute(back[0],'href'),'/'+prefix);
    if(name==='language') {
      const choices=links.filter(tag=>extractTagAttribute(tag,'data-language-choice'));
      assert.deepEqual(choices.map(tag=>extractTagAttribute(tag,'data-language-choice')),['en','zh','zh-tw']);
      assert.deepEqual(choices.map(tag=>extractTagAttribute(tag,'href')),['/language/','/zh/language/','/zh-tw/language/']);
      assert.deepEqual(choices.filter(tag=>extractTagAttribute(tag,'aria-current')==='page').map(tag=>extractTagAttribute(tag,'data-language-choice')),[prefix?prefix.slice(0,-1):'en']);
    } else {
      const choices=extractStartTags(main,'button').filter(tag=>extractTagAttribute(tag,'data-theme-choice'));
      assert.deepEqual(choices.map(tag=>extractTagAttribute(tag,'data-theme-choice')),['auto','light','dark']);
      assert.ok(choices.every(tag=>extractTagAttribute(tag,'type')==='button'&&extractTagAttribute(tag,'aria-pressed')==='false'));
      assert.ok(links.every(tag=>!extractTagAttribute(tag,'data-theme-choice')),'Theme actions use buttons.');
    }
  }
});

test('one translated article supplies the article and product lists through one shared reference',async()=>{
  const files=await filesUnder(path.join(root,'content'));
  const maps=files.filter(file=>path.basename(file)==='_map.toml');
  assert.deepEqual(maps.map(file=>path.relative(root,file).replaceAll('\\','/')),['content/products/examples/_map.toml']);
  assert.equal(fs.readFileSync(maps[0],'utf8').trim(),'refs = ["/articles/category1/example"]');
  const articleFiles=files.filter(file=>file.startsWith(path.join(root,'content/articles')+path.sep)
    &&/\.md$/.test(file)&&!/^_index(?:\.|$)/.test(path.basename(file)));
  assert.deepEqual(articleFiles.map(file=>path.relative(root,file).replaceAll('\\','/')).sort(),
    ['content/articles/category1/example/index.md','content/articles/category1/example/index.zh-tw.md','content/articles/category1/example/index.zh.md']);
  for(const prefix of ['','zh/','zh-tw/']) {
    const href='/'+prefix+'p/example-product/';
    for(const [directory,variant] of [['articles/category1','section'],['articles-all','all'],['products/examples','products'],['products-all','products']]) {
      const html=fs.readFileSync(path.join(output,prefix,directory,'index.html'),'utf8');
      const main=extractBlocks(html,'main')[0].inner;
      const entries=extractStartTags(main,'a').filter(tag=>/\bdata-list-entry(?:\s|=|>)/.test(tag));
      assert.equal(entries.length,1,directory+' has one article');
      assert.equal(extractTagAttribute(entries[0],'href').split('#')[0],href);
      assert.match(main,new RegExp('data-sort-variant=["\']?'+variant+'\\b'));
    }
    const article=fs.readFileSync(path.join(output,prefix,'p/example-product/index.html'),'utf8');
    assert.equal(extractCanonicalHref(article),origin+href);
    assert.ok(article.includes('/'+prefix+'products/examples/'),'Article metadata exposes its reference directory');
    const llms=fs.readFileSync(path.join(output,prefix,'llms.txt'),'utf8');
    const entry='](<'+origin+href+'>)';
    assert.equal(llms.split(entry).length-1,2,'LLMS retains the article and product groups.');
    for(const directory of ['articles/category1','products/examples']) {
      const group=llms.split(/^## /m).find(text=>text.includes('](<'+origin+'/'+prefix+directory+'/>)'));
      assert.equal(group?.split(entry).length-1,1,directory+' lists the article once.');
    }
    for(const directory of ['articles','articles-all','products','products-all']) {
      const feed=fs.readFileSync(path.join(output,prefix,directory,'index.xml'),'utf8');
      assert.equal((feed.match(/<item>/g)||[]).length,1,directory+' RSS has one article');
      assert.ok(feed.includes(origin+href));
    }
    assert.equal(fs.existsSync(path.join(output,prefix,'p/example-note')),false);
    assert.equal(fs.existsSync(path.join(output,prefix,'products/examples/_map.toml')),false);
  }
});

test('production discovery uses the official origin in sitemap, RSS and robots',()=>{
  for(const file of ['sitemap.xml','en/sitemap.xml','zh/sitemap.xml','index.xml','zh/index.xml','robots.txt','llms.txt']) {
    const text=fs.readFileSync(path.join(output,file),'utf8');
    assert.ok(text.includes(origin),file+' must use the official origin');
    assert.doesNotMatch(text,/https?:\/\/localhost:1313/,file+' must not publish preview URLs');
  }
  for(const prefix of ['','zh/','zh-tw/']) {
    const feed=fs.readFileSync(path.join(output,prefix,'index.xml'),'utf8');
    const sitemap=fs.readFileSync(path.join(output,prefix||'en/','sitemap.xml'),'utf8');
    const llms=fs.readFileSync(path.join(output,prefix,'llms.txt'),'utf8');
    const home=fs.readFileSync(path.join(output,prefix,'index.html'),'utf8');
    for(const name of ['about','rss']) {
      const href='/'+prefix+name+'/',url=origin+href;
      assert.ok(fs.existsSync(path.join(output,prefix,name,'index.html')),'Information pages keep their HTML.');
      assert.ok(!feed.includes('<guid>'+url+'</guid>'),'Information pages stay out of RSS.');
      assert.ok(sitemap.includes(url)&&llms.includes(url),'Plain articles retain discovery.');
      assert.ok(extractStartTags(home,'a').some(tag=>extractTagAttribute(tag,'data-root-href')===href),'Plain articles retain root navigation.');
    }
  }
});

test('Powered by contains translated diagnostics and same-language test links',()=>{
  assert.equal(fs.existsSync(path.join(output,'prefetchdebug')),false);
  for(const prefix of ['','zh/','zh-tw/']) {
    const html=fs.readFileSync(path.join(output,prefix,'powered-by/index.html'),'utf8');
    const language=prefix?prefix.slice(0,-1):'en';
    assert.equal(extractCanonicalHref(html),origin+'/'+prefix+'powered-by/');
    assert.equal(extractTagAttribute(extractStartTags(html,'html')[0],'lang'),language);
    assert.match(extractStartTags(html,'body')[0],/\bdata-prefetch-debug(?:\s|=|>)/);
    const main=extractBlocks(html,'main')[0].html;
    assert.equal(extractBlocks(main,'article').length,1,'Diagnostics use the page article.');
    assert.ok(extractStartTags(main,'article').every(tag=>!extractTagAttribute(tag,'lang')||extractTagAttribute(tag,'lang')===language));
    assert.equal(extractStartTags(html,'form').filter(tag=>extractTagAttribute(tag,'id')==='prefetch-debug-controls').length,1);
    const disclosure=extractBlocks(main,'details').filter(block=>extractStartTags(block.html,'form').some(tag=>extractTagAttribute(tag,'id')==='prefetch-debug-controls'));
    assert.equal(disclosure.length,1,'One disclosure contains the diagnostic controls.');
    assert.doesNotMatch(disclosure[0].open,/\sopen(?:\s|=|>)/,'Diagnostics start collapsed.');
    const summary=extractBlocks(disclosure[0].html,'summary');
    assert.equal(summary.length,1,'The diagnostic disclosure has one native toggle.');
    assert.ok(summary[0].inner.trim(),'The toggle has visible text.');
    if(prefix)assert.match(summary[0].inner,/[\u3400-\u9fff]/,'The toggle follows the page language.');
    for(const key of ['support','env','actions','runtime','payload'])
      assert.equal(extractStartTags(disclosure[0].html,'pre').filter(tag=>extractTagAttribute(tag,'id')==='prefetch-debug-'+key).length,1,'One collapsed diagnostic panel: '+key);
    const links=extractStartTags(html,'a').filter(tag=>extractTagAttribute(tag,'data-prefetch-test-link'));
    assert.deepEqual(links.map(tag=>extractTagAttribute(tag,'data-prefetch-test-link')),['collection','article']);
    for(const link of links) {
      const href=extractTagAttribute(link,'href');
      assert.ok(href.startsWith('/'+prefix),'Diagnostic targets retain the page language: '+href);
      if(!prefix)assert.doesNotMatch(href,/^\/(?:zh|zh-tw)\//);
      assert.ok(fs.existsSync(path.join(output,new URL(href,origin).pathname,'index.html')));
    }
    const collectionPath=new URL(extractTagAttribute(links[0],'href'),origin).pathname;
    assert.match(extractBlocks(fs.readFileSync(path.join(output,collectionPath,'index.html'),'utf8'),'main')[0].inner,/data-sortable=(?:"true"|true)/);
    const panel=extractBlocks(html,'div',tag=>tag.includes('data-site-update-panel'))[0];
    assert.equal(panel.html.includes('data-pwa-controlled'),false,'Page control state belongs to diagnostics');
    const diagnostics=extractBlocks(html,'h2',tag=>extractTagAttribute(tag,'id')==='diagnostics')[0];
    assert.ok(diagnostics.index>=panel.index+panel.html.length,'Diagnostics follow the complete PWA panel');
    assert.equal(panel.html.includes('prefetch-debug-controls'),false,'The update panel does not own diagnostics');
    if(prefix)assert.doesNotMatch(main,/Prefetch transport|Browser support|Selected backend|Loading\.\.\./,'Diagnostic copy follows the current language.');
    const external=extractStartTags(main,'a').filter(tag=>extractTagAttribute(tag,'href').startsWith('https://'));
    assert.deepEqual(external.map(tag=>extractTagAttribute(tag,'href')),['https://github.com/SwawHQ/banyan',
      'https://swaw.com/'+(prefix==='zh/'?'zh/':'')+'d/banyan/changelog/','https://gohugo.io/','https://gohugo.io/news/']);
    for(const link of external) {
      assert.equal(extractTagAttribute(link,'target'),'_blank');
      assert.equal(extractTagAttribute(link,'rel'),'noopener noreferrer');
    }
    assert.match(html,/<meta property="og:type" content="article">/);
    assert.equal(fs.existsSync(path.join(output,prefix,'powered-by/index.xml')),false);
  }
});

test('Powered by build section shows only the matching content version',async()=>{
  for(const prefix of ['','zh/','zh-tw/']) {
    const html=fs.readFileSync(path.join(output,prefix,'powered-by/index.html'),'utf8');
    const times=extractStartTags(html,'time').filter(tag=>tag.includes('data-site-update-version'));
    assert.equal(times.length,1);
    const version=extractTagAttribute(times[0],'title');
    assert.match(version,/^v\d{14}$/);
    assert.match(extractTagAttribute(times[0],'datetime'),/^\d{4}-\d{2}-\d{2}T/);
    const source=stripRawText(html),visible=source.replace(/<[^>]*>/g,'');
    assert.deepEqual(visible.match(/v\d{14}/g),[version]);
    const headings=extractBlocks(source,'h2');
    const heading=headings.find(block=>extractTagAttribute(block.open,'id')==='build');
    const next=headings.find(block=>block.index>heading.index);
    const section=source.slice(heading.index+heading.html.length,next.index);
    assert.equal(section.replace(/<[^>]*>/g,'').trim(),version);
  }
  assert.deepEqual((await inspectBuildVersion(output)).issues,[]);
});
