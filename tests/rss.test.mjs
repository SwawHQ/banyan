import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteFiles,fixtureSitePages,directoryPage} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {extractTagAttribute as attr,extractStartTags} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(os.tmpdir(),'swaw/banyan/rss-tests');
let work,source,output,limited;
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
function build(name,extra='') {
  const configuration=path.join(work,name+'.toml');write(configuration,extra);
  const destination=path.join(work,name);
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+configuration,'--destination',destination],
    {cwd:source,env:fixtureEnvironment(path.join(work,name+'-tools')),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return destination;
}
const read=(directory,prefix,route)=>fs.readFileSync(path.join(directory,prefix,route),'utf8');
const urls=xml=>[...xml.matchAll(/<guid>([^<]+)<\/guid>/g)].map(match=>match[1]);

before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));
  source=path.join(work,'site');fixtureSiteFiles(source);fixtureSitePages(source,['rss']);
  fs.cpSync(path.join(repository,'module'),path.join(source,'themes/banyan'),{recursive:true});
  write(path.join(source,'hugo.toml'),[
    'theme="banyan"','baseURL="https://example.test/base/"','defaultContentLanguage="en"','panicOnWarning=true',
    '[taxonomies]','[[cascade]]','build.publishResources=false','[minify]','disableJS=true',
    '[markup.highlight]','noClasses=false',
    '[params.appearance]','palette="site/theme.css"',
    '[languages.en]','label="English"','locale="en-US"','weight=1',
    '[languages.zh]','label="中文"','locale="zh-Hans"','weight=2',
    '[languages.ar]','label="العربية"','locale="ar"','direction="rtl"','weight=3',
    '[outputs]','home=["HTML","RSS"]','section=["HTML","RSS"]','page=["HTML"]'
  ].join('\n'));
  for(const suffix of ['','.zh','.ar']) {
    write(path.join(source,'content/_index'+suffix+'.md'),'---\ntitle: Fixture\ndescription: RSS fixture.\nlayout: page-home\n---\n');
    for(const name of ['posts','posts/nested','category','empty','no-feed'])
      write(path.join(source,'content',name,'_index'+suffix+'.md'),directoryPage(name,name==='no-feed'?'outputs: [HTML]\n':''));
  }
  for(const suffix of ['','.zh'])for(const [name,date] of [['alpha','2026-01-01'],['nested/beta','2026-02-01'],['note','2026-03-01']])
    write(path.join(source,'content/posts',name,'index'+suffix+'.md'),'---\ntitle: '+name+'\nurl: p/'+path.basename(name)+'/\ndate: '+date+
      (name==='note'?'\nlayout: page-article-norss':'')+'\n---\nArticle.\n');
  write(path.join(source,'content/category/_map.toml'),'refs = ["/posts/alpha"]\n');
  output=build('normal');limited=build('limited','[services.rss]\nlimit=1\n');
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),fs.realpathSync(parent));fs.rmSync(work,{recursive:true,force:true});}});

test('RSS instructions use actual language roots under a base path without enumerating categories',()=>{
  for(const prefix of ['','zh/','ar/']) {
    const html=read(output,prefix,'rss/index.html'),root='https://example.test/base/'+prefix;
    assert.deepEqual(extractBlocks(html,'h2').map(h=>attr(h.open,'id')),['all-articles','by-section']);
    assert.doesNotMatch(html,/HAHAHUGOSHORTCODE/);
    const code=extractBlocks(html,'pre')[0]?.inner||'';
    for(const suffix of ['','#...','?...','index.xml'])assert.ok(code.includes(root+'category1/category2/'+suffix));
    const anchors=extractStartTags(html,'a');
    assert.equal(anchors.filter(tag=>attr(tag,'href').endsWith('.xml')).length,1,'RSS page links only to the all-articles feed.');
    const feed=anchors.find(tag=>attr(tag,'href')==='/base/'+prefix+'index.xml');
    assert.ok(feed);assert.equal(attr(feed,'target'),'_blank');assert.equal(attr(feed,'rel'),'noopener noreferrer');
    assert.ok(!anchors.some(tag=>attr(tag,'href').includes('category1/category2')));
    assert.equal(fs.existsSync(path.join(output,prefix,'rss/index.xml')),false);
  }
});
test('category feeds retain nested articles and references while excluding information pages',()=>{
  for(const prefix of ['','zh/']) {
    const url=name=>'https://example.test/base/'+prefix+'p/'+name+'/';
    for(const route of ['index.xml','posts/index.xml'])assert.deepEqual(urls(read(output,prefix,route)),['beta','alpha'].map(url));
    assert.deepEqual(urls(read(output,prefix,'posts/nested/index.xml')),['beta'].map(url));
    assert.deepEqual(urls(read(output,prefix,'category/index.xml')),['alpha'].map(url));
    assert.deepEqual(urls(read(output,prefix,'empty/index.xml')),[]);
    for(const route of ['no-feed/index.xml','p/alpha/index.xml'])assert.equal(fs.existsSync(path.join(output,prefix,route)),false);
  }
});
test('RSS item limits apply to home, parent and nested category feeds',()=>{
  for(const prefix of ['','zh/']) {
    for(const route of ['index.xml','posts/index.xml','posts/nested/index.xml'])
      assert.deepEqual(urls(read(limited,prefix,route)),['https://example.test/base/'+prefix+'p/beta/']);
    assert.deepEqual(urls(read(limited,prefix,'category/index.xml')),['https://example.test/base/'+prefix+'p/alpha/']);
  }
});

test('rss-link reports a missing language-home RSS output',()=>{
  assert.throws(()=>build('missing-home-feed','[outputs]\nhome=["HTML"]\n'),
    /uses rss-link, but the language homepage has no RSS output/);
});
