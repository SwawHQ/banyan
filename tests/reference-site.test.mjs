import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {fixtureEnvironment,fixtureSiteMounts} from './_shared/hugo.mjs';
import {verifyCspOutput} from '../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {inspect as inspectSitemap} from '../.agents/skills/swaw-banyan/tasks/check/sitemap/inspect.mjs';
import {inspect as inspectBuildVersion} from '../.agents/skills/swaw-banyan/tasks/check/build-version/inspect.mjs';
import {inspect as inspectLlms} from '../.agents/skills/swaw-banyan/tasks/check/llms/inspect.mjs';
import {inspect as inspectDelivery} from '../.agents/skills/swaw-banyan/tasks/check/delivery/inspect.mjs';
import {inspect as inspectScripts} from '../.agents/skills/swaw-banyan/tasks/check/html/scripts/inspect.mjs';
import {extractStartTags,extractTagAttribute,extractCanonicalHref} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {extractBlocks,stripRawText} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {filesUnder,localReference} from '../.agents/skills/swaw-banyan/tasks/_shared/output.mjs';
import {parseToml,parseYaml} from '../.agents/skills/swaw-banyan/tasks/_shared/parsers.mjs';
import {readPages} from '../.agents/skills/swaw-banyan/tasks/_shared/html/read.mjs';
import {inspectInternalLinks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/links.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),origin='https://banyan.swaw.com';
const languages=['en','zh','ar'],prefixes=['','zh/','ar/'],suffixes=['','.zh','.ar'];
let work,output,documentation;
before(async()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/reference-site-tests');
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));
  output=path.join(work,'build');
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  documentation=[];
  for(const branch of ['docs','changelog'])for(const file of await filesUnder(path.join(root,'content/articles',branch))) {
    if(!file.endsWith('.md'))continue;
    const source=path.relative(root,file).replaceAll('\\','/'),section=path.basename(file).startsWith('_index');
    const fields=parseYaml(fs.readFileSync(file,'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
    const language=file.endsWith('.zh.md')?'zh':'en';
    const route=section?path.posix.dirname(source).slice('content/'.length)+'/':fields.url;
    assert.ok(route,'Documentation articles declare their public URL: '+source);
    documentation.push({source,section,language,fields,href:'/'+(language==='zh'?'zh/':'')+route});
  }
});
after(()=>{if(work){assert.equal(path.basename(path.dirname(fs.realpathSync(work))),'reference-site-tests');fs.rmSync(work,{recursive:true,force:true});}});

test('functional pages keep their shortcode scripts without article metadata, chapters or BlogPosting',async()=>{
  assert.deepEqual((await inspectScripts(output)).issues,[]);
  for(const prefix of prefixes)for(const [route,family] of [['powered-by','updates/page'],['_res/offline','pages/offline']]) {
    const html=fs.readFileSync(path.join(output,prefix,route,'index.html'),'utf8');
    const scripts=extractStartTags(html,'script').map(tag=>extractTagAttribute(tag,'src')||'');
    assert.equal(scripts.filter(src=>src.includes('/js/'+family+'.')).length,1,prefix+route+' loads its controller once.');
    assert.doesNotMatch(html,/document-meta|document-toc|document-aside-toggle|"@type"\s*:\s*"BlogPosting"/);
    if(route==='_res/offline') {
      assert.deepEqual(scripts.filter(Boolean),scripts.filter(src=>src.includes('/js/pages/offline.')),
        'The standalone offline layout loads only its retry controller.');
      assert.doesNotMatch(html,/\bdata-navigation=|\bdata-prefetch|site-prefetch|speculationrules/);
      assert.equal(extractBlocks(html,'nav').length,0,'The offline layout has no navigation columns.');
    }
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
  assert.deepEqual(Object.keys(parseToml(fs.readFileSync(path.join(root,'hugo.toml'),'utf8')).languages),languages);
  assert.deepEqual(fs.readdirSync(path.join(root,'assets/i18n')).sort(),languages.map(language=>language+'.toml').sort());
  for(const relative of ['assets/site/delivery.toml','assets/site/icons.toml',...languages.map(language=>'assets/i18n/'+language+'.toml')]) {
    assert.ok(fs.existsSync(path.join(root,relative)),'Site-owned file: '+relative);
    assert.equal(fs.existsSync(path.join(root,'module',relative)),false,'Configuration stays outside the Module: '+relative);
  }
  assert.equal(fs.existsSync(path.join(root,'data')),false);
  assert.equal(fs.existsSync(path.join(root,'i18n')),false);
  assert.equal(fs.existsSync(path.join(output,'i18n')),false,'Interface dictionaries are not published as assets');
  assert.deepEqual(fs.readdirSync(path.join(output,'site')).filter(file=>/\.(?:toml|ya?ml)$/.test(file)),[],
    'Configuration sources stay unpublished, including fingerprinted copies');
  const english=parseToml(fs.readFileSync(path.join(root,'assets/i18n/en.toml'),'utf8'));
  for(const language of languages) {
    const dictionary=parseToml(fs.readFileSync(path.join(root,'assets/i18n',language+'.toml'),'utf8'));
    assert.deepEqual(Object.keys(dictionary).sort(),Object.keys(english).sort(),language+' has every interface key');
    assert.ok(Object.keys(dictionary).every(key=>!/^((list|products)_sort_.+_(asc|desc)|products_col_name)$/.test(key)),
      'Sort fields share the two action templates and one name label.');
    for(const [key,value] of Object.entries(dictionary)) {
      assert.ok(value.other?.trim(),language+': '+key+' has display text');
      if(language==='ar')assert.match(value.other,/[\u0600-\u06ff]/,key+' has Arabic display text');
    }
    const html=fs.readFileSync(path.join(output,prefixes[languages.indexOf(language)],'p/example-product/index.html'),'utf8');
    const body=extractStartTags(html,'body')[0],copy=JSON.parse(extractTagAttribute(body,'data-collection-sort-copy'));
    assert.deepEqual(Object.keys(copy.actions).sort(),['asc','desc'],'Sort actions use two translated templates.');
    for(const order of ['asc','desc']) {
      assert.equal(copy.actions[order],dictionary['list_sort_'+order].other);
      assert.ok(copy.actions[order].includes('{field}'),'Sort templates must retain their field placeholder.');
    }
    for(const route of ['articles','articles/category1','articles-all','products/examples','products-all']) {
      const page=fs.readFileSync(path.join(output,prefixes[languages.indexOf(language)],route,'index.html'),'utf8');
      const shared=JSON.parse(extractTagAttribute(extractStartTags(page,'body')[0],'data-collection-sort-copy'));
      assert.deepEqual(shared,copy,'Main and path columns share one translated copy, including root collections.');
      const controls=extractStartTags(page,'a').filter(tag=>extractTagAttribute(tag,'data-sort-control')==='true');
      assert.equal(controls.length,3);
      for(const tag of controls) {
        const field=extractTagAttribute(tag,'data-sort-field'),initial=extractTagAttribute(tag,'data-sort-default-order');
        const order=extractTagAttribute(tag,'data-sort-active')==='true'?(initial==='asc'?'desc':'asc'):initial;
        const expected=shared.actions[order].replaceAll('{field}',()=>shared.fields[field]);
        assert.equal(extractTagAttribute(tag,'title'),expected,'SSR keeps the current translated action tooltip.');
        assert.equal(extractTagAttribute(tag,'aria-label'),expected,'SSR keeps the current translated accessible action.');
        assert.equal(extractTagAttribute(tag,'data-sort-title-asc'),'');
        assert.equal(extractTagAttribute(tag,'data-sort-title-desc'),'');
      }
    }
  }
});

test('the reference site owns its columns and links to its local documentation',async()=>{
  assert.equal(fs.existsSync(path.join(root,'module/content')),false,'All site content stays outside the Module');
  for(const name of ['my','_res/offline','rss','powered-by'])for(const suffix of suffixes)
    assert.ok(fs.existsSync(path.join(root,'content',name,'index'+suffix+'.md')),'Reference page: '+name+suffix);
  for(const name of ['appearance','language'])for(const suffix of suffixes) {
    assert.ok(fs.existsSync(path.join(root,'content',name,'_index'+suffix+'.md')),'Reference section: '+name+suffix);
    assert.equal(fs.existsSync(path.join(root,'content',name,'index'+suffix+'.md')),false,'Settings have one section source.');
  }
  assert.equal(fs.existsSync(path.join(root,'content/_res/debug/index.md')),false,'Diagnostics belong to Powered by.');
  for(const name of ['offline','powered-by.debug'])assert.equal(fs.existsSync(path.join(root,'content',name)),false,'Resource sources use the shared branch.');
  assert.equal(fs.existsSync(path.join(root,'content/discover/docs')),false);
  assert.equal(fs.existsSync(path.join(root,'content/changelog')),false);
  for(const prefix of prefixes) {
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
    const docs=(prefix==='zh/'?'/zh/':'/')+'articles/docs/';
    assert.ok(extractStartTags(home,'a').some(tag=>extractTagAttribute(tag,'href')===docs),'Home links to the available documentation language.');
    assert.ok(fs.existsSync(path.join(output,docs,'index.html')));
  }
  assert.deepEqual((await inspectSitemap(output)).issues,[]);
  assert.deepEqual((await inspectLlms(output)).issues,[]);
  assert.deepEqual((await inspectDelivery(output)).issues,[]);
  verifyCspOutput(output);
});

test('documentation and release notes publish article dates, sources and feeds',()=>{
  assert.ok(documentation.some(page=>page.href==='/zh/p/getting-started/'));
  assert.ok(documentation.some(page=>page.href==='/p/unreleased/'));
  assert.deepEqual([...new Set(documentation.map(page=>page.language))].sort(),['en','zh']);
  for(const page of documentation) {
    const html=fs.readFileSync(path.join(output,page.href,'index.html'),'utf8');
    assert.equal(extractCanonicalHref(html),origin+page.href,page.source);
    assert.equal(extractTagAttribute(extractStartTags(html,'html')[0],'lang'),page.language,page.source);
    if(page.section) {
      const feed=fs.readFileSync(path.join(output,page.href,'index.xml'),'utf8');
      const sourceDirectory=path.posix.dirname(page.source)+'/';
      const expected=documentation.filter(article=>!article.section&&article.language===page.language
        &&article.source.startsWith(sourceDirectory)).map(article=>origin+article.href).sort();
      assert.deepEqual([...feed.matchAll(/<guid>([^<]+)<\/guid>/g)].map(match=>match[1]).sort(),expected,page.source+' publishes its article feed.');
      continue;
    }
    assert.ok(page.fields.date&&page.fields.lastmod,page.source+' declares publication and update dates.');
    const dates=extractStartTags(html,'time').map(tag=>extractTagAttribute(tag,'datetime'));
    assert.equal(dates.length,2,page.source+' displays both article dates.');
    assert.deepEqual(dates.map(value=>value.slice(0,10)),[page.fields.lastmod,page.fields.date].map(value=>String(value).slice(0,10)),page.source);
    const hasHeadings=extractStartTags(extractBlocks(html,'main')[0].inner).some(tag=>/^<h[23]\b/.test(tag));
    assert.equal(extractStartTags(html,'nav').some(tag=>extractTagAttribute(tag,'class').split(/\s+/).includes('document-toc')),hasHeadings,page.source+' shows chapters for its headings.');
    assert.match(html,/"@type"\s*:\s*"BlogPosting"/,page.source);
    assert.equal(html.match(/"dateModified"\s*:\s*"([^"]+)"/)?.[1],dates[0],page.source);
    assert.equal(html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1],dates[1],page.source);
    const sitemap=fs.readFileSync(path.join(output,page.language,'sitemap.xml'),'utf8');
    const entry=sitemap.match(/<url>[\s\S]*?<\/url>/g).find(value=>value.includes('<loc>'+origin+page.href+'</loc>'));
    assert.equal(Date.parse(entry?.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]),Date.parse(dates[0]),page.source+' publishes its update date in the sitemap.');
    const resources=extractBlocks(html,'nav',tag=>extractTagAttribute(tag,'class').split(/\s+/).includes('document-meta__row--resources'));
    assert.equal(resources.length,1,page.source+' has article source information.');
    const links=extractStartTags(resources[0].html,'a').map(tag=>extractTagAttribute(tag,'href'));
    assert.ok(links.includes('https://github.com/SwawHQ/banyan/blob/main/'+page.source),page.source+' links to its actual Banyan source.');
  }
  for(const prefix of prefixes) {
    const language=prefix?prefix.slice(0,-1):'en';
    const feed=fs.readFileSync(path.join(output,prefix,'index.xml'),'utf8');
    const expected=['/'+prefix+'p/example-product/',...documentation.filter(page=>
      !page.section&&page.language===language).map(page=>page.href)];
    assert.deepEqual([...feed.matchAll(/<guid>([^<]+)<\/guid>/g)].map(match=>match[1]).sort(),
      expected.map(href=>origin+href).sort(),'Root RSS includes documentation and release notes.');
    for(const item of feed.matchAll(/<item>([\s\S]*?)<\/item>/g))
      assert.ok(Number.isFinite(Date.parse(item[1].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1])),'Every RSS article has a valid publication date.');
    assert.equal(fs.existsSync(path.join(output,prefix,'articles/changelog/index.xml')),['en','zh'].includes(language),'Release notes publish a feed in each available language.');
    assert.equal(fs.existsSync(path.join(output,prefix,'articles/docs/index.html')),['en','zh'].includes(language),'Documentation exists only in its available languages.');
  }
});

test('published internal links and anchors resolve without retired Swaw documentation URLs',async()=>{
  const {pages}=await readPages(output),files=(await filesUnder(output)).map(file=>path.relative(output,file).replaceAll('\\','/'));
  assert.deepEqual(inspectInternalLinks(pages,{siteURL:origin+'/',files}),[]);
  for(const page of pages)for(const tag of extractStartTags(stripRawText(page.text),'a'))
    assert.doesNotMatch(extractTagAttribute(tag,'href'),/^https:\/\/swaw\.com\/(?:zh\/)?d\/banyan\/(?:docs|changelog)\//,page.relativePath);
});

test('content links resolve pages and attachments across deployment and language prefixes',async()=>{
  const content=path.join(work,'link-content'),assets=path.join(work,'link-assets'),config=path.join(work,'links.toml');
  fs.mkdirSync(path.join(content,'link-probe'),{recursive:true});fs.mkdirSync(assets,{recursive:true});
  fs.writeFileSync(path.join(content,'link-target.md'),'---\ntitle: Link target\nurl: p/link-target/\nlayout: page-article-norss\n---\nTarget.');
  fs.writeFileSync(path.join(content,'link-probe/manual.pdf'),'Bundle attachment.');
  fs.writeFileSync(path.join(content,'link-probe/100%.pdf'),'Percent attachment.');
  fs.writeFileSync(path.join(assets,'link-global.txt'),'Global attachment.');
  fs.writeFileSync(path.join(assets,'global100%.txt'),'Global percent attachment.');
  for(const [index,basePath] of ['','base/','a%20b/','a%25b/'].entries())for(const inSubdir of [false,true]) {
    const siteURL='https://example.test/'+basePath,baseHref='/'+basePath,defaultPrefix=inSubdir?'en/':'';
    const pageHref=baseHref+defaultPrefix+'p/link-probe/',build=path.join(work,'links-build-'+index+'-'+inSubdir);
    const cases=[
      ['root','/zh/p/getting-started/?a=1&b=2#安装前',baseHref+'zh/p/getting-started/?a=1&b=2#安装前'],
      ['prefixed',baseHref+'zh/p/getting-started/'],['home','/',baseHref+defaultPrefix],
      ['encoded','/zh/p/a%20b/',baseHref+'zh/p/a%20b/'],['unsafe','javascript:alert(1)','#ZgotmplZ'],
      ['encoded-delimiters','/zh/p/a%23b%3Fc/?a=1#local',baseHref+'zh/p/a%23b%3Fc/?a=1#local'],
      ['https','https://example.org/guide/?a=1&b=2#local'],['network','//example.org/link-target/'],
      ['percent-https','https://example.org/100%.pdf','https://example.org/100%25.pdf'],
      ['mail','mailto:user@example.org'],['anchor','#local',pageHref+'#local'],['query','?a=1&b=2'],
      ['relative','../getting-started/#安装前'],['page','../link-target.md?a=1&b=2#target',baseHref+defaultPrefix+'p/link-target/?a=1&b=2#target'],
      ['empty-query','../link-target.md?',baseHref+defaultPrefix+'p/link-target/?'],['empty-anchor','../link-target.md#',baseHref+defaultPrefix+'p/link-target/#'],
      ['encoded-anchor','#a%3Db',pageHref+'#a%3Db'],['state','#from=products%26tools&anchor=a%3Db',pageHref+'#from=products%26tools&anchor=a%3Db'],
      ['percent-anchor','#100%',pageHref+'#100%25'],['percent-query','?value=100%','?value=100%25'],
      ['percent-page','../link-target.md#100%',baseHref+defaultPrefix+'p/link-target/#100%25'],
      ['page-state','../link-target.md#from=products%26tools&anchor=a%3Db',baseHref+defaultPrefix+'p/link-target/#from=products%26tools&anchor=a%3Db'],
      ['bundle','manual.pdf',pageHref+'manual.pdf'],['global','link-global.txt',baseHref+'link-global.txt']
    ];
    const attachments=[
      ['percent-bundle','100%.pdf','Percent attachment.'],
      ['encoded-percent-bundle','100%25.pdf','Percent attachment.'],
      ['percent-alias','percent-download','Percent attachment.'],
      ['percent-global','global100%.txt','Global percent attachment.']
    ];
    fs.writeFileSync(path.join(content,'link-probe/index.md'),
      '---\ntitle: Link probe\nurl: p/link-probe/\nlayout: page-article-norss\n'+
      'build: {publishResources: false}\nresources:\n  - src: "100%.pdf"\n    name: percent-download\n---\n\n## Local\n\n'+
      [...cases,...attachments].map(([name,href])=>'[**MD '+name+'**]('+href+' "A & B")\n\n'+
        '{{< new-tab href='+JSON.stringify(href)+' >}}Tab '+name+'{{< /new-tab >}}').join('\n\n')+
      '\n\n[MD empty]()\n\nBefore[Word](../link-target.md)After.');
    fs.writeFileSync(config,'defaultContentLanguageInSubdir = '+inSubdir+'\n[[module.mounts]]\nsource = '+JSON.stringify(assets.replaceAll('\\','/'))+
      '\ntarget = "assets"\n'+fixtureSiteMounts+'\n[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+
      '\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n');
    const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,
      '--baseURL',siteURL,'--destination',build],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
    const {pages}=await readPages(build),files=(await filesUnder(build)).map(file=>path.relative(build,file).replaceAll('\\','/'));
    if(!basePath)assert.deepEqual((await inspectDelivery(build)).issues,[]);
    const targets=new Set([...prefixes.flatMap(prefix=>[(prefix||defaultPrefix)+'index.html',(prefix||defaultPrefix)+'powered-by/index.html']),
      ...documentation.map(page=>(page.language==='en'?defaultPrefix:'')+page.href.slice(1)+'index.html')]);
    assert.deepEqual(inspectInternalLinks(pages.filter(page=>targets.has(page.relativePath)),{siteURL,files}),[]);
    for(const page of pages.filter(page=>targets.has(page.relativePath))) {
      const navigation=JSON.parse(extractTagAttribute(extractStartTags(page.text,'body')[0],'data-navigation'));
      for(const href of [navigation.home,navigation.resources].filter(Boolean))
        assert.ok(new URL(href,siteURL).pathname.startsWith(new URL(siteURL).pathname),'Navigation data must retain the encoded deployment prefix: '+href);
      for(const tag of extractStartTags(page.text,'a').filter(tag=>extractTagAttribute(tag,'data-root-href')))
        assert.equal(new URL(extractTagAttribute(tag,'data-root-href'),siteURL).pathname,
          new URL(extractTagAttribute(tag,'href'),siteURL).pathname,'Root selection data must match its native link.');
    }
    assert.equal(fs.readFileSync(path.join(build,defaultPrefix,'p/link-probe/manual.pdf'),'utf8'),'Bundle attachment.');
    assert.equal(fs.readFileSync(path.join(build,defaultPrefix,'p/link-probe/100%.pdf'),'utf8'),'Percent attachment.');
    assert.equal(fs.readFileSync(path.join(build,'link-global.txt'),'utf8'),'Global attachment.');
    const probe=fs.readFileSync(path.join(build,defaultPrefix,'p/link-probe/index.html'),'utf8');
    assert.match(probe,/Before<a\b[^>]*>Word<\/a>After\./,'Inline links must not insert whitespace into the text.');
    const links=new Map(extractBlocks(probe,'a').map(block=>[block.inner.replace(/<[^>]*>/g,'').trim(),block]));
    assert.ok(links.has('MD empty'),'An empty href retains its visible link text.');
    assert.equal(extractTagAttribute(links.get('MD empty').open,'href'),'');
    for(const [name,href,expected=href] of cases) {
      const markdown=links.get('MD '+name),tab=links.get('Tab '+name);
      for(const [link,value] of [[markdown,expected],[tab,href.startsWith('#')?expected.slice(pageHref.length):expected]])
        assert.equal(decodeURI(extractTagAttribute(link.open,'href')),decodeURI(value),name);
      assert.equal(extractTagAttribute(markdown.open,'title'),'A & B');
      assert.ok(markdown.inner.includes('<strong>'),'Markdown link emphasis is retained.');
      assert.equal(extractTagAttribute(tab.open,'target'),'_blank');
      assert.equal(extractTagAttribute(tab.open,'rel'),'noopener noreferrer');
    }
    for(const [name,,text] of attachments)for(const kind of ['MD','Tab']) {
      const href=extractTagAttribute(links.get(kind+' '+name).open,'href');
      assert.equal(fs.readFileSync(path.join(build,localReference(href,{siteURL})),'utf8'),text,
        kind+' '+name+' links to its published attachment.');
    }
  }
});

test('Arabic pages use RTL and demonstrate mixed text without losing translations',async()=>{
  const contentFiles=await filesUnder(path.join(root,'content'));
  const english=contentFiles.filter(file=>{
    const source=path.relative(root,file).replaceAll('\\','/');
    return /(?:^|[\\/])(?:_index|index)\.md$/.test(file)
      &&!['content/_res/_index.md','content/_res/home-art/_index.md'].includes(source)
      &&!/^content\/articles\/(?:docs|changelog)\//.test(source);
  });
  for(const file of english)assert.ok(fs.existsSync(file.replace(/\.md$/,'.ar.md')),'Arabic counterpart: '+file);
  for(const [index,prefix] of prefixes.entries())for(const route of ['', 'language/', 'appearance/', 'articles-all/', 'p/example-product/', '_res/offline/', '404.html']) {
    const html=fs.readFileSync(path.join(output,prefix,route.endsWith('.html')?route:route+'index.html'),'utf8');
    const tag=extractStartTags(html,'html')[0];
    assert.equal(extractTagAttribute(tag,'lang'),languages[index]);
    assert.equal(extractTagAttribute(tag,'dir'),prefix==='ar/'?'rtl':'ltr');
    if(prefix==='ar/') {
      const main=extractBlocks(html,'main')[0].inner;
      assert.match(main,/[\u0600-\u06ff]/,route+' contains Arabic text');
      assert.match(extractBlocks(html,'a',tag=>extractTagAttribute(tag,'class')==='skip-link')[0].inner,/[\u0600-\u06ff]/);
    }
  }
  const article=fs.readFileSync(path.join(output,'ar/p/example-product/index.html'),'utf8');
  const main=extractBlocks(article,'main')[0].inner;
  for(const tag of ['ul','ol','blockquote','table','pre','code'])assert.ok(extractBlocks(main,tag).length,'Arabic example includes '+tag);
  for(const value of ['Banyan','Hugo','v1.2.3','2026-10-28','19.95 USD','article-123.md','١٢٣'])assert.ok(main.includes(value),'Mixed text retains '+value);
  assert.ok(main.includes('https://example.com/docs/?lang=ar&amp;version=2'));
  assert.ok(extractStartTags(article,'link').some(tag=>extractTagAttribute(tag,'hreflang')==='en'));
  const home=fs.readFileSync(path.join(output,'ar/index.html'),'utf8');
  const signals=extractStartTags(home,'a').filter(tag=>/\bdata-page-home-signal(?:\s|=|>)/.test(tag));
  assert.equal(signals.length,6);
  assert.ok(signals.slice(0,4).every(tag=>extractTagAttribute(tag,'href').startsWith('/ar/')));
});

test('settings sections use choice controls without article collection capabilities',()=>{
  for(const prefix of prefixes)for(const name of ['language','appearance']) {
    const pathname='/'+prefix+name+'/',html=fs.readFileSync(path.join(output,prefix,name,'index.html'),'utf8');
    const main=extractBlocks(html,'main')[0].inner,body=extractStartTags(html,'body')[0];
    assert.equal(extractCanonicalHref(html),origin+pathname);
    assert.equal(fs.existsSync(path.join(output,prefix,name,'index.xml')),false,'Settings publish HTML without RSS.');
    assert.ok(extractStartTags(main,'div').some(tag=>extractTagAttribute(tag,'data-list-view')==='choice'));
    assert.doesNotMatch(main,/\bdata-sortable\b/,'Choices keep their declared order.');
    assert.doesNotMatch(html,/\/js\/browse\/collection-sort\./,'Choices do not load article sorting.');
    assert.equal(extractTagAttribute(body,'data-collection-path'),'');
    assert.deepEqual(JSON.parse(extractTagAttribute(body,'data-navigation')).columns,{});
    const schemas=extractBlocks(html,'script',tag=>extractTagAttribute(tag,'type')==='application/ld+json').map(block=>JSON.parse(block.inner));
    assert.ok(schemas.every(schema=>!['ItemList','BlogPosting'].includes(schema['@type'])),'Choices do not publish article collection schema.');
    const links=extractStartTags(main,'a'),back=links.filter(tag=>extractTagAttribute(tag,'data-page-action')==='back');
    assert.equal(back.length,1);assert.equal(extractTagAttribute(back[0],'href'),'/'+prefix);
    if(name==='language') {
      const choices=links.filter(tag=>extractTagAttribute(tag,'data-language-choice'));
      assert.deepEqual(choices.map(tag=>extractTagAttribute(tag,'data-language-choice')),languages);
      assert.deepEqual(choices.map(tag=>extractTagAttribute(tag,'href')),prefixes.map(prefix=>'/'+prefix+'language/'));
      assert.deepEqual(choices.filter(tag=>extractTagAttribute(tag,'aria-current')==='page').map(tag=>extractTagAttribute(tag,'data-language-choice')),[prefix?prefix.slice(0,-1):'en']);
    } else {
      const choices=extractStartTags(main,'button').filter(tag=>extractTagAttribute(tag,'data-theme-choice'));
      assert.deepEqual(choices.map(tag=>extractTagAttribute(tag,'data-theme-choice')),['auto','light','dark']);
      assert.ok(choices.every(tag=>extractTagAttribute(tag,'type')==='button'&&extractTagAttribute(tag,'aria-pressed')==='false'));
      assert.ok(links.every(tag=>!extractTagAttribute(tag,'data-theme-choice')),'Theme actions use buttons.');
    }
  }
});

test('the translated example supplies products while article lists also include documentation',async()=>{
  const files=await filesUnder(path.join(root,'content'));
  const maps=files.filter(file=>path.basename(file)==='_map.toml');
  assert.deepEqual(maps.map(file=>path.relative(root,file).replaceAll('\\','/')),['content/products/examples/_map.toml']);
  assert.equal(fs.readFileSync(maps[0],'utf8').trim(),'refs = ["/articles/category1/example"]');
  const articleFiles=files.filter(file=>file.startsWith(path.join(root,'content/articles')+path.sep)
    &&/\.md$/.test(file)&&!/^_index(?:\.|$)/.test(path.basename(file)));
  assert.deepEqual(articleFiles.map(file=>path.relative(root,file).replaceAll('\\','/')).sort(),
    [...suffixes.map(suffix=>'content/articles/category1/example/index'+suffix+'.md'),
      ...documentation.filter(page=>!page.section).map(page=>page.source)].sort());
  for(const prefix of prefixes) {
    const href='/'+prefix+'p/example-product/';
    const language=prefix?prefix.slice(0,-1):'en';
    const articles=documentation.filter(page=>!page.section&&page.language===language);
    for(const [directory,variant] of [['articles/category1','section'],['articles-all','all'],['products/examples','products'],['products-all','products']]) {
      const html=fs.readFileSync(path.join(output,prefix,directory,'index.html'),'utf8');
      const main=extractBlocks(html,'main')[0].inner;
      const entries=extractStartTags(main,'a').filter(tag=>/\bdata-list-entry(?:\s|=|>)/.test(tag));
      const expected=directory==='articles-all'?[href,...articles.map(page=>page.href)]:[href];
      assert.deepEqual(entries.map(tag=>extractTagAttribute(tag,'href').split('#')[0]).sort(),expected.sort(),directory+' keeps its own membership.');
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
      const expected=[href,...(directory.startsWith('articles')?articles.map(page=>page.href):[])];
      assert.deepEqual([...feed.matchAll(/<guid>([^<]+)<\/guid>/g)].map(match=>match[1]).sort(),
        expected.map(href=>origin+href).sort(),directory+' RSS keeps its article membership.');
    }
    assert.equal(fs.existsSync(path.join(output,prefix,'p/example-note')),false);
    assert.equal(fs.existsSync(path.join(output,prefix,'products/examples/_map.toml')),false);
  }
});

test('production discovery uses the official origin in sitemap, RSS and robots',()=>{
  for(const file of ['sitemap.xml','en/sitemap.xml','zh/sitemap.xml','ar/sitemap.xml','index.xml','zh/index.xml','ar/index.xml','robots.txt','llms.txt']) {
    const text=fs.readFileSync(path.join(output,file),'utf8');
    assert.ok(text.includes(origin),file+' must use the official origin');
    assert.doesNotMatch(text,/https?:\/\/localhost:1313/,file+' must not publish preview URLs');
  }
  for(const prefix of prefixes) {
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
  for(const prefix of prefixes) {
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
    if(prefix)assert.match(summary[0].inner,prefix==='ar/'?/[\u0600-\u06ff]/:/[\u3400-\u9fff]/,'The toggle follows the page language.');
    for(const key of ['support','env','actions','runtime','payload'])
      assert.equal(extractStartTags(disclosure[0].html,'pre').filter(tag=>extractTagAttribute(tag,'id')==='prefetch-debug-'+key).length,1,'One collapsed diagnostic panel: '+key);
    const links=extractStartTags(html,'a').filter(tag=>extractTagAttribute(tag,'data-prefetch-test-link'));
    assert.deepEqual(links.map(tag=>extractTagAttribute(tag,'data-prefetch-test-link')),['collection','article']);
    for(const link of links) {
      const href=extractTagAttribute(link,'href');
      assert.ok(href.startsWith('/'+prefix),'Diagnostic targets retain the page language: '+href);
      if(!prefix)assert.doesNotMatch(href,/^\/(?:zh|ar)\//);
      assert.ok(fs.existsSync(path.join(output,new URL(href,origin).pathname,'index.html')));
    }
    const collectionPath=new URL(extractTagAttribute(links[0],'href'),origin).pathname;
    assert.match(extractBlocks(fs.readFileSync(path.join(output,collectionPath,'index.html'),'utf8'),'main')[0].inner,/data-sortable=(?:"true"|true)/);
    const panel=extractBlocks(main,'span',tag=>tag.includes('data-site-update-panel'))[0];
    assert.equal(panel.html.includes('data-pwa-controlled'),false,'Page control state belongs to diagnostics');
    assert.ok(disclosure[0].index>=panel.index+panel.html.length,'Diagnostics follow the update controls');
    assert.ok(disclosure[0].html.includes('https://gohugo.io/news/'),'Hugo information belongs to collapsed diagnostics.');
    assert.match(disclosure[0].html,/<summary><strong>[^<]+<\/strong><\/summary>/,'Diagnostic emphasis belongs inside the summary.');
    assert.doesNotMatch(main,/<(?:p|strong)>\s*<details/,'Disclosure markup must not be wrapped in paragraph or emphasis tags.');
    assert.equal(panel.html.includes('prefetch-debug-controls'),false,'The update panel does not own diagnostics');
    if(prefix)assert.doesNotMatch(main,/Prefetch transport|Browser support|Selected backend|Loading\.\.\./,'Diagnostic copy follows the current language.');
    const external=extractStartTags(main,'a').filter(tag=>extractTagAttribute(tag,'href').startsWith('https://'));
    assert.deepEqual(external.map(tag=>extractTagAttribute(tag,'href')),['https://github.com/SwawHQ/banyan','https://gohugo.io/news/']);
    const changelog=(prefix==='zh/'?'/zh/':'/')+'articles/changelog/';
    assert.ok(extractStartTags(main,'a').some(tag=>extractTagAttribute(tag,'href')===changelog),'Theme version links to the local release notes.');
    assert.ok(fs.existsSync(path.join(output,changelog,'index.html')));
    assert.equal(extractBlocks(main,'h2').length,0,'The compact layout keeps technology links and the update panel above collapsed diagnostics.');
    for(const link of external) {
      assert.equal(extractTagAttribute(link,'target'),'_blank');
      assert.equal(extractTagAttribute(link,'rel'),'noopener noreferrer');
    }
    assert.match(html,/<meta property="og:type" content="article">/);
    assert.equal(fs.existsSync(path.join(output,prefix,'powered-by/index.xml')),false);
  }
});

test('Powered by Markdown separates build information and update controls',async()=>{
  for(const prefix of prefixes) {
    const html=fs.readFileSync(path.join(output,prefix,'powered-by/index.html'),'utf8');
    const times=extractStartTags(html,'time').filter(tag=>tag.includes('data-site-update-version'));
    assert.equal(times.length,1);
    const version=extractTagAttribute(times[0],'title');
    assert.match(version,/^v\d{14}$/);
    assert.match(extractTagAttribute(times[0],'datetime'),/^\d{4}-\d{2}-\d{2}T/);
    const source=stripRawText(html),visible=source.replace(/<[^>]*>/g,'');
    assert.deepEqual(visible.match(/v\d{14}/g),[version]);
    const panel=extractBlocks(html,'span',tag=>tag.includes('data-site-update-panel'))[0];
    const copy=JSON.parse(extractTagAttribute(panel.open,'data-site-update-copy'));
    for(const key of ['build','status','check'])assert.equal(key in copy,false,'Static text stays in Markdown.');
    const rows=extractBlocks(html,'p').flatMap(row=>row.inner.split(/<br\s*\/?>/i));
    const markers=['site-update-version','site-content-status','site-update-interval','site-sw-policy','site-offline-page','site-update-status'];
    const indexes=markers.map(marker=>rows.findIndex(row=>row.includes('data-'+marker)));
    assert.ok(indexes.every(index=>index>=0));
    assert.equal(new Set(indexes).size,6,'Each value has its own Markdown line.');
    for(const index of indexes) {
      assert.doesNotMatch(rows[index],/<code\b/,'Shortcodes do not add inline-code formatting.');
      assert.match(rows[index],/^<strong>[^<]+<\/strong>/,'Each information line keeps its emphasized Markdown label.');
    }
    const information=extractBlocks(html,'p').find(row=>row.inner.includes('data-site-update-version'));
    assert.ok(markers.every(marker=>information.inner.includes('data-'+marker)),'The six information lines stay adjacent.');
    for(const action of extractBlocks(information.inner,'button'))assert.equal(action.inner,copy.refresh_icon,'Refresh controls share the configured icon.');
    const contentRow=rows[indexes[1]],policyRow=rows[indexes[3]],offlineRow=rows[indexes[4]],statusRow=rows[indexes[5]];
    assert.ok(contentRow.includes('data-site-content-action'),'Server refresh stays on its own line.');
    assert.ok(statusRow.includes('data-site-update-action'),'Program refresh stays on its own line.');
    assert.ok(!policyRow.includes('<button'),'The policy link is static.');
    const offlineLink=extractStartTags(offlineRow,'a')[0],offlineUrl='/'+prefix+parseToml(fs.readFileSync(path.join(root,'assets/site/delivery.toml'),'utf8')).sw.offline_notice_path.replace(/^\/+|\/+$/g,'')+'/';
    assert.equal(extractTagAttribute(offlineLink,'href'),offlineUrl,'The offline link follows the language and delivery configuration.');
    assert.ok(fs.existsSync(path.join(output,offlineUrl,'index.html')),'The offline link targets a published page.');
    assert.ok(!offlineRow.includes('<button'),'The offline link is static.');
    const interval=extractBlocks(html,'span',tag=>tag.includes('data-site-update-interval'))[0];
    const enabled=fs.existsSync(path.join(output,'sw-version.json'));
    if(enabled)assert.ok(interval.inner.includes(String(parseToml(fs.readFileSync(path.join(root,'assets/site/delivery.toml'),'utf8')).sw.content_check_interval)));
    else assert.equal(interval.inner,extractBlocks(html,'span',tag=>tag.includes('data-site-sw-policy'))[0].inner);
    const indicator=extractStartTags(html,'span').find(tag=>tag.includes('data-site-content-status'));
    assert.equal(extractTagAttribute(indicator,'data-site-page-version'),version);
    assert.equal('content_current' in copy,false,'Program state does not own the version comparison.');
    const links=extractStartTags(html,'a').map(tag=>extractTagAttribute(tag,'href'));
    assert.ok(!links.includes('/sw-version.json'),'The fixed build version is plain text.');
    assert.equal(links.includes('/sw-policy.json'),enabled);
    assert.equal(Boolean(extractTagAttribute(indicator,'data-site-version-url')),enabled);
    assert.ok(policyRow.replace(/<[^>]*>/g,'').trim(),'Policy availability is explicit.');
  }
  assert.deepEqual((await inspectBuildVersion(output)).issues,[]);
});
