import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {toggleCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/aside/toggle/options.mjs';
import {canvasLayoutCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/layout/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=fs.realpathSync(os.tmpdir());
const engines=[{name:'chromium',suffix:''},{name:'webkit',suffix:'.webkit'}];
const commands=['aside/toggle','aside/chapters','aside/layout','aside/style','aside/print','canvas/layout'];
const route='/d/aside-fixture/#from=all';
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/'+command,'entry.mjs'),directory,...args],{cwd:work,encoding:'utf8',timeout:45000});
  assert.ifError(result.error);return result;
}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function css(directory,text){write(path.join(directory,'broken.css'),text);fs.appendFileSync(path.join(directory,'d/aside-fixture/index.html'),'<link rel="stylesheet" href="/broken.css">');}
function script(directory,text){write(path.join(directory,'probe.js'),text);fs.appendFileSync(path.join(directory,'d/aside-fixture/index.html'),'<script src="/probe.js"></script>');}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-aside-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime='node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  const front='---\ntitle: Portable Aside\nslug: aside-fixture\nurl: /d/aside-fixture/\ndate: "2026-01-01T00:00:00+08:00"\nlastmod: "2026-01-02T00:00:00+08:00"\n---\n\n';
  let body=('Leading article text to exercise independent reading progress.\n\n'.repeat(12));
  for(let i=0;i<20;i++)body+=(i%2?'###':'##')+' Chapter '+i+' 测试 '+('long heading words '.repeat(i===10?8:1))+'\n\n'+('A paragraph with enough words to exercise the reading column and native chapter links.\n\n'.repeat(6));
  write(path.join(content,'d/aside-fixture.md'),front+body);
  write(config,`[[module.mounts]]\nsource = ${JSON.stringify(content.replaceAll('\\','/'))}\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`);
  const built=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(built.error);assert.equal(built.status,0,built.stdout+built.stderr);
},{timeout:60000});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('aside paths, viewport widths and touch options have one argument contract',()=>{
  const spec=toggleCommand('check/browser/aside/toggle');
  assert.throws(()=>parseArguments(spec,[]),/--page is required/);
  const options=parseArguments(spec,['--page',route,'--widths','0320,390','--touch']);
  assert.equal(options.page,route);assert.equal(options.widths,'320,390');assert.equal(options.touch,true);
  assert.match(helpFor(spec,'en'),/--touch/);assert.match(helpFor(spec,'en'),/default: 390,768,1800/);
  for(const widths of ['','319','3841','390,390','390,','390px','390, 768','-320'])assert.throws(()=>parseArguments(spec,['--page',route,'--widths',widths]));
  const layout=canvasLayoutCommand('check/browser/canvas/layout');
  assert.equal(parseArguments(layout,[]).height,900);
  assert.equal(parseArguments(layout,['--height','844']).height,844);
  for(const height of ['0','239','3841','844px','1.5'])assert.throws(()=>parseArguments(layout,['--height',height]));
  assert.match(helpFor(layout,'en'),/--height/);
});

for(const {name,suffix} of engines){
test(name+' runs all six checks on generated articles without site npm',{timeout:45000},()=>{
  for(const command of commands){
    const args=['--page',route,'--out',path.join(work,'reports')];
    if(command!=='aside/print')args.push('--widths','390,1440');
    if(command==='aside/toggle')args.push('--trace');
    const result=cli(command+suffix,args);assert.equal(result.status,0,command+'\n'+result.stdout+result.stderr);
    const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
    assert.equal(report.browser,name);assert.ok(report.browserVersion);assert.equal(report.details.page,route);
    if(command==='aside/toggle')assert.ok(fs.statSync(path.join(folder,'trace.zip')).size>0);
    if(command==='aside/chapters')assert.equal(report.details.noScript,true);
  }
  assert.equal(fs.existsSync(path.join(work,'node_modules')),false);
});

test(name+' runs real taps in a mobile context',{timeout:20000},()=>{
  const result=cli('aside/toggle'+suffix,['--page',route,'--widths','390,430','--touch']);assert.equal(result.status,0,result.stdout+result.stderr);
});

test(name+' rejects a visible first-frame aside and broken Escape handling',{timeout:20000},()=>{
  const visible=fixture('visible-'+name);css(visible,'#document-aside{display:block!important}');
  const initial=cli('aside/toggle'+suffix,['--page',route,'--widths','390'],visible);assert.equal(initial.status,1);assert.match(initial.stderr,/collapsed before its controller/);
  const escape=fixture('escape-'+name);script(escape,"document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();}},true);");
  const result=cli('aside/toggle'+suffix,['--page',route,'--widths','390'],escape);assert.equal(result.status,1);assert.match(result.stderr,/Escape must close/);
});

test(name+' rejects reordered chapters and disabled native fragment links',{timeout:20000},()=>{
  const order=fixture('order-'+name);script(order,"const list=document.querySelector('.document-toc ul');list.append(list.children[1]);");
  const wrong=cli('aside/chapters'+suffix,['--page',route,'--widths','390'],order);assert.equal(wrong.status,1);assert.match(wrong.stderr,/match published headings/);
  const blocked=fixture('blocked-'+name);script(blocked,"document.querySelector('.document-toc').addEventListener('click',event=>event.preventDefault());");
  const result=cli('aside/chapters'+suffix,['--page',route,'--widths','390','--timeout','1000'],blocked);assert.equal(result.status,1);assert.match(result.stderr,/Timeout 1000ms/);
});

test(name+' rejects an aside gap, mismatched control styles and clipped print',{timeout:20000},()=>{
  const gap=fixture('gap-'+name);css(gap,'#document-aside{margin-left:20px!important}');
  const layout=cli('aside/layout'+suffix,['--page',route,'--widths','390'],gap);assert.equal(layout.status,1);assert.match(layout.stderr,/declared column gap/);
  const styles=fixture('styles-'+name);css(styles,'#document-aside-toggle{color:red!important}');
  const style=cli('aside/style'+suffix,['--page',route,'--widths','390'],styles);assert.equal(style.status,1);assert.match(style.stderr,/reuse navigation hover/);
  const print=fixture('print-'+name);css(print,'@media print{.page-content{max-height:200px!important;overflow:hidden!important}}');
  const printed=cli('aside/print'+suffix,['--page',route],print);assert.equal(printed.status,1);assert.match(printed.stderr,/without clipping/);
});

test(name+' rejects divergent canvas widths and accepts translated paths',{timeout:15000},()=>{
  const broken=fixture('canvas-'+name);css(broken,'.path-column{inline-size:100px!important}');
  const canvas=cli('canvas/layout'+suffix,['--page',route,'--widths','390'],broken);assert.equal(canvas.status,1);assert.match(canvas.stderr,/share a width/);
  const translated=cli('canvas/layout'+suffix,['--page','/zh/about/','--widths','390,1024']);assert.equal(translated.status,0,translated.stdout+translated.stderr);
});

test(name+' rejects hidden or duplicate roots and footer overlap at the requested height',{timeout:20000},()=>{
  const hidden=fixture('root-hidden-'+name);css(hidden,'[data-root-navigation] [data-root-href]:first-child{visibility:hidden!important}');
  const invisible=cli('canvas/layout'+suffix,['--page',route,'--widths','390','--height','844'],hidden);
  assert.equal(invisible.status,1);assert.match(invisible.stderr,/Every root entry must remain visible/);
  const duplicate=fixture('root-duplicate-'+name);script(duplicate,"const nav=document.querySelector('[data-root-navigation]');nav.after(nav.cloneNode(true));");
  const repeated=cli('canvas/layout'+suffix,['--page',route,'--widths','390'],duplicate);
  assert.equal(repeated.status,1);assert.match(repeated.stderr,/one root navigation/);
  const overlap=fixture('root-footer-'+name);script(overlap,"const footer=document.createElement('footer');footer.className='slot-footer';footer.textContent='Fault footer';footer.style.cssText='position:fixed;top:0;left:0;display:block';document.querySelector('.page-rail').prepend(footer);");
  const covered=cli('canvas/layout'+suffix,['--page',route,'--widths','390','--height','844'],overlap);
  assert.equal(covered.status,1);assert.match(covered.stderr,/footer must align below root navigation/);
  const result=cli('canvas/layout'+suffix,['--page',route,'--widths','390,1024','--height','844','--out',path.join(work,'height-reports')]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
  assert.ok(report.details.cases.every(state=>state.height===844&&state.rootNavigationCount===1&&state.rootEntriesVisible));
});

test(name+' rejects uneven metadata row spacing',{timeout:15000},()=>{
  const broken=fixture('metadata-gap-'+name);css(broken,'.document-meta__row:nth-child(2){margin-top:6px!important}');
  const result=cli('aside/style'+suffix,['--page',route,'--widths','390'],broken);
  assert.equal(result.status,1);assert.match(result.stderr,/Metadata rows must have uniform spacing/);
});
}
