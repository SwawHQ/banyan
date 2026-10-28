import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteMounts,fixtureContentDirectory,directoryPage} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {headerCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/breadcrumb/header/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-presentation');
const collection='/d/presentation/child/',deep='/d/presentation/child/two/three/four/article-4/#from=d/presentation/child/two/three/four';
const engines=[{name:'chromium',suffix:''},{name:'webkit',suffix:'.webkit'}];
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/'+command,'entry.mjs'),directory,...args,'--out',path.join(work,'reports')],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function inject(directory,route,extension,text){
  write(path.join(directory,'probe.'+extension),text);
  fs.appendFileSync(path.join(directory,route,'index.html'),extension==='css'?'<link rel="stylesheet" href="/probe.css">':'<script defer src="/probe.js"></script>');
}
function report(result){
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-presentation-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime='node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  fixtureContentDirectory(content);
  write(path.join(content,'d/root-sibling.md'),'---\ntitle: Root sibling\nurl: d/root-sibling/\ndate: 2026-01-01\n---\nIndependent sortable root row.\n');
  const sections=['d/presentation','d/presentation/child','d/presentation/child/two','d/presentation/child/two/three','d/presentation/child/two/three/four'];
  for(const [index,section] of sections.entries()) {
    write(path.join(content,section,'_index.md'),'---\ntitle: '+(index===0?'Very long collection label 测试 '+('portable headings '.repeat(8)):'Level '+index)+'\n---\n');
    for(const [offset,name] of ['article','other'].entries())write(path.join(content,section,name+'.md'),
      `---\ntitle: ${name}\nurl: /${section}/${name}-${index}/\ndate: "2026-01-0${offset+1}T00:00:00+08:00"\n---\n\n## Chapter\n\n`+'Portable fixture content.\n\n'.repeat(20));
  }
  for(const suffix of ['','.zh','.zh-tw']) {
    write(path.join(content,'discover','_index'+suffix+'.md'),directoryPage('Sources'));
    write(path.join(content,'discover/tooling','_index'+suffix+'.md'),directoryPage('Tooling'));
    write(path.join(content,'discover/tooling/devtools','_index'+suffix+'.md'),directoryPage('Devtools'));
  }
  write(path.join(content,'discover/tooling/_map.toml'),"refs = [\"/d/presentation/article\"]\n");
  write(path.join(content,'discover/tooling/devtools/_map.toml'),"refs = [\"/d/presentation/child/article\"]\n");
  write(config,`[[module.mounts]]\nsource = ${JSON.stringify(content.replaceAll('\\','/'))}\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`+fixtureSiteMounts);
  const build=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(build.error);assert.equal(build.status,0,build.stdout+build.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('header options declare column paths, widths and detailed help',{timeout:20000},()=>{
  const spec=headerCommand('check/browser/breadcrumb/header');assert.throws(()=>parseArguments(spec,[]),/--page is required/);
  assert.throws(()=>parseArguments(spec,['--page',collection,'--column','/all/#sort=name-asc']),/without a query/);
  assert.throws(()=>parseArguments(spec,['--page',collection,'--widths','390,390']));
  assert.match(helpFor(spec,'en'),/--column <path>/);assert.match(helpFor(spec,'en'),/default: 390,1440/);

});

test('Chromium keeps a long header visible before and after a native sort click',{timeout:20000},()=>{
  const state=report(cli('breadcrumb/header',['--page',collection,'--column','/d/presentation/','--widths','390,1440']));
  assert.equal(state.browser,'chromium');
  for(const result of state.details.cases) {
    assert.ok(result.initial.labelContentWidth>result.initial.labelWidth,'Fixture must exercise an ellipsized long label.');
    assert.equal(result.initial.title,result.sorted.title);assert.notEqual(result.initial.indicator,result.sorted.indicator);
  }
  const translated=cli('breadcrumb/header',['--page','/zh/discover/tooling/devtools/','--widths','390']);
  assert.equal(translated.status,0,translated.stdout+translated.stderr);
});

test('Chromium rejects clipped controls, missing titles and spacing changed by sorting',{timeout:30000},()=>{
  const clipped=fixture('clipped');inject(clipped,'d/presentation/child','css','.path-column-label{min-width:600px!important}');
  const clip=cli('breadcrumb/header',['--page',collection,'--widths','390'],clipped);assert.equal(clip.status,1);assert.match(clip.stderr,/clip the sort control/);
  const title=fixture('title');inject(title,'d/presentation/child','js',"document.querySelector('.path-column-label').removeAttribute('title');");
  const missing=cli('breadcrumb/header',['--page',collection,'--widths','390'],title);assert.equal(missing.status,1);assert.match(missing.stderr,/full title/);
  const gap=fixture('sort-gap');inject(gap,'d/presentation/child','js',"document.addEventListener('click',event=>{if(event.target.closest('[data-collection-sort-toggle]'))document.querySelector('.path-column-separator').style.marginInline='12px';});");
  const changed=cli('breadcrumb/header',['--page',collection,'--widths','390'],gap);assert.equal(changed.status,1);assert.match(changed.stderr,/retain header spacing/);
});

for(const {name,suffix} of engines){
test(name+' checks collection startup, sort previews and deep canvas geometry',{timeout:30000},()=>{
  for(const route of [collection,'/discover/tooling/devtools/',collection+'#sorts=date-asc,date-asc']) {
    const state=report(cli('canvas/first-paint'+suffix,['--page',route,'--widths','390,1440']));
    assert.equal(state.browser,name);
    for(const result of state.details.cases)assert.equal(result.first.collection,true);
  }
  const state=report(cli('canvas/layout'+suffix,['--page',deep,'--widths','390,1280']));
  for(const result of state.details.cases)assert.ok(result.columns.length>=5&&result.scrollWidth>result.clientWidth);
});

test(name+' rejects late collection reordering, changed header spacing and column replacement',{timeout:30000},()=>{
  const order=fixture('order-'+name);inject(order,'d/presentation/child','js',"const list=document.querySelector('.item-list--path-column');list.append(list.querySelector('[data-list-item]'));");
  const reordered=cli('canvas/first-paint'+suffix,['--page',collection,'--widths','390'],order);assert.equal(reordered.status,1);assert.match(reordered.stderr,/retain SSR row order/);
  const gap=fixture('gap-'+name);inject(gap,'d/presentation/child','js',"document.querySelector('.path-column-separator').style.marginInline='12px';");
  const changed=cli('canvas/first-paint'+suffix,['--page',collection,'--widths','390'],gap);assert.equal(changed.status,1);assert.match(changed.stderr,/retain header spacing/);
  const nodes=fixture('nodes-'+name);inject(nodes,'d/presentation/child','js',"const nav=document.querySelector('[data-slot=breadcrumb]');nav.replaceWith(nav.cloneNode(true));");
  const replaced=cli('canvas/first-paint'+suffix,['--page',collection,'--widths','390'],nodes);assert.equal(replaced.status,1);assert.match(replaced.stderr,/reuse its reserved/);
});

test(name+' rejects inconsistent canvas gaps, detached columns and nested horizontal scrollers',{timeout:30000},()=>{
  const gap=fixture('layout-gap-'+name);inject(gap,'d/presentation/child/two/three/four/article-4','css','.page-shell{column-gap:3px!important}');
  const uneven=cli('canvas/layout'+suffix,['--page',deep,'--widths','1280'],gap);assert.equal(uneven.status,1);assert.match(uneven.stderr,/share --page-shell-gap-inline/);
  const detached=fixture('layout-detached-'+name);inject(detached,'d/presentation/child/two/three/four/article-4','js',"document.querySelector('.page').append(document.querySelector('[data-slot=breadcrumb] [data-collection-column]'));");
  const outside=cli('canvas/layout'+suffix,['--page',deep,'--widths','1280'],detached);assert.equal(outside.status,1);assert.match(outside.stderr,/same canvas grid/);
  const nested=fixture('layout-scroll-'+name);inject(nested,'d/presentation/child/two/three/four/article-4','js',"const nav=document.querySelector('[data-slot=breadcrumb]'),group=document.createElement('div');group.style.cssText='display:grid;grid-auto-flow:column;grid-auto-columns:240px;inline-size:240px;overflow-x:auto';nav.before(group);group.append(nav);");
  const scroller=cli('canvas/layout'+suffix,['--page',deep,'--widths','1280'],nested);assert.equal(scroller.status,1);assert.match(scroller.stderr,/nested horizontal scroller/);
});
}
