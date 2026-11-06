import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteFiles,fixtureDelivery} from './_shared/hugo.mjs';
import {loadDependency} from '../.agents/skills/swaw-banyan/tasks/_shared/dependencies.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {extractStartTags,extractTagAttribute,decodeHtmlAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/site-title-tests');
const languages=[{suffix:'',prefix:'',title:'Site EN',label:'English'},{suffix:'.zh',prefix:'zh/',title:'中文站名',label:'中文'}];
const toml=loadDependency('@iarna/toml');
let work,site,config;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function home(language,title=language.title) {
  return '---\n'+(title===null?'':'title: '+JSON.stringify(title)+'\n')+
    'linkTitle: Navigation '+language.label+'\ndescription: Home description\nlayout: page-home\nparams:\n  browser_title: Browser '+language.label+'\n---\nHome body.\n';
}
function build(name) {
  const output=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:site,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);return {output,result};
}
const titleOf=text=>decodeHtmlAttribute(extractBlocks(text,'title')[0]?.inner??'');
const read=(output,prefix,file)=>fs.readFileSync(path.join(output,prefix,file),'utf8');
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));site=path.join(work,'site');
  fixtureSiteFiles(site);
  write(path.join(site,'layouts/home.html'),'{{ partial "system-metadata/site/title.html" .Site }}');
  config=toml.parse(fs.readFileSync(path.join(root,'hugo.toml'),'utf8'));
  delete config.title;config.languages={en:config.languages.en,zh:config.languages.zh};
  config.baseURL='https://example.test/';
  write(path.join(site,'hugo.toml'),toml.stringify(config));
  write(path.join(site,'go.mod'),'module fixture.invalid/site-title\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\n'+
    'replace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(root,'module').replaceAll('\\','/'))+'\n');
  write(path.join(site,'assets/site/delivery.toml'),fixtureDelivery('[sw]\nmode="off"\ncontent_check_interval=5\noffline_notice_path="_res/offline/"\n'));
  for(const language of languages) {
    write(path.join(site,'content/_index'+language.suffix+'.md'),home(language));
    write(path.join(site,'content/articles/_index'+language.suffix+'.md'),'---\ntitle: Collection '+language.label+'\nlayout: page-collection-directory\n---\n');
    for(const custom of [false,true]) write(path.join(site,'content/articles/'+(custom?'custom':'plain')+language.suffix+'.md'),
      '---\ntitle: Article '+language.label+'\nurl: '+(custom?'custom':'plain')+'/\nlayout: page-article-rss\n'+
      (custom?'params:\n  browser_title: Custom '+language.label+'\n':'')+'---\nArticle body.\n');
  }
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('homepage titles supply localized site metadata independently of navigation and browser labels',()=>{
  for(const nativeTitle of [false,true]) {
    const current=structuredClone(config);
    if(nativeTitle){current.title='Unused global name';current.languages.zh.title='Unused translated name';}
    write(path.join(site,'hugo.toml'),toml.stringify(current));
    const {output,result}=build(nativeTitle?'native-title-ignored':'home-title-only');
    assert.equal(result.status,0,result.stdout+result.stderr);
    const manifests=new Set();
    for(const language of languages) {
      const {prefix,title,label}=language,html=read(output,prefix,'index.html');
      assert.equal(titleOf(html),'Browser '+label);
      const nav=extractStartTags(html,'nav').find(tag=>tag.includes('data-root-navigation'));
      assert.equal(extractTagAttribute(nav,'aria-label'),title);
      assert.ok(html.includes('Navigation '+label),'The navigation can use a separate label.');
      assert.equal(titleOf(read(output,prefix,'plain/index.html')),'Article '+label+' - '+title);
      assert.equal(titleOf(read(output,prefix,'custom/index.html')),'Custom '+label+' - '+title);
      assert.equal(titleOf(read(output,prefix,'index.xml')),title);
      assert.equal(titleOf(read(output,prefix,'articles/index.xml')),'Collection '+label+' on '+title);
      assert.equal(read(output,prefix,'llms.txt').split('\n')[0],'# '+title+' - '+label);
      const rssLink=extractStartTags(html,'link').find(tag=>extractTagAttribute(tag,'type')==='application/rss+xml');
      assert.equal(extractTagAttribute(rssLink,'title'),title);
      const manifestLink=extractStartTags(html,'link').find(tag=>extractTagAttribute(tag,'rel')==='manifest');
      const href=extractTagAttribute(manifestLink,'href');manifests.add(href);
      const manifest=JSON.parse(fs.readFileSync(path.join(output,new URL(href,'https://example.test/').pathname),'utf8'));
      assert.equal(manifest.name,languages[0].title);assert.equal(manifest.short_name,languages[0].title);
    }
    assert.equal(manifests.size,1,'All languages retain one PWA identity from the default-language homepage.');
  }
});

test('missing or blank homepage titles stop the build even when native site titles are set',()=>{
  write(path.join(site,'hugo.toml'),toml.stringify({...config,title:'Native name cannot fill in a missing homepage title'}));
  const language=languages[1],file=path.join(site,'content/_index.zh.md');
  fs.unlinkSync(file);
  const missing=build('missing-home-file').result;
  assert.notEqual(missing.status,0,'An autogenerated home must not supply a native config title.');
  assert.match(missing.stdout+missing.stderr,/homepage for language "zh" requires a non-empty title/);
  for(const [index,title] of [null,'','   '].entries()) {
    write(file,home(language,title));
    const {result}=build('missing-title-'+index);
    assert.notEqual(result.status,0,'A homepage title is required for every language.');
    assert.match(result.stdout+result.stderr,/homepage for language "zh" requires a non-empty title/);
  }
  write(file,home(language));
});

test('the default language controls shared metadata while language weights only control ordering',()=>{
  const current=structuredClone(config);
  current.defaultContentLanguage='en';current.languages.en.weight=2;current.languages.zh.weight=1;
  for(const language of languages) write(path.join(site,'content/language/_index'+language.suffix+'.md'),
    '---\ntitle: Language '+language.label+'\nlayout: page-collection-language\noutputs: [HTML]\n'+
    'params:\n  labels:\n    back: Back\n    missing_translation: Missing {lang}\n---\n');
  for(const inSubdir of [false,true]) {
    current.defaultContentLanguageInSubdir=inSubdir;
    write(path.join(site,'hugo.toml'),toml.stringify(current));
    const defaultPrefix=inSubdir?'en/':'';
    const {output,result}=build('default-language-not-first-'+inSubdir);
    assert.equal(result.status,0,result.stdout+result.stderr);
    for(const file of ['edgeone.json','_headers'])assert.ok(fs.existsSync(path.join(output,file)),'Default-language rendering publishes '+file+'.');
    const manifests=new Set();
    for(const language of languages) {
      const {label,title}=language,prefix=language.prefix||defaultPrefix;
      const html=read(output,prefix,'plain/index.html');
      const xDefault=extractStartTags(html,'link').find(tag=>extractTagAttribute(tag,'hreflang')==='x-default');
      assert.equal(extractTagAttribute(xDefault,'href'),'https://example.test/'+defaultPrefix+'plain/','x-default follows defaultContentLanguage.');
      const notFound=read(output,prefix,'404.html');
      const otherLanguages=extractStartTags(notFound,'li').find(tag=>extractTagAttribute(tag,'id')==='try-others');
      assert.equal(extractTagAttribute(otherLanguages,'data-default-lang'),'en','404 fallback follows defaultContentLanguage.');
      const manifestLink=extractStartTags(html,'link').find(tag=>extractTagAttribute(tag,'rel')==='manifest');
      const href=extractTagAttribute(manifestLink,'href');manifests.add(href);
      const manifest=JSON.parse(fs.readFileSync(path.join(output,new URL(href,'https://example.test/').pathname),'utf8'));
      assert.equal(manifest.name,'Site EN','The shared app name follows defaultContentLanguage.');
      assert.equal(manifest.short_name,'Site EN');
      const languagePage=read(output,prefix,'language/index.html');
      const choices=extractStartTags(languagePage,'a').filter(tag=>extractTagAttribute(tag,'data-language-choice'));
      assert.deepEqual(choices.map(tag=>extractTagAttribute(tag,'data-language-choice')),['zh','en'],'Language choices retain weight order.');
      const llms=read(output,prefix,'llms.txt');
      assert.equal(llms.split('\n')[0],'# '+title+' - '+label);
      assert.ok(llms.includes(language.prefix?'- [English](<https://example.test/'+defaultPrefix+'llms.txt>)':'- [中文](<https://example.test/zh/llms.txt>)'));
    }
    assert.equal(manifests.size,1,'All languages share the default-language manifest.');
  }
});
