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
import {extractStartTags,extractTagAttribute as attr} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/locale-tests');
const languages=[['en','en-US',''],['zh','zh-Hans','zh/'],['zh-tw','zh-Hant','zh-tw/'],['ar','ar','ar/']];
const toml=loadDependency('@iarna/toml');
let work,site,configuration,sequence=0;
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
const meta=(html,property)=>extractStartTags(html,'meta').filter(tag=>attr(tag,'property')===property).map(tag=>attr(tag,'content'));
const read=(output,prefix='',route='')=>fs.readFileSync(path.join(output,prefix,route,'index.html'),'utf8');
function build() {
  const output=path.join(work,'build-'+(++sequence));
  write(path.join(site,'hugo.toml'),toml.stringify(configuration));
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:site,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return output;
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));site=path.join(work,'site');
  fixtureSiteFiles(site);
  configuration=toml.parse(fs.readFileSync(path.join(repository,'hugo.toml'),'utf8'));
  configuration.baseURL='https://example.test/';configuration.defaultContentLanguage='en';configuration.defaultContentLanguageInSubdir=false;
  for(const [code,locale] of languages)configuration.languages[code].locale=locale;
  write(path.join(site,'go.mod'),'module fixture.invalid/locale\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\n'+
    'replace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(repository,'module').replaceAll('\\','/'))+'\n');
  write(path.join(site,'assets/site/delivery.toml'),fixtureDelivery('[sw]\nmode="off"\ncontent_check_interval=5\noffline_notice_path="_res/offline/"\n'));
  for(const [code] of languages) {
    write(path.join(site,'content/_index.'+code+'.md'),'---\ntitle: Locale '+code+'\ndescription: Locale fixture.\nlayout: page-home\n---\nHome.\n');
    write(path.join(site,'content/article.'+code+'.md'),'---\ntitle: Article '+code+'\nurl: p/locale-probe/\nlayout: page-article-rss\nparams:\n  slots: []\n---\nArticle.\n');
  }
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('script locales preserve RSS tags, language keys and URLs without inventing Open Graph regions',()=>{
  const output=build();
  for(const [code,locale,prefix] of languages) {
    assert.ok(fs.readFileSync(path.join(output,prefix,'index.xml'),'utf8').includes('<language>'+locale+'</language>'));
    for(const route of ['','p/locale-probe/']) {
      const html=read(output,prefix,route),links=extractStartTags(html,'link');
      assert.equal(attr(extractStartTags(html,'html')[0],'lang'),code);
      assert.equal(attr(links.find(tag=>attr(tag,'rel')==='canonical'),'href'),'https://example.test/'+prefix+route);
      const translations=links.filter(tag=>attr(tag,'rel')==='alternate'&&attr(tag,'hreflang')&&attr(tag,'hreflang')!=='x-default');
      assert.deepEqual(translations.map(tag=>[attr(tag,'hreflang'),attr(tag,'href')]).sort(),
        languages.map(([target,,targetPrefix])=>[target,'https://example.test/'+targetPrefix+route]).sort());
      assert.deepEqual(meta(html,'og:locale'),code==='en'?['en_US']:[]);
      assert.deepEqual(meta(html,'og:locale:alternate'),code==='en'?[]:['en_US']);
    }
  }
});

test('Open Graph uses an explicitly chosen region and normalizes its case',()=>{
  configuration.languages.zh.locale='ZH-hans-CN';configuration.languages['zh-tw'].locale='zh-Hant-TW';
  const output=build();
  for(const [prefix,expected] of [['','en_US'],['zh/','zh_CN'],['zh-tw/','zh_TW']]) {
    const html=read(output,prefix);
    assert.deepEqual(meta(html,'og:locale'),[expected]);
    assert.deepEqual(meta(html,'og:locale:alternate').sort(),['en_US','zh_CN','zh_TW'].filter(value=>value!==expected).sort());
  }
  assert.deepEqual(meta(read(output,'ar/'),'og:locale'),[]);
});
