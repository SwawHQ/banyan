import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteMounts,fixtureContentDirectory,directoryPage} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {sortCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/breadcrumb/sort/options.mjs';
import {isolationCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/breadcrumb/isolation/options.mjs';
import {sourceCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/breadcrumb/source/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-breadcrumb');
const article='/d/breadcrumb-fixture/one/',collection='/d/breadcrumb-fixture/';
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/breadcrumb/'+command,'entry.mjs'),directory,...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function script(directory,route,text){write(path.join(directory,'probe.js'),text);fs.appendFileSync(path.join(directory,route,'index.html'),'<script defer src="/probe.js"></script>');}
function settledScript(directory,route,text){script(directory,route,`const fail=()=>{${text}};const html=document.documentElement;
  const pending=()=>html.hasAttribute('data-entry-breadcrumb-pending')||html.hasAttribute('data-breadcrumb-sort-pending');
  if(pending()){const observer=new MutationObserver(()=>{if(!pending()){observer.disconnect();fail();}});
    observer.observe(html,{attributes:true,attributeFilter:['data-entry-breadcrumb-pending','data-breadcrumb-sort-pending']});
  }else fail();`);}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-breadcrumb-'));skill=path.join(work,'skill');output=path.join(work,'public');
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
  write(path.join(content,'d/breadcrumb-fixture/_index.md'),'---\ntitle: Breadcrumb Fixture\n---\n');
  write(path.join(content,'d/breadcrumb-fixture/child/_index.md'),'---\ntitle: Child\n---\n');
  write(path.join(content,'d/breadcrumb-fixture/child/nested.md'),'---\ntitle: Nested\nurl: d/breadcrumb-fixture/child/nested/\ndate: 2026-01-01\n---\nNested content.');
  for(const [index,name] of ['one','two','three','four','five','six'].entries())write(path.join(content,'d/breadcrumb-fixture',name+'.md'),
    `---\ntitle: ${name}\nurl: ${collection+name}/\ndate: "2026-01-0${index+1}T00:00:00+08:00"\n---\n\n## Chapter\n\n`+'Text for the source-column fixture.\n\n'.repeat(20));
  for(const suffix of ['','.zh','.zh-tw']) {
    write(path.join(content,'discover','_index'+suffix+'.md'),directoryPage('Sources'));
    write(path.join(content,'discover/tooling','_index'+suffix+'.md'),directoryPage('Tooling'));
    write(path.join(content,'discover/tooling/devtools','_index'+suffix+'.md'),directoryPage('Devtools'));
  }
  write(path.join(content,'discover/tooling/_map.toml'),"refs = [\"/d/breadcrumb-fixture/one\",\"/d/breadcrumb-fixture/three\",\"/d/breadcrumb-fixture/five\"]\n");
  write(path.join(content,'discover/tooling/devtools/_map.toml'),"refs = [\"/d/breadcrumb-fixture/two\",\"/d/breadcrumb-fixture/four\",\"/d/breadcrumb-fixture/six\"]\n");
  write(config,`[[module.mounts]]\nsource = ${JSON.stringify(content.replaceAll('\\','/'))}\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`+fixtureSiteMounts);
  const build=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(build.error);assert.equal(build.status,0,build.stdout+build.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('breadcrumb options require explicit paths and generate complete help',{timeout:45000},()=>{
  for(const factory of [sortCommand,isolationCommand,sourceCommand])assert.throws(()=>parseArguments(factory('check','Check'),[]),/--page is required/);
  const spec=sourceCommand('check/browser/breadcrumb/source');
  assert.throws(()=>parseArguments(spec,['--page','/page/','--column','/all/']),/--article is required/);
  assert.throws(()=>parseArguments(spec,['--page','/page/','--column','/all/?x=1','--article','/article/']),/must not contain a query/);
  assert.match(helpFor(spec,'en'),/--column <path>/);assert.match(helpFor(spec,'en'),/--article <path>/);
});

test('JSON loading retains reserved columns and sorting retains rows, source, query and fragment',{timeout:45000},()=>{
  const result=cli('sort',['--page',collection+'child/#sorts=date-desc,date-asc','--column',collection,'--trace','--out',path.join(work,'reports')]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
  assert.equal(report.browser,'chromium');assert.ok(report.browserVersion);assert.equal(report.details.cases.length,2);
  assert.equal(report.details.initialRows,0);assert.ok(report.details.reservedColumns>0);
  assert.equal(report.details.sourceRebuilt,true);assert.ok(fs.statSync(path.join(folder,'trace.zip')).size>0);
  assert.ok(report.details.prefetch.entries>=7);
  assert.ok(report.details.cases.every(result=>result.prefetch.invalid.length===0));
});

test('sort checks in-place reuse after an explicit source rebuild',{timeout:20000},()=>{
  const result=cli('sort',['--page',article+'#from=all','--column','/all/','--out',path.join(work,'reports')]);assert.equal(result.status,0,result.stdout+result.stderr);
  const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
  assert.equal(report.details.sourceRebuilt,true);assert.ok(report.details.prefetch.entries>0);
});

test('isolation covers ancestors and main collections, including sort previews without from',{timeout:45000},()=>{
  for(const route of [article+'#from=d/breadcrumb-fixture',collection+'#from=d/breadcrumb-fixture&sort=date-asc&sorts=date-asc,date-asc',collection+'#sort=date-asc&sorts=date-asc,date-asc']) {
    const result=cli('isolation',['--page',route]);assert.equal(result.status,0,route+'\n'+result.stdout+result.stderr);
  }
});

test('native collections and articles work without JavaScript while JSON paths retain source sorting',{timeout:45000},()=>{
  for(const query of ['','#from=discover/tooling','#sorts=date-desc,date-asc']) {
    const result=cli('source',['--page','/discover/tooling/devtools/'+query,'--column','/discover/tooling/','--article',article]);
    assert.equal(result.status,0,query+'\n'+result.stdout+result.stderr);
  }
});

test('sort rejects initial node replacement and click-time loss of focus or query data',{timeout:45000},()=>{
  const replaced=fixture('replaced');script(replaced,article,`const column=document.querySelector('[data-slot=breadcrumb] .path-column:last-child');column.replaceWith(column.cloneNode(true));`);
  const initial=cli('sort',['--page',article,'--column',collection],replaced);assert.equal(initial.status,1);assert.match(initial.stderr,/retain reserved column nodes/);
  for(const [name,change,message] of [
    ['focus','document.activeElement.blur()','retain toggle focus'],
    ['query',`node.querySelectorAll('[data-list-entry]').forEach(link=>{const url=new URL(link.href);url.searchParams.delete('swban-probe');link.href=url.href;})`,'preserve unrelated link query'],
    ['nodes','node.replaceWith(node.cloneNode(true))','reuse rows, icons and headers'],
    ['record',`sessionStorage.setItem('banyan:canvas-navigation','unexpected')`,'must not create a navigation record'],
    ['blank',`node.style.visibility='hidden';requestAnimationFrame(()=>requestAnimationFrame(()=>node.style.removeProperty('visibility')))`,'must not show a blank frame']
  ]) {
    const broken=fixture(name);script(broken,article,`document.addEventListener('click',event=>{const node=event.target.closest('[data-collection-column]');if(node&&event.target.closest('[data-collection-sort-toggle]')){${change}}});`);
    const result=cli('sort',['--page',article,'--column',collection],broken);assert.equal(result.status,1);assert.ok(result.stderr.includes(message),result.stderr);
  }
});

test('sort rejects legacy prefetch markers after source hydration and direction changes',{timeout:20000},()=>{
  for(const [name,code] of [
    ['hydrated-slot',`document.addEventListener('DOMContentLoaded',()=>{const ready=()=>{if(document.documentElement.hasAttribute('data-entry-breadcrumb-pending')||document.documentElement.hasAttribute('data-breadcrumb-sort-pending'))requestAnimationFrame(ready);else document.querySelector('[data-slot=breadcrumb] [data-list-entry]').dataset.prefetchSlot='nav';};requestAnimationFrame(ready);});`],
    ['sort-slot',`document.addEventListener('click',event=>{if(event.target.closest('[data-collection-sort-toggle]'))document.querySelector('[data-slot=breadcrumb] [data-list-entry]').dataset.prefetchSlot='crumb';});`],
    ['header-slot',`document.addEventListener('DOMContentLoaded',()=>{const ready=()=>{if(document.documentElement.hasAttribute('data-entry-breadcrumb-pending')||document.documentElement.hasAttribute('data-breadcrumb-sort-pending'))requestAnimationFrame(ready);else document.querySelector('[data-slot=breadcrumb] a:not([data-list-entry])').dataset.prefetchSlot='nav';};requestAnimationFrame(ready);});`]
  ]) {
    const broken=fixture(name);script(broken,article,code);
    const result=cli('sort',['--page',article+'#from=all','--column','/all/'],broken);
    assert.equal(result.status,1);assert.match(result.stderr,/Runtime breadcrumb anchors/);
  }
});

test('isolation rejects changed siblings and stale main-entry sort slots',{timeout:45000},()=>{
  const sibling=fixture('sibling');script(sibling,article,`document.addEventListener('click',event=>{if(!event.target.closest('[data-collection-sort-toggle]'))return;const own=event.target.closest('[data-collection-column]');const other=[...document.querySelectorAll('[data-collection-column]')].find(node=>node!==own);other.querySelector('[data-sort-indicator]').textContent='broken';});`);
  const result=cli('isolation',['--page',article+'#from=d/breadcrumb-fixture'],sibling);assert.equal(result.status,1);assert.match(result.stderr,/another column order or indicator/);
  const links=fixture('stale-links');script(links,collection,`document.addEventListener('click',event=>{if(event.target.closest('[data-collection-sort-toggle]'))document.querySelectorAll('.slot-main [data-list-entry]').forEach(link=>{const url=new URL(link.href);const fields=new URLSearchParams(url.hash.slice(1));fields.set('sorts','date-asc,date-asc');url.hash=fields.toString();link.href=url.href;});});`);
  const stale=cli('isolation',['--page',collection+'#sort=date-asc&sorts=date-asc'],links);assert.equal(stale.status,1);assert.match(stale.stderr,/reflect each ancestor sort/);
});

test('source rejects wrong native and runtime lineage, missing links and malformed pages',{timeout:45000},()=>{
  const runtime=fixture('runtime-source');settledScript(runtime,'discover/tooling/devtools',`document.querySelectorAll('[data-slot=breadcrumb] [data-list-entry]').forEach(link=>{const url=new URL(link.href);if(url.pathname===${JSON.stringify(article)}){const fields=new URLSearchParams(url.hash.slice(1));fields.set('from','wrong');url.hash=fields.toString();link.href=url.href;}});`);
  const args=['--page','/discover/tooling/devtools/','--column','/discover/tooling/','--article',article];
  const result=cli('source',args,runtime);assert.equal(result.status,1);assert.match(result.stderr,/declared column source/);
  const raw=fixture('static-source'),file=path.join(raw,'discover/tooling/index.html');
  const text=fs.readFileSync(file,'utf8'),changed=text.replaceAll(article+'#from=discover/tooling',article+'#from=wrong');
  assert.notEqual(changed,text);fs.writeFileSync(file,changed);
  const staticResult=cli('source',args,raw);assert.equal(staticResult.status,1);assert.match(staticResult.stderr,/declared column source/);
  const missing=cli('source',[...args.slice(0,-1),'/missing/']);assert.equal(missing.status,1);assert.match(missing.stderr,/requested article exactly once/);
  const noColumns=cli('isolation',['--page','/about/']);assert.equal(noColumns.status,1);assert.match(noColumns.stderr,/Choose two sortable/);
});
