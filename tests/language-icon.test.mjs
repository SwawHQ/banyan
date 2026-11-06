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
import {extractStartTags,extractTagAttribute as attr} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url)),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/language-icon-tests');
const toml=loadDependency('@iarna/toml');
let work,site,configuration,sequence=0;
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
function settings(label,icon) {
  return '---\ntitle: Language '+label+'\ntranslationKey: language-settings\nlayout: page-collection-language\noutputs: [HTML]\nweight: 30\n'+
    'params:\n  icon: language\n'+(icon===undefined?'':'  language_icon: '+JSON.stringify(icon)+'\n')+
    '  labels:\n    back: Back\n    missing_translation: Missing {lang}\n---\n';
}
function build() {
  const output=path.join(work,'build-'+(++sequence)),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:site,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return output;
}
const read=(output,prefix='',page='language')=>fs.readFileSync(path.join(output,prefix,page,'index.html'),'utf8');
const choices=html=>new Map(extractBlocks(html,'a',tag=>Boolean(attr(tag,'data-language-choice'))).map(block=>[attr(block.open,'data-language-choice'),block]));
const uses=html=>extractStartTags(html,'use').map(tag=>attr(tag,'href'));
const textIcon=html=>extractBlocks(html,'span',tag=>attr(tag,'class').split(/\s+/).includes('icon--text'))[0]?.inner;
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));site=path.join(work,'site');
  fixtureSiteFiles(site);
  configuration=toml.parse(fs.readFileSync(path.join(repository,'hugo.toml'),'utf8'));
  configuration.languages={en:configuration.languages.en,zh:configuration.languages.zh};configuration.baseURL='https://example.test/';
  configuration.defaultContentLanguage='en';configuration.defaultContentLanguageInSubdir=false;
  configuration.languages.en.params={icon:{text:'Unused EN'}};configuration.languages.zh.params={icon:{text:'Unused ZH'}};
  write(path.join(site,'hugo.toml'),toml.stringify(configuration));
  write(path.join(site,'go.mod'),'module fixture.invalid/language-icon\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\n'+
    'replace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(repository,'module').replaceAll('\\','/'))+'\n');
  write(path.join(site,'assets/site/delivery.toml'),fixtureDelivery('[sw]\nmode="off"\ncontent_check_interval=5\noffline_notice_path="_res/offline/"\n'));
  for(const suffix of ['', '.zh'])write(path.join(site,'content/_index'+suffix+'.md'),'---\ntitle: Icon fixture\ndescription: Language icon fixture.\nlayout: page-home\n---\nHome.\n');
  write(path.join(site,'content/language/_index.md'),settings('English',{text:'EN'}));
  write(path.join(site,'content/language/_index.zh.md'),settings('中文',{text:'简'}));
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('language choices read target setting pages while the settings entry retains its own icon',()=>{
  const output=build();
  for(const prefix of ['', 'zh']) {
    const html=read(output,prefix),options=choices(html);
    assert.equal(textIcon(options.get('en').inner),'EN');assert.equal(textIcon(options.get('zh').inner),'简');
    assert.doesNotMatch(html,/Unused EN|Unused ZH/,'Native language params must not supply choice icons.');
    const home=read(output,prefix,''),href='/'+(prefix?prefix+'/':'')+'language/';
    const entry=extractBlocks(home,'a',tag=>attr(tag,'data-root-href')===href);
    assert.equal(entry.length,1);assert.deepEqual(uses(entry[0].inner),['#icon-language']);
  }
});

test('omitted choice icons and missing optional setting translations use the generic language icon',()=>{
  const file=path.join(site,'content/language/_index.zh.md');
  try {
    write(file,settings('中文'));
    const noIcon=build();
    for(const prefix of ['', 'zh'])assert.deepEqual(uses(choices(read(noIcon,prefix)).get('zh').inner),['#icon-language']);
    fs.unlinkSync(file);
    const noPage=build(),option=choices(read(noPage)).get('zh');
    assert.deepEqual(uses(option.inner),['#icon-language']);assert.equal(attr(option.open,'href'),'/zh/');
  } finally {write(file,settings('中文',{text:'简'}));}
});

test('invalid choice icon values fail rather than silently using the generic icon',()=>{
  const file=path.join(site,'content/language/_index.zh.md');
  try {
    for(const value of [false,0,[],{}]) {
      write(file,settings('中文',value));
      assert.throws(()=>build(),/params\.language_icon must be an SVG name or an object/);
    }
  } finally {write(file,settings('中文',{text:'简'}));}
});

test('translated setting pages with different paths resolve image icons from their own bundle',()=>{
  const original=path.join(site,'content/language/_index.zh.md'),moved=path.join(site,'content/preferences/_index.zh.md');
  const image='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>\n';
  try {
    fs.unlinkSync(original);write(moved,settings('中文',{image:'./choice.svg'}));
    // This branch has only a Chinese page, so the resource needs its language suffix.
    write(path.join(site,'content/preferences/choice.zh.svg'),image);
    const output=build(),sources=new Set();
    for(const [prefix,page] of [['','language'],['zh','preferences']]) {
      const option=choices(read(output,prefix,page)).get('zh');assert.equal(attr(option.open,'href'),'/zh/preferences/');
      const icons=extractStartTags(option.inner,'img');assert.equal(icons.length,1);
      const source=attr(icons[0],'src');sources.add(source);assert.match(source,/\/media\/content\/preferences\/choice\.zh\.[a-f0-9]{64}\.svg$/);
      assert.equal(fs.readFileSync(path.join(output,new URL(source,configuration.baseURL).pathname),'utf8'),image);
    }
    assert.equal(sources.size,1,'Both interfaces use the same target-language image.');
  } finally {fs.rmSync(moved,{force:true});write(original,settings('中文',{text:'简'}));}
});
