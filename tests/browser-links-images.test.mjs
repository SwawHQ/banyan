import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/toolchain/operations.mjs';
import {tabsCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/nav/tabs/options.mjs';
import {rootsCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/nav/roots/options.mjs';
import {imageCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/img/load/options.mjs';
import {parseArguments} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=fs.realpathSync(os.tmpdir());
const links='/fixtures/links/',images='/fixtures/images/';
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function edit(directory,route,change){const file=path.join(directory,route,'index.html');write(file,change(fs.readFileSync(file,'utf8')));}
function script(directory,route,name,code){
  write(path.join(directory,name+'.js'),code);edit(directory,route,html=>html.replace('</head>','<script defer src="/'+name+'.js"></script></head>'));
}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/'+command,'entry.mjs'),directory,...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function report(result){
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
function failure(result,message){assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-links-images-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime=process.versions.bun?'bun':'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun??process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  for(const name of ['links','images'])write(path.join(content,'fixture-'+name,'index.md'),
    '---\ntitle: Independent '+name+'\nslug: fixture-'+name+'\nurl: /fixtures/'+name+'/\nlayout: page-article\nroot_nav: true\nicon: code\nweight: 85\nbuild:\n  list: local\n---\n\nFixture insertion point.');
  write(config,'[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n');
  const build=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(build.error);assert.equal(build.status,0,build.stdout+build.stderr);
  edit(output,'fixtures/links',html=>{
    assert.ok(html.includes('Fixture insertion point.'));
    return html.replace('Fixture insertion point.',
      '<a data-link-fixture href="https://destination.invalid/story#part" target="_blank" rel="noopener">External fixture</a> '+
      '<a data-link-fixture href="/powered-by/" target="_blank" rel="noopener">Local fixture</a>');
  });
  write(path.join(output,'fixture.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="red"/></svg>');
  edit(output,'fixtures/images',html=>html.replace('Fixture insertion point.',
    '<img data-image-fixture src="/fixture.svg" width="32" height="16" alt="Fixture">'+
    '</p>'+('<p>Independent image loading spacer.</p>'.repeat(120))+
    '<p><a href="https://destination.invalid/avatar"><img data-image-fixture src="/fixture.svg?lazy" loading="lazy" width="32" height="16" alt="Lazy fixture"></a>'));
},{timeout:60000});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('link and image commands require explicit pages and root paths',()=>{
  for(const spec of [tabsCommand(),imageCommand()]){
    assert.throws(()=>parseArguments(spec,[]),/--page is required/);
    assert.throws(()=>parseArguments(spec,['--page','https://outside.invalid/']));
    assert.throws(()=>parseArguments(spec,['--page',links,'--selector',' ']),/must not be empty/);
  }
  const spec=rootsCommand();
  assert.throws(()=>parseArguments(spec,['--from','/powered-by/']),/--pages is required/);
  for(const value of [links+','+links,links+'?return=x',links+'#part'])assert.throws(()=>parseArguments(spec,['--from','/powered-by/','--pages',value]));
  assert.deepEqual(parseArguments(spec,['--from','/powered-by/?unused=1','--pages',links+','+images]).pages,[links,images]);
});

test('native new tabs keep source history and isolate external and local destinations',{timeout:15000},()=>{
  const state=report(cli('nav/tabs',['--page',links,'--selector','[data-link-fixture]','--trace','--out',path.join(work,'reports')]));
  assert.equal(state.browser,'chromium');assert.equal(state.details.links.length,2);
  assert.equal(state.details.links[0].href,'https://destination.invalid/story#part');
  assert.ok(state.details.links.every(link=>link.openerIsolated));
  assert.ok(fs.statSync(path.join(state.artifacts,'trace.zip')).size>0);
});

test('new-tab checks reject changed targets and empty selections',{timeout:15000},()=>{
  const broken=fixture('wrong-target');edit(broken,'fixtures/links',html=>html.replaceAll('target="_blank"','target="_self"'));
  failure(cli('nav/tabs',['--page',links,'--selector','[data-link-fixture]'],broken),/must target a new tab/);
  failure(cli('nav/tabs',['--page',links,'--selector','[data-missing-fixture]']),/at least one new-tab anchor/);
});

test('new-tab checks detect exposed openers and changed source history',{timeout:15000},()=>{
  for(const [name,code,message] of [
    ['opener-leak','document.addEventListener("click",event=>{const link=event.target.closest("[data-link-fixture]");if(link){event.preventDefault();window.open(link.href,"fixture-leak");}},true);',/must not expose its opener/],
    ['source-history','document.addEventListener("click",event=>{if(event.target.closest("[data-link-fixture]"))history.pushState(null,"",location.href);},true);',/must retain source history/]
  ]){
    const broken=fixture(name);script(broken,'fixtures/links',name,code);
    failure(cli('nav/tabs',['--page',links,'--selector','[data-link-fixture]'],broken),message);
  }
});

test('root visits retain ordered roots and selection through reload, Back and Forward',{timeout:15000},()=>{
  const state=report(cli('nav/roots',['--from','/powered-by/?unused=1','--pages',links+','+images,'--out',path.join(work,'reports')]));
  assert.deepEqual(state.details.cases.map(item=>item.page),[links,images]);
  assert.equal(state.details.cases[0].historyLength,state.details.cases[1].historyLength);
  assert.ok(state.details.roots.includes('/powered-by/'));
});

test('root checks detect copied queries, lost selection and duplicate history',{timeout:20000},()=>{
  for(const [name,route,code,message] of [
    ['root-query','powered-by','document.addEventListener("DOMContentLoaded",()=>{for(const link of document.querySelectorAll("[data-root-href]"))link.href+="?return=wrong";});',/ordinary URLs/],
    ['root-selection','fixtures/links','document.addEventListener("DOMContentLoaded",()=>{for(const link of document.querySelectorAll("[data-root-href]")){link.classList.remove("is-current");link.removeAttribute("aria-current");}});',/selected root|Root selection/],
    ['root-history','fixtures/links','history.pushState(history.state,"",location.href);',/native history length/]
  ]){
    const broken=fixture(name);script(broken,route,name,code);
    failure(cli('nav/roots',['--from','/powered-by/','--pages',links],broken),message);
  }
});

test('image checks decode visible and lazy images and report their dimensions',{timeout:15000},()=>{
  const state=report(cli('img/load',['--page',images,'--selector','[data-image-fixture]','--out',path.join(work,'reports')]));
  assert.equal(state.details.images.length,2);
  for(const image of state.details.images){
    assert.deepEqual([image.naturalWidth,image.naturalHeight,image.width],[80,40,32]);assert.ok(image.height>0);
  }
  assert.equal(state.details.images[1].link,'https://destination.invalid/avatar');
});

test('image checks reject broken downloads, hidden images and empty selections',{timeout:15000},()=>{
  const broken=fixture('broken-image');write(path.join(broken,'fixture.svg'),'invalid image');
  failure(cli('img/load',['--page',images,'--selector','[data-image-fixture]'],broken),/Image must decode/);
  const hidden=fixture('hidden-image');write(path.join(hidden,'hidden.css'),'[data-image-fixture]{display:none!important}');
  edit(hidden,'fixtures/images',html=>html.replace('</head>','<link rel="stylesheet" href="/hidden.css"></head>'));
  failure(cli('img/load',['--page',images,'--selector','[data-image-fixture]'],hidden),/must be visible/);
  failure(cli('img/load',['--page',images,'--selector','[data-missing-fixture]']),/at least one displayed image/);
});
