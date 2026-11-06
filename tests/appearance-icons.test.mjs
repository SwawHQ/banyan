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

const repository=fileURLToPath(new URL('../',import.meta.url)),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/appearance-icon-tests');
const toml=loadDependency('@iarna/toml'),modes=['auto','light','dark'];
const icons={en:{auto:'appearance-auto',light:{text:'Day'},dark:{image:'./night.svg'}},zh:{auto:'appearance-dark',light:{text:'浅'},dark:'appearance-light'}};
const image='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>\n';
let work,site,sequence=0;
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
function settings(label,value) {
  return '---\ntitle: Appearance '+label+'\nlayout: page-collection-appearance\noutputs: [HTML]\nweight: 40\n'+
    'params:\n  icon: theme\n'+(value===undefined?'':'  appearance_icons: '+JSON.stringify(value)+'\n')+
    '  labels:\n    back: Back\n    auto: Auto\n    light: Light\n    dark: Dark\n---\n';
}
function build() {
  const output=path.join(work,'build-'+(++sequence)),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:site,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return output;
}
const read=(output,prefix='',page='appearance')=>fs.readFileSync(path.join(output,prefix,page,'index.html'),'utf8');
const choices=html=>new Map(extractBlocks(html,'button',tag=>Boolean(attr(tag,'data-theme-choice'))).map(block=>[attr(block.open,'data-theme-choice'),block]));
const uses=html=>extractStartTags(html,'use').map(tag=>attr(tag,'href'));
const textIcon=html=>extractBlocks(html,'span',tag=>attr(tag,'class').split(/\s+/).includes('icon--text'))[0]?.inner;
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));site=path.join(work,'site');
  fixtureSiteFiles(site);
  const configuration=toml.parse(fs.readFileSync(path.join(repository,'hugo.toml'),'utf8'));
  configuration.languages={en:configuration.languages.en,zh:configuration.languages.zh};configuration.baseURL='https://example.test/';
  configuration.defaultContentLanguage='en';configuration.defaultContentLanguageInSubdir=false;
  write(path.join(site,'hugo.toml'),toml.stringify(configuration));
  write(path.join(site,'go.mod'),'module fixture.invalid/appearance-icons\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\n'+
    'replace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(repository,'module').replaceAll('\\','/'))+'\n');
  write(path.join(site,'assets/site/delivery.toml'),fixtureDelivery('[sw]\nmode="off"\ncontent_check_interval=5\noffline_notice_path="_res/offline/"\n'));
  for(const suffix of ['', '.zh'])write(path.join(site,'content/_index'+suffix+'.md'),'---\ntitle: Appearance fixture\ndescription: Appearance icon fixture.\nlayout: page-home\n---\nHome.\n');
  write(path.join(site,'content/appearance/_index.md'),settings('English',icons.en));
  write(path.join(site,'content/appearance/_index.zh.md'),settings('中文',icons.zh));
  write(path.join(site,'content/appearance/night.en.svg'),image);
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('appearance pages select localized SVG, text and bundle image icons without changing theme states',()=>{
  const output=build();
  for(const prefix of ['', 'zh']) {
    const html=read(output,prefix),options=choices(html);
    assert.deepEqual([...options.keys()],modes,'Functional state names and order stay fixed.');
    assert.equal(textIcon(options.get('light').inner),prefix?'浅':'Day');
    assert.deepEqual(uses(options.get('auto').inner),[prefix?'#icon-appearance-dark':'#icon-appearance-auto']);
    if(prefix)assert.deepEqual(uses(options.get('dark').inner),['#icon-appearance-light']);
    else {
      const images=extractStartTags(options.get('dark').inner,'img');assert.equal(images.length,1);
      const source=attr(images[0],'src');assert.match(source,/\/media\/content\/appearance\/night(?:\.en)?\.[a-f0-9]{64}\.svg$/);
      assert.equal(fs.readFileSync(path.join(output,new URL(source,'https://example.test/').pathname),'utf8'),image);
    }
    const href='/'+(prefix?prefix+'/':'')+'appearance/';
    const entry=extractBlocks(read(output,prefix,''),'a',tag=>attr(tag,'data-root-href')===href);
    assert.equal(entry.length,1);assert.deepEqual(uses(entry[0].inner),['#icon-theme'],'The navigation entry has an independent icon.');
  }
});

test('appearance pages require an icon map and an explicit icon for every functional state',()=>{
  const file=path.join(site,'content/appearance/_index.zh.md');
  try {
    for(const value of [undefined,false,0,[],{}, {auto:'appearance-auto',dark:'appearance-dark'}]) {
      write(file,settings('中文',value));assert.throws(()=>build(),/params\.appearance_icons/);
    }
  } finally {write(file,settings('中文',icons.zh));}
});

test('appearance icon values retain the shared icon type validation',()=>{
  const file=path.join(site,'content/appearance/_index.zh.md');
  try {
    for(const value of [false,0,[],{}]) {
      write(file,settings('中文',{...icons.zh,light:value}));
      assert.throws(()=>build(),/params\.appearance_icons\.light.*must be an SVG name or an object/);
    }
  } finally {write(file,settings('中文',icons.zh));}
});

test('blank appearance icon names do not become a generic file icon',()=>{
  const file=path.join(site,'content/appearance/_index.zh.md');
  try {
    for(const value of ['', '   ']) {
      write(file,settings('中文',{...icons.zh,light:value}));
      assert.throws(()=>build(),/params\.appearance_icons\.light/);
    }
  } finally {write(file,settings('中文',icons.zh));}
});
