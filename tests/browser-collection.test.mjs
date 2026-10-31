import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteMounts,fixtureContentDirectory,directoryPage} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {layoutCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/collection/layout/options.mjs';
import {styleCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/collection/style/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';
import {loadChromium,loadWebkit} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {check as checkFirstPaint} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/first-paint/check.mjs';
import {check as checkCollectionLayout} from '../.agents/skills/swaw-banyan/tasks/check/browser/collection/layout/check.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-collection');
const article='/d/collection-fixture/one/#from=all';let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/collection/'+command,'entry.mjs'),directory,...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function css(directory,route,text){write(path.join(directory,'probe.css'),text);fs.appendFileSync(path.join(directory,route,'index.html'),'<link rel="stylesheet" href="/probe.css">');}
function report(result){assert.equal(result.status,0,result.stdout+result.stderr);return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-collection-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime='node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  fixtureContentDirectory(content);
  write(path.join(content,'d/collection-fixture/_index.md'),'---\ntitle: Independent Collection\n---\n');
  for(const [index,name] of ['one','two','three','four'].entries())write(path.join(content,'d/collection-fixture',name+'.md'),
    `---\ntitle: ${name==='three'?'Long name 测试 '+('collection title '.repeat(12)):name}\nurl: /d/collection-fixture/${name}/\ndate: "2026-01-0${index+1}T00:00:00+08:00"\n---\n\n## Chapter\n\n`+'Independent collection text.\n\n'.repeat(20));
  for(const suffix of ['.zh','.zh-tw'])for(const name of ['translated-one','translated-two'])write(path.join(content,'d',name+suffix+'.md'),
    `---\ntitle: ${name}\nurl: d/${name}/\ndate: 2026-01-01\n---\n\n独立翻译内容。`);
  for(const suffix of ['','.zh','.zh-tw']) {
    write(path.join(content,'discover','_index'+suffix+'.md'),directoryPage('Sources'));
    write(path.join(content,'discover/tooling','_index'+suffix+'.md'),directoryPage('Tooling'));
    write(path.join(content,'discover/tooling/devtools','_index'+suffix+'.md'),directoryPage('Devtools'));
  }
  write(path.join(content,'discover/tooling/_map.toml'),"refs = [\"/d/collection-fixture/one\",\"/d/collection-fixture/three\"]\n");
  write(path.join(content,'discover/tooling/devtools/_map.toml'),"refs = [\"/d/collection-fixture/two\",\"/d/collection-fixture/four\"]\n");
  write(config,`[[module.mounts]]\nsource = ${JSON.stringify(content.replaceAll('\\','/'))}\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`+fixtureSiteMounts);
  const build=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(build.error);assert.equal(build.status,0,build.stdout+build.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('collection options declare pages, comparisons, settings and widths',()=>{
  for(const factory of [layoutCommand,styleCommand])assert.throws(()=>parseArguments(factory('check','Check'),[]),/--page is required/);
  const layout=layoutCommand('check/browser/collection/layout'),style=styleCommand('check/browser/collection/style');
  assert.throws(()=>parseArguments(style,['--page',article]),/--collection is required/);
  assert.throws(()=>parseArguments(layout,['--page','/all/','--article','https://example.invalid/article/']));
  assert.throws(()=>parseArguments(layout,['--page','/all/','--widths','390,390']));
  assert.match(helpFor(layout,'en'),/--article <path>/);assert.match(helpFor(layout,'en'),/default: 390,1440/);
  assert.match(helpFor(style,'en'),/--choices <path>/);assert.match(helpFor(style,'en'),/default: \/appearance\//);
});

test('layout checks directory, flat, reference and product lists at narrow and wide widths',{timeout:20000},()=>{
  const directories=[];
  for(const route of ['/d/collection-fixture/','/discover/tooling/','/discover/tooling/devtools/']) {
    const state=report(cli('layout',['--page',route,'--widths','390,1440','--out',path.join(work,'reports')]));
    directories.push(...state.details.cases);
  }
  const state=report(cli('layout',['--page','/all/','--article',article,'--widths','390,1440','--out',path.join(work,'reports')]));
  assert.equal(state.browser,'chromium');assert.ok(state.browserVersion);
  for(const result of state.details.cases){assert.ok(result.main.rows.length>=4);assert.deepEqual(result.main.fields,['name','date','size']);assert.equal(result.path.pathGrid,true);assert.equal(result.path.nameOnly,true);}
  for(const directory of directories) {
    const fields=directory.main.heading.fields,aggregate=state.details.cases.find(result=>result.width===directory.width).main.heading.fields;
    assert.deepEqual(fields.map(cell=>cell.field),['name','date','count']);
    assert.ok(fields.at(-1).x+fields.at(-1).width-fields[0].x<=390,'Directory fields must fit the 390 CSS px row budget.');
    for(const [field,comparison] of [['name','name'],['date','date'],['count','size']])assert.ok(
      Math.abs(fields.find(cell=>cell.field===field).width-aggregate.find(cell=>cell.field===comparison).width)<=.1,
      'Directory and aggregate layouts must share the '+field+' field width.');
  }
  const products=report(cli('layout',['--page','/products-all/','--widths','390,1440','--out',path.join(work,'reports')]));
  for(const result of products.details.cases) {
    const fields=result.main.heading.fields,aggregate=state.details.cases.find(item=>item.width===result.width).main.heading.fields;
    assert.deepEqual(result.main.fields,['name','version','price']);
    assert.ok(fields.at(-1).x+fields.at(-1).width-fields[0].x<=390,'Product fields must fit the same 390 CSS px row budget.');
    assert.deepEqual(fields.map(({x,width})=>({x,width})),aggregate.map(({x,width})=>({x,width})),
      'Products and aggregate lists must share every column width and gap.');
  }
  assert.equal(fs.existsSync(path.join(work,'node_modules')),false);
});

test('directory, aggregate and product headers fit their shared fixed columns in all languages',{timeout:30000},async()=>{
  const server=await createStaticSiteServer(output);let browser;
  try {
    await server.start();const type=loadChromium();browser=await type.launch({headless:true,executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage();
    for(const prefix of ['','/zh','/zh-tw'])for(const route of ['/d/','/all/','/products-all/']) {
      for(const field of route==='/products-all/'?['version','price']:['date',route==='/all/'?'size':'count']) {
        await checkCollectionLayout({page,baseUrl:server.getBaseUrl(),options:{page:prefix+route+'#sort='+field+'-desc',widths:'390,1440'}});
      }
    }
    for(const field of ['version','price'])await checkCollectionLayout({page,baseUrl:server.getBaseUrl(),options:{page:'/ar/products-all/#sort='+field+'-desc',widths:'390,1440'}});
  } finally {try{if(browser)await browser.close();}finally{await server.stop();}}
});

for(const [name,loadBrowser] of [['chromium',loadChromium],['webkit',loadWebkit]])test(name+' keeps fixed collection widths at startup and clips long headings without shrinking text',{timeout:15000},async()=>{
  const server=await createStaticSiteServer(output);let browser;
  try {
    await server.start();const type=loadBrowser();browser=await type.launch({headless:true,executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage();
    for(const route of ['/d/collection-fixture/','/zh/all/','/products-all/']) {
      await checkFirstPaint({page,baseUrl:server.getBaseUrl(),options:{page:route,widths:'390,1440'}});
      for(const font of ['system-ui','monospace']) {
        const state=await page.locator('.slot-main [data-list-header]').evaluate((header,font)=>{
          header.style.fontFamily=font;
          const fields=[...header.children].slice(1,3);
          const read=()=>fields.map(cell=>({width:cell.getBoundingClientRect().width,fontSize:getComputedStyle(cell).fontSize}));
          const before=read();
          for(const cell of fields)cell.querySelector('[data-sort-control]').firstChild.textContent='Long heading '.repeat(20);
          return {before,after:read(),clipped:fields.every(cell=>cell.scrollWidth>cell.clientWidth&&getComputedStyle(cell).overflowX==='hidden')};
        },font);
        assert.deepEqual(state.after,state.before,'Long labels must retain the declared field widths and font sizes.');
        assert.equal(state.clipped,true,'Labels that exceed the fixed field width must be clipped.');
      }
    }
  } finally {try{if(browser)await browser.close();}finally{await server.stop();}}
});

test('style checks actual links and choice buttons in both themes and widths',{timeout:45000},()=>{
  const state=report(cli('style',['--page',article,'--collection','/all/','--widths','390,1440','--trace','--out',path.join(work,'reports')]));
  assert.equal(state.browser,'chromium');assert.equal(state.details.cases.length,4);
  for(const result of state.details.cases){assert.equal(result.choiceFocus.tag,'BUTTON');assert.equal(result.pathFocus.tag,'A');assert.equal(result.mainFocus.visible,true);}
  const translated=cli('style',['--page','/zh/d/translated-one/#from=all','--collection','/zh/all/','--choices','/zh/appearance/']);
  assert.equal(translated.status,0,translated.stdout+translated.stderr);
});

test('layout rejects narrowed names, changed headers, moved rows, padding and missing separators',{timeout:20000},()=>{
  const width=fixture('name-width');css(width,'all','.item-list--all > .list-item{grid-template-columns:100px 10ch 6ch!important}');
  const narrowed=cli('layout',['--page','/all/','--widths','390'],width);assert.equal(narrowed.status,1);assert.match(narrowed.stderr,/Name column must match/);
  const header=fixture('header');css(header,'d/collection-fixture/one','.item-list--path-column .list-header{padding-block-start:5px!important}');
  const shifted=cli('layout',['--page','/all/','--article',article,'--widths','390'],header);assert.equal(shifted.status,1);assert.match(shifted.stderr,/Main and path lists must align/);
  const offset=fixture('offset');css(offset,'d/collection-fixture/one','.item-list--path-column .item-control{transform:translateX(12px)!important}');
  const moved=cli('layout',['--page','/all/','--article',article,'--widths','390'],offset);assert.equal(moved.status,1);assert.match(moved.stderr,/column start/);
  const padding=fixture('padding');css(padding,'d/collection-fixture/one','.item-list--path-column .item-control{padding-inline-start:12px!important}');
  const padded=cli('layout',['--page','/all/','--article',article,'--widths','390'],padding);assert.equal(padded.status,1);assert.match(padded.stderr,/Row icons must begin/);
  const separator=fixture('separator');css(separator,'all','.list-header{border-bottom:0!important}');
  const missing=cli('layout',['--page','/all/','--widths','390'],separator);assert.equal(missing.status,1);assert.match(missing.stderr,/below the header separator/);
});

test('layout rejects field drift, subgrid and content-sized tracks',{timeout:20000},()=>{
  for(const [name,rule,message] of [
    ['long-heading','.slot-main [data-list-header] [data-item-field="date"] a::after{content:"Long metadata heading"}',/Metadata headers and sort indicators must fit/],
    ['field-width','[data-list-item] > [data-item-field="date"]{width:1px!important}',/field must match its header width/],
    ['subgrid','[data-list-item]{grid-template-columns:subgrid!important}',/independent Grid/],
    ['content-track','.item-list--all{--list-field-tracks:var(--navigation-column-inline) max-content 6ch!important}',/determined widths/]
  ]) {
    const broken=fixture(name);css(broken,'all',rule);
    const result=cli('layout',['--page','/all/','--widths','390'],broken);assert.equal(result.status,1);assert.match(result.stderr,message);
  }
});

test('style rejects different path selection, main hover and button focus styles',{timeout:20000},()=>{
  const selected=fixture('selection');css(selected,'d/collection-fixture/one','.item-list--path-column .item-control.is-current::before{background:red!important}');
  const mismatch=cli('style',['--page',article,'--collection','/all/'],selected);assert.equal(mismatch.status,1);assert.match(mismatch.stderr,/Path rows must reuse root selection/);
  const hover=fixture('hover');css(hover,'all','.slot-main .item-control:hover::before{box-shadow:none!important}');
  const different=cli('style',['--page',article,'--collection','/all/'],hover);assert.equal(different.status,1);assert.match(different.stderr,/Main collection rows must reuse root hover/);
  const focus=fixture('focus');css(focus,'appearance','.item-list button:focus-visible{outline:none!important}');
  const invisible=cli('style',['--page',article,'--collection','/all/'],focus);assert.equal(invisible.status,1);assert.match(invisible.stderr,/visible 2px dashed focus ring/);
});

test('style rejects changed color scheme and element backgrounds',{timeout:15000},()=>{
  const scheme=fixture('scheme');css(scheme,'appearance','html{color-scheme:light!important}');
  const wrong=cli('style',['--page',article,'--collection','/all/'],scheme);assert.equal(wrong.status,1);assert.match(wrong.stderr,/color-scheme must follow/);
  const background=fixture('background');css(background,'appearance','button.item-control.is-current{background:red!important}');
  const painted=cli('style',['--page',article,'--collection','/all/'],background);assert.equal(painted.status,1);assert.match(painted.stderr,/reuse root selection/);
});

test('checks reject unsuitable pages and mismatched source collections',{timeout:15000},()=>{
  const missing=cli('layout',['--page','/about/']);assert.equal(missing.status,1);assert.match(missing.stderr,/requested collection list/);
  const source=cli('layout',['--page','/discover/tooling/','--article',article,'--widths','390']);assert.equal(source.status,1);assert.match(source.stderr,/requested collection list/);
  const choices=cli('style',['--page',article,'--collection','/all/','--choices','/about/']);assert.equal(choices.status,1);assert.match(choices.stderr,/appearance page with light and dark/);
});
