import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteMounts,fixtureContentDirectory,directoryPage} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {openCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/open/options.mjs';
import {firstPaintCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/first-paint/options.mjs';
import {command as touchCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/touch/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';
import {loadChromium,loadWebkit} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {waitForBrowse} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/viewport.mjs';
import {readRootState,checkRootSelection} from '../.agents/skills/swaw-banyan/tasks/check/browser/nav/_shared/root.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-opening');
const engines=[{name:'chromium',suffix:''},{name:'webkit',suffix:'.webkit'}],commands=['open','first-paint'];
const route='/d/canvas-first/#from=all',next='/d/canvas-next/#from=all';
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/canvas/'+command,'entry.mjs'),directory,...args],{cwd:work,encoding:'utf8',timeout:45000});
  assert.ifError(result.error);return result;
}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function css(directory,text){write(path.join(directory,'broken.css'),text);fs.appendFileSync(path.join(directory,'d/canvas-first/index.html'),'<link rel="stylesheet" href="/broken.css">');}
function script(directory,text){write(path.join(directory,'probe.js'),text);for(const name of ['canvas-first','canvas-next'])fs.appendFileSync(path.join(directory,'d',name,'index.html'),'<script defer src="/probe.js"></script>');}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-opening-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime='node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  fixtureContentDirectory(content);
  let body='Leading article text to exercise native scrolling.\n\n';
  for(let i=0;i<24;i++)body+='## Chapter '+i+'\n\n'+('A paragraph with enough words to exercise independent columns and history restoration.\n\n'.repeat(8));
  for(const name of ['canvas-first','canvas-next'])write(path.join(content,'d',name+'.md'),
    `---\ntitle: ${name}\nurl: /d/${name}/\ndate: "2026-01-01T00:00:00+08:00"\nlastmod: "2026-01-02T00:00:00+08:00"\nparams:\n  offer:\n    version: "${name==='canvas-first'?'2.10':'2.9'}"\n    amount: ${name==='canvas-first'?20:10}\n    currency: "$"\n---\n\n${body}`);
  write(path.join(content,'d/root-only.md'),'---\ntitle: Root-only fixture\nurl: d/root-only/\nparams:\n  slots: []\n---\nRoot navigation without path columns.');
  for(const suffix of ['','.zh']) {
    write(path.join(content,'d/opening','_index'+suffix+'.md'),'---\ntitle: Nested Opening Fixture\n---\n');
    for(const name of ['one','two'])write(path.join(content,'d/opening',name+suffix+'.md'),
      '---\ntitle: '+name+'\nurl: '+(suffix?'/zh':'')+'/d/opening/'+name+'/\ndate: 2026-01-01\n---\n\n'+body);
  }
  for(const name of ['fixture-alpha','fixture-beta']) {
    write(path.join(content,'products',name,'_index.md'),`---\ntitle: ${name}\nlayout: page-collection-products\nparams:\n  slots: [ breadcrumb ]\n---\n`);
    write(path.join(content,'products',name,'_map.toml'),"refs = [\"/d/canvas-first\",\"/d/canvas-next\"]\n");
  }
  for(const suffix of ['','.zh','.zh-tw']) {
    write(path.join(content,'discover','_index'+suffix+'.md'),directoryPage('Sources'));
    write(path.join(content,'products','_index'+suffix+'.md'),directoryPage('Products'));
    write(path.join(content,'products-all','_index'+suffix+'.md'),'---\ntitle: All products\nlayout: page-collection-products-all\nparams:\n  aggregate: /products\n  slots: [ breadcrumb ]\n---\n');
    write(path.join(content,'discover','reference-note'+suffix+'.md'),'---\ntitle: Reference note\nurl: p/reference-note/\ndate: 2026-01-01\n---\n\nA short reference fixture.');
    write(path.join(content,'discover/tooling','_index'+suffix+'.md'),directoryPage('Tooling'));
    write(path.join(content,'discover/tooling/devtools','_index'+suffix+'.md'),directoryPage('Devtools'));
  }
  write(path.join(content,'discover/tooling/_map.toml'),"refs = [\"/discover/reference-note\"]\n");
  write(path.join(content,'discover/tooling/devtools/_map.toml'),"refs = [\"/d/canvas-first\",\"/d/canvas-next\"]\n");
  write(config,`[taxonomies]\n[[module.mounts]]\nsource = ${JSON.stringify(content.replaceAll('\\','/'))}\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`+fixtureSiteMounts);
  const built=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(built.error);assert.equal(built.status,0,built.stdout+built.stderr);
},{timeout:60000});

test('touch requires two local paths and fixes native mobile input',()=>{
  const spec=touchCommand();
  assert.throws(()=>parseArguments(spec,[]),/--page is required/);
  assert.throws(()=>parseArguments(spec,['--page',route]),/--next is required/);
  assert.equal(parseArguments(spec,['--page',route,'--next',next]).page,route);
  for(const page of ['https://outside.invalid/','//outside/'])
    assert.throws(()=>parseArguments(spec,['--page',page,'--next',next]));
  assert.match(helpFor(spec,'en'),/--next/);
});

test('Chromium uses real drags across roots, prose and metadata before native Back',{timeout:30000},()=>{
  const result=cli('touch',['--page',route,'--next',next,'--trace','--out',path.join(work,'touch-reports')]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
  assert.equal(report.browser,'chromium');assert.equal(report.details.page,route);
  assert.ok(report.details.position.x>0&&report.details.position.y>0);
  assert.ok(Math.abs(report.details.restored.x-report.details.position.x)<=1);
  for(const region of ['root','prose','aside'])assert.ok(report.details.events.some(event=>event.trusted&&event.region===region));
  assert.ok(fs.statSync(path.join(folder,'trace.zip')).size>0);
  assert.equal(cli('touch',['--page',route,'--next',route]).status,1);
});

test('native touch rejects blocked scrolling and accidental link navigation',{timeout:30000},()=>{
  const blocked=fixture('touch-blocked');css(blocked,'[data-root-navigation] [data-root-href]{touch-action:pan-y!important}');
  const pan=cli('touch',['--page',route,'--next',next],blocked);
  assert.equal(pan.status,1);assert.match(pan.stderr,/root link must move the canvas|Native dragging must reveal the reading column/);
  const navigation=fixture('touch-navigation');
  script(navigation,"document.addEventListener('touchstart',event=>{if(event.target.closest('[data-root-navigation]'))location.href='/appearance/';},{once:true});");
  const link=cli('touch',['--page',route,'--next',next],navigation);
  assert.equal(link.status,1);assert.match(link.stderr,/Dragging.*(activate|request)/);
});

test('native touch rejects cross-axis resets, blocked reading and manual history',{timeout:45000},()=>{
  const reset=fixture('touch-cross-axis');
  script(reset,"document.addEventListener('touchmove',()=>{document.querySelector('.page-content').scrollTop+=20;},{passive:true});");
  const changed=cli('touch',['--page',route,'--next',next],reset);
  assert.equal(changed.status,1);assert.match(changed.stderr,/preserve the vertical reading position/);
  const vertical=fixture('touch-reading');css(vertical,'.page-content{touch-action:pan-x!important}');
  const reading=cli('touch',['--page',route,'--next',next],vertical);
  assert.equal(reading.status,1);assert.match(reading.stderr,/scroll the long article vertically/);
  const history=fixture('touch-history');script(history,"history.scrollRestoration='manual';");
  const manual=cli('touch',['--page',route,'--next',next],history);
  assert.equal(manual.status,1);assert.match(manual.stderr,/browser must own history restoration/);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('opening and first-paint options declare paths, widths, pan and touch',()=>{
  const spec=openCommand('check/browser/canvas/open');
  assert.throws(()=>parseArguments(spec,[]),/--from is required/);
  assert.throws(()=>parseArguments(spec,['--from','/all/']),/--page is required/);
  const options=parseArguments(spec,['--from','/all/#sort=name-desc','--page','/d/canvas-first/','--widths','390,1440','--pan','120','--touch']);
  assert.equal(options.pan,120);assert.equal(options.touch,true);assert.equal(options.from,'/all/#sort=name-desc');
  for(const pan of ['-1','1.5','no','9007199254740992'])assert.throws(()=>parseArguments(spec,['--from','/all/','--page','/article/','--pan',pan]));
  assert.throws(()=>parseArguments(spec,['--from','/all/','--page','/article/#from=all']),/article pathname/);
  assert.match(helpFor(spec,'en'),/--touch/);assert.match(helpFor(spec,'en'),/default: 390,1024,1440/);
  const paint=firstPaintCommand('check/browser/canvas/first-paint');
  assert.throws(()=>parseArguments(paint,[]),/--page is required/);assert.match(helpFor(paint,'en'),/default: 390,1440/);
  assert.equal(parseArguments(paint,['--page',route,'--root','none']).root,'');
  assert.equal(parseArguments(paint,['--page',route,'--root','/all/']).root,'/all/');
  for(const root of ['https://outside.invalid/','//outside/','/all/#from=bad','/all/#fragment'])
    assert.throws(()=>parseArguments(paint,['--page',route,'--root',root]));
  assert.match(helpFor(paint,'en'),/--root <path\|none>/);
});

test('native drag opening uses real touch and retains source sort and history',{timeout:30000},()=>{
  const args=['--from','/all/#sort=name-desc','--page','/d/canvas-first/','--widths','390','--touch','--drag','160'];
  const result=cli('open',[...args,'--trace','--out',path.join(work,'drag-reports')]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
  const state=report.details.cases[0];assert.ok(state.drag.after.x>0);assert.equal(state.drag.after.y,state.drag.before.y);
  assert.equal(new URLSearchParams(new URL(state.target,'http://fixture').hash.slice(1)).get('sort'),'name-desc');
  assert.equal(state.history.back,state.before.canvasOffsetX);
  assert.ok(fs.statSync(path.join(folder,'trace.zip')).size>0);
  const blocked=fixture('opening-drag-blocked');
  write(path.join(blocked,'drag.css'),'*{touch-action:none!important}');
  fs.appendFileSync(path.join(blocked,'all/index.html'),'<link rel="stylesheet" href="/drag.css">');
  const stopped=cli('open',args,blocked);assert.equal(stopped.status,1);assert.match(stopped.stderr,/Real touch input must pan/);
});

test('native drag opening rejects incompatible options and engines',{timeout:30000},()=>{
  const args=['--from','/all/','--page','/d/canvas-first/','--widths','390','--drag','160'];
  for(const [extra,message] of [[[],/requires --touch/],[['--touch','--pan','0'],/cannot be combined/]]) {
    const result=cli('open',[...args,...extra]);assert.equal(result.status,1);assert.match(result.stderr,message);
  }
  const wide=cli('open',['--from','/all/','--page','/d/canvas-first/','--widths','1440','--touch','--drag','160']);
  assert.equal(wide.status,1);assert.match(wide.stderr,/widths <= 430/);
  const outside=cli('open',[...args.slice(0,-1),'1000','--touch']);
  assert.equal(outside.status,1);assert.match(outside.stderr,/inside every viewport/);
  const webkit=cli('open.webkit',[...args,'--touch']);assert.equal(webkit.status,1);assert.match(webkit.stderr,/Unknown or repeated option/);
  for(const drag of ['0','-1','1.5','invalid'])assert.throws(()=>parseArguments(openCommand('check/browser/canvas/open'),
    ['--from','/all/','--page','/article/','--drag',drag]),/positive integer/);
});

for(const {name,suffix} of engines){
test(name+' opens sorted collections and observes initial layout with held scripts',{timeout:30000},()=>{
  for(const command of commands){
    const article=command==='open'?new URL(route,'http://fixture').pathname:route;
    const args=['--page',article,'--widths','390,1440','--out',path.join(work,'reports')];
    if(command==='open')args.push('--from','/all/#sort=name-desc','--trace');
    const result=cli(command+suffix,args);assert.equal(result.status,0,command+'\n'+result.stdout+result.stderr);
    const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
    assert.equal(report.browser,name);assert.ok(report.browserVersion);assert.equal(report.details.page,article);
    for(const state of report.details.cases){
      assert.ok(state.first.scriptsHeld>0);assert.equal(state.final.reservedColumnsRetained,true);
      if(command==='open'){
        assert.equal(state.from,'/all/#sort=name-desc');assert.ok(state.current.readingY>0);assert.equal(state.history.back,state.before.canvasOffsetX);
        assert.equal(new URLSearchParams(new URL(state.target,'http://fixture').hash.slice(1)).get('sort'),'name-desc');
      }
    }
    if(command==='open')assert.ok(fs.statSync(path.join(folder,'trace.zip')).size>0);
  }
  assert.equal(fs.existsSync(path.join(work,'node_modules')),false);
});

test(name+' opens a referenced directory and uses native taps',{timeout:20000},()=>{
  const result=cli('open'+suffix,['--from','/discover/tooling/devtools/','--page','/d/canvas-first/','--widths','390','--touch']);
  assert.equal(result.status,0,result.stdout+result.stderr);
});

test(name+' opens nested directories and product categories with retained lineage',{timeout:30000},()=>{
  for(const [from,page,root,sort] of [
    ['/d/opening/#sort=name-desc','/d/opening/one/','/d/','name-desc'],
    ['/zh/d/opening/#sort=name-desc','/zh/d/opening/one/','/zh/d/','name-desc'],
    ['/products/fixture-alpha/#sort=price-desc','/d/canvas-first/','/products/','price-desc'],
    ['/products-all/#sort=version-desc','/d/canvas-first/','/products-all/','version-desc']
  ]) {
    const result=cli('open'+suffix,['--from',from,'--page',page,'--widths','1440','--out',path.join(work,'lineage-reports')]);
    assert.equal(result.status,0,from+'\n'+result.stdout+result.stderr);
    const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
    const state=report.details.cases[0];
    assert.equal(state.source.root,root);assert.equal(state.lineage.sort,sort);
    assert.deepEqual(state.history.lineage.reload,state.lineage);assert.deepEqual(state.history.lineage.forward,state.lineage);
    assert.equal(state.lineage.columns.at(-1),new URL(from,'http://fixture').pathname);
  }
});

test(name+' opening rejects wrong roots, sibling order, ancestor selection and sort',{timeout:45000},()=>{
  const args=['--from','/discover/tooling/devtools/#sort=name-desc','--page','/d/canvas-first/','--widths','1440'];
  for(const [id,code,message] of [
    ['root',"document.querySelectorAll('[data-root-href]').forEach(link=>{const current=link.dataset.rootHref==='/all/';link.classList.toggle('is-current',current);if(current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});",/Root selection must match/],
    ['siblings',"const list=document.querySelector('.path-column .item-list');list.append(list.querySelector('[data-list-item]'));",/retain every source column/],
    ['ancestor',"const link=document.querySelector('.path-column [data-list-entry].is-current');link.classList.remove('is-current');link.removeAttribute('aria-current');",/Each source column must select/],
    ['sort',"const indicator=[...document.querySelectorAll('.path-column [data-sort-indicator]')].at(-1);indicator.textContent=indicator.textContent==='↑'?'↓':'↑';",/retain the collection sort/],
    ['home-prefix',"const navigation=JSON.parse(document.body.dataset.navigation);navigation.home='/wrong/';document.body.dataset.navigation=JSON.stringify(navigation);",/root|source column|ancestor/i]
  ]) {
    const broken=fixture('opening-'+id+'-'+name);
    const settled=['siblings','ancestor','sort'].includes(id);
    script(broken,settled?`const fail=()=>{${code}};const html=document.documentElement;
      const pending=()=>html.hasAttribute('data-entry-breadcrumb-pending')||html.hasAttribute('data-breadcrumb-sort-pending');
      if(pending()){const observer=new MutationObserver(()=>{if(!pending()){observer.disconnect();fail();}});
        observer.observe(html,{attributes:true,attributeFilter:['data-entry-breadcrumb-pending','data-breadcrumb-sort-pending']});
      }else fail();`:code);
    const result=cli('open'+suffix,args,broken);assert.equal(result.status,1,id+'\n'+result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test(name+' opening history rejects root repair on reload and changed siblings on Back',{timeout:30000},()=>{
  const args=['--from','/all/#sort=name-desc','--page','/d/canvas-first/','--widths','1440'];
  const reload=fixture('opening-reload-'+name);
  script(reload,"const visits=Number(sessionStorage.getItem('swban-opening-reload')||0)+1;sessionStorage.setItem('swban-opening-reload',String(visits));if(visits>1){const link=document.querySelector('[data-root-href].is-current');link.classList.remove('is-current');link.removeAttribute('aria-current');}");
  const lost=cli('open'+suffix,args,reload);assert.equal(lost.status,1);assert.match(lost.stderr,/Root selection must match/);
  const back=fixture('opening-back-'+name);write(path.join(back,'back.js'),"addEventListener('pageshow',()=>{const visits=Number(sessionStorage.getItem('swban-opening-back')||0)+1;sessionStorage.setItem('swban-opening-back',String(visits));if(visits>1)document.querySelector('main [data-list-item]').remove();});");
  fs.appendFileSync(path.join(back,'all/index.html'),'<script defer src="/back.js"></script>');
  const changed=cli('open'+suffix,args,back);assert.equal(changed.status,1);assert.match(changed.stderr,/Back must restore the collection source/);
});

test(name+' rejects replaced reserved columns and a layout moved by late scripts',{timeout:20000},()=>{
  const replaced=fixture('replaced-'+name);script(replaced,"const nav=document.querySelector('[data-slot=breadcrumb]');nav.replaceWith(nav.cloneNode(true));");
  const nodes=cli('first-paint'+suffix,['--page',route,'--widths','390'],replaced);assert.equal(nodes.status,1);assert.match(nodes.stderr,/reuse its reserved/);
  const moved=fixture('moved-'+name);script(moved,"document.querySelector('#main').style.marginInlineStart='45px';");
  const layout=cli('first-paint'+suffix,['--page',route,'--widths','390'],moved);assert.equal(layout.status,1);assert.match(layout.stderr,/Main must not move/);
});

test(name+' retains original directory metadata and rejects runtime rewrites',{timeout:30000},()=>{
  const good=cli('first-paint'+suffix,['--page',route,'--widths','390','--out',path.join(work,'metadata-reports')]);
  assert.equal(good.status,0,good.stdout+good.stderr);
  const folder=good.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
  const state=report.details.cases[0];assert.equal(state.first.directoryMetadata.length,4,'The fixture must retain its physical directory and three reference directories.');
  assert.ok(state.first.directoryMetadata.some(row=>row.html.includes('/d/')));
  assert.ok(state.first.directoryMetadata.some(row=>row.html.includes('/discover/tooling/devtools/')));
  assert.deepEqual(state.final.directoryMetadata,state.first.directoryMetadata);
  for(const [id,code] of [
    ['label',"document.querySelector('.document-meta__row--path').setAttribute('aria-label','Source path');"],
    ['link',"document.querySelector('.document-meta__row--path a').setAttribute('href','/all/');"],
    ['removed',"document.querySelector('.document-meta__row--path').remove();"]
  ]) {
    const changed=fixture('metadata-'+id+'-'+name);script(changed,code);
    const result=cli('first-paint'+suffix,['--page',route,'--widths','390'],changed);
    assert.equal(result.status,1,id+'\n'+result.stdout+result.stderr);assert.match(result.stderr,/retain the original article directory metadata/);
  }
});

test(name+' rejects a missing early position and an unconsumed navigation record',{timeout:20000},()=>{
  const early=fixture('early-'+name),article=path.join(early,'d/canvas-first/index.html');
  const html=fs.readFileSync(article,'utf8');
  let removed=0;
  fs.writeFileSync(article,html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g,(tag,code)=>{
    if(code.includes('banyan:canvas-navigation')){removed++;return '';}
    return tag;
  }));assert.equal(removed,1,'Fixture must remove the actual inline positioning controller.');
  const position=cli('open'+suffix,['--from','/all/','--page','/d/canvas-first/','--widths','390'],early);
  assert.equal(position.status,1);assert.match(position.stderr,/first animation frame/);
  const record=fixture('record-'+name);script(record,"sessionStorage.setItem('banyan:canvas-navigation','unconsumed');");
  const pending=cli('open'+suffix,['--from','/all/','--page','/d/canvas-first/','--widths','390'],record);
  assert.equal(pending.status,1);assert.match(pending.stderr,/one-navigation record must be consumed/);
});

test(name+' rejects current-entry reloads, reading resets and history overrides',{timeout:20000},()=>{
  const current=fixture('current-'+name);script(current,"document.addEventListener('click',event=>{if(event.target.closest('[data-slot=breadcrumb] [aria-current=page]'))document.querySelector('.page-content').scrollTop=0;},true);");
  const reset=cli('open'+suffix,['--from','/all/','--page','/d/canvas-first/','--widths','390'],current);
  assert.equal(reset.status,1);assert.match(reset.stderr,/preserve the reading position/);
  const reloaded=fixture('reloaded-'+name);script(reloaded,"document.addEventListener('click',event=>{if(event.target.closest('[data-slot=breadcrumb] [aria-current=page]')){event.preventDefault();location.reload();}},true);");
  const again=cli('open'+suffix,['--from','/all/','--page','/d/canvas-first/','--widths','390'],reloaded);
  assert.equal(again.status,1);assert.match(again.stderr,/new document|retain the document|Current article click failed/);
  const history=fixture('history-'+name);script(history,"history.scrollRestoration='manual';");
  const manual=cli('open'+suffix,['--from','/all/','--page','/d/canvas-first/','--widths','390'],history);
  assert.equal(manual.status,1);assert.match(manual.stderr,/browser must own history/);
});

test(name+' rejects missing article links, invisible pans and pages without source context',{timeout:20000},()=>{
  const missing=cli('open'+suffix,['--from','/all/','--page','/missing/','--widths','390']);
  assert.equal(missing.status,1);assert.match(missing.stderr,/requested article exactly once/);
  const outside=cli('open'+suffix,['--from','/all/','--page','/d/canvas-first/','--widths','390','--pan','100000']);
  assert.equal(outside.status,1);assert.match(outside.stderr,/within the source canvas/);
  const direct=cli('first-paint'+suffix,['--page','/about/','--widths','390']);
  assert.equal(direct.status,0,direct.stdout+direct.stderr);
  const translated=cli('first-paint'+suffix,['--page','/zh/p/reference-note/#from=discover/tooling','--widths','390']);
  assert.equal(translated.status,0,translated.stdout+translated.stderr);
});

test(name+' checks root selection before scripts on direct, valid, invalid and settings URLs',{timeout:30000},()=>{
  for(const [page,root] of [
    ['/d/canvas-first/','/d/'],
    ['/d/canvas-first/#from=all','/all/'],
    ['/d/canvas-first/#from=%2Fall%2F','/all/'],
    ['/d/canvas-first/#from=discover/tooling/devtools','/discover/'],
    ['/d/canvas-first/#from=discover/not-a-source','/d/'],
    ['/d/root-only/#from=all','/all/'],
    ['/appearance/?return=%2Fd%2Fcanvas-first%2F%3Ffrom%3Dall','/appearance/'],
    ['/zh/language/?return=%2Fd%2Fcanvas-first%2F%3Ffrom%3Dall','/zh/language/']
  ]) {
    const result=cli('first-paint'+suffix,['--page',page,'--root',root,'--widths','390']);
    assert.equal(result.status,0,page+'\n'+result.stdout+result.stderr);
  }
});

test(name+' rejects inconsistent root markers, wrong expectations and replaced root lists',{timeout:30000},()=>{
  const wrong=cli('first-paint'+suffix,['--page',route,'--root','none','--widths','390']);
  assert.equal(wrong.status,1);assert.match(wrong.stderr,/Root selection must match/);
  const markers=fixture('root-markers-'+name);
  script(markers,"document.querySelector('[data-root-navigation] [aria-current=page]').removeAttribute('aria-current');");
  const incoherent=cli('first-paint'+suffix,['--page',route,'--root','/all/','--widths','390'],markers);
  assert.equal(incoherent.status,1);assert.match(incoherent.stderr,/selection and aria-current must agree/);
  const repeated=fixture('root-repeated-'+name);
  script(repeated,"const list=document.querySelector('[data-root-navigation] .item-list');list.append(list.firstElementChild.cloneNode(true));");
  const duplicate=cli('first-paint'+suffix,['--page',route,'--widths','390'],repeated);
  assert.equal(duplicate.status,1);assert.match(duplicate.stderr,/Root entries must be unique/);
  const replaced=fixture('root-replaced-'+name);
  script(replaced,"const list=document.querySelector('[data-root-navigation] .item-list');list.append(list.firstElementChild);");
  const moved=cli('first-paint'+suffix,['--page',route,'--root','/all/','--widths','390'],replaced);
  assert.equal(moved.status,1);assert.match(moved.stderr,/retain the complete root list/);
});

test(name+' rejects late root repair even when settled selection is correct',{timeout:20000},()=>{
  const directory=fixture('root-late-'+name),article=path.join(directory,'d/root-only/index.html');
  const html=fs.readFileSync(article,'utf8');let removed=0;
  fs.writeFileSync(article,html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g,(tag,code)=>{
    if(code.includes('[data-root-href]')){removed++;return '';}
    return tag;
  }));assert.equal(removed,1,'Remove only the real early root-selection script.');
  write(path.join(directory,'late-root.js'),"document.querySelectorAll('[data-root-href]').forEach(link=>{const current=link.dataset.rootHref==='/all/';link.classList.toggle('is-current',current);if(current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});");
  fs.appendFileSync(article,'<script defer src="/late-root.js"></script>');
  const result=cli('first-paint'+suffix,['--page','/d/root-only/#from=all','--root','/all/','--widths','390','--out',path.join(work,'late-root-reports')],directory);
  assert.equal(result.status,1);assert.match(result.stderr,/Root selection must match/);
  const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
  assert.deepEqual(report.details.first.root.selected,['/d/']);
  assert.deepEqual(report.details.final.root.selected,['/all/'],'Late repair cannot hide a wrong initial root.');
  assert.equal(report.details.first.domContentLoaded,false);
});

test(name+' root selection survives reload and native Back/Forward',{timeout:15000},async()=>{
  const server=await createStaticSiteServer(output);let browser;
  try {
    await server.start();
    const type=name==='chromium'?loadChromium():loadWebkit();
    browser=await type.launch({executablePath:type.executablePath(),headless:true});
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),base=server.getBaseUrl();
    context.setDefaultTimeout(5000);context.setDefaultNavigationTimeout(5000);
    await page.goto(base+route);await waitForBrowse(page);
    const roots=(await readRootState(page)).roots;
    await checkRootSelection(page,'/all/',roots);
    await page.reload();await waitForBrowse(page);await checkRootSelection(page,'/all/',roots);
    const referenced='/d/canvas-first/#from=discover/tooling/devtools';
    await page.goto(base+referenced);await waitForBrowse(page);await checkRootSelection(page,'/discover/',roots);
    await page.goBack();assert.equal(page.url(),base+route);
    await waitForBrowse(page);await checkRootSelection(page,'/all/',roots);
    await page.goForward();assert.equal(page.url(),base+referenced);
    await waitForBrowse(page);await checkRootSelection(page,'/discover/',roots);
    // The same assertion used by consumer journeys must reject broken traversal state.
    await page.evaluate(()=>{
      const link=document.querySelector('[data-root-navigation] [aria-current=page]');
      // A pending history event must not repair the injected fault before it is read.
      new MutationObserver(()=>{
        if(link.hasAttribute('aria-current'))link.removeAttribute('aria-current');
      }).observe(link,{attributes:true,attributeFilter:['aria-current']});
      link.removeAttribute('aria-current');
    });
    await assert.rejects(()=>checkRootSelection(page,'/discover/',roots),/selection and aria-current must agree/);
  } finally {try {await browser?.close();}finally{await server.stop();}}
});
}
