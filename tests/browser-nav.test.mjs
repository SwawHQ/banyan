import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {anchorsCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/nav/anchors/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';
import {loadChromium,loadWebkit} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'.agents/skills/swaw-banyan'),parent=fs.realpathSync(os.tmpdir());
const sharedCommands=['nav/anchors','nav/keyboard','prose/layout'];
const engines=[
  {name:'chromium',suffix:'',commands:['nav/sort',...sharedCommands]},
  {name:'webkit',suffix:'.webkit',commands:sharedCommands}
];
const routes={'nav/sort':'/all/','nav/anchors':'/d/swban-nav-long/','nav/keyboard':'/appearance/','prose/layout':'/about/'};
let work,skill,output;
function write(file,text) { fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text); }
function cli(name,args=[],directory=output) {
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/'+name,'entry.mjs'),directory,...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error); return result;
}
function fixture(name) { const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory; }
function script(directory,route,code) {
  write(path.join(directory,'probe.js'),code);
  fs.appendFileSync(path.join(directory,route,'index.html'),'<script src="/probe.js"></script>');
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-nav-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime='node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content');
  const front=(title,url)=>`---\ntitle: "${title}"\nslug: "${url.split('/').filter(Boolean).at(-1)}"\nurl: "${url}"\ndate: "2026-01-01T00:00:00+08:00"\ndraft: false\n---\n\n`;
  write(path.join(content,'d/swban-nav-long.md'),front('Z Navigation Fixture',routes['nav/anchors'])+'## First Chapter\n\n'+('An article paragraph with enough text to exercise the real reading column.\n\n'.repeat(40))+'## Last Chapter\n\nEnd.');
  for (const name of ['one','two']) write(path.join(content,'d/swban-nav-'+name+'.md'),front('A Duplicate Name','/d/swban-nav-'+name+'/')+'A second article with a stable, distinct URL.');
  for(const [name,title,time] of [
    ['earlier','Z earlier second','2026-01-01T12:00:01+08:00'],
    ['later','A later second','2026-01-01T12:00:02+08:00'],
    ['tie-a','A date tie','2026-01-01T12:00:03+08:00'],
    ['tie-z','Z date tie','2026-01-01T12:00:03+08:00']
  ])write(path.join(content,'d/swban-sort-'+name+'.md'),front(title,'/d/swban-sort-'+name+'/').replace('2026-01-01T00:00:00+08:00',time)+'Date precision and name tie fixture.');
  const config=path.join(work,'fixture.toml');
  write(config,`[[module.mounts]]\nsource = ${JSON.stringify(content.replaceAll('\\','/'))}\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`);
  const build=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{
    cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000
  });
  assert.ifError(build.error);assert.equal(build.status,0,build.stdout+build.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('anchor pages are required and help exposes the same argument contract',()=>{
  const spec=anchorsCommand('check/browser/nav/anchors');
  assert.throws(()=>parseArguments(spec,[]),/--page is required/);
  assert.equal(parseArguments(spec,['--page','/article/#from=all']).page,'/article/#from=all');
  assert.match(helpFor(spec,'en').split('\n')[0],/ --page <path>/);
  assert.doesNotMatch(helpFor(spec,'en').split('\n')[0],/\[--page/);
  assert.equal(parseArguments(spec,['--page','/article/#chapter']).page,'/article/#chapter');
  for(const args of [['--page','//elsewhere'],['--page','/a/','--page','/b/']]) assert.throws(()=>parseArguments(spec,args));
});

for(const {name,suffix,commands} of engines){
test(name+' runs its published checks and records real results',{timeout:30000},()=>{
  for(const command of commands){
    const route=routes[command];
    const result=cli(command+suffix,['--page',route,'--trace','--out',path.join(work,'reports')]);
    assert.equal(result.status,0,result.stdout+result.stderr);
    const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
    assert.equal(report.browser,name);assert.ok(fs.statSync(path.join(folder,'trace.zip')).size>0);
    if(command==='nav/sort') {
      assert.ok(report.details.rows>=8);assert.equal(report.details.dates.cases.length,2);
      const {keys}=report.details.dates.cases[0];
      const fixtureKeys=keys.filter(key=>key.startsWith('/d/swban-sort-'));
      assert.deepEqual(fixtureKeys,['earlier','later','tie-a','tie-z'].map(name=>'/d/swban-sort-'+name+'/'));
    }
    if(command==='nav/anchors') assert.ok(report.details.before>0&&report.details.after===0);
  }
  assert.equal(fs.existsSync(path.join(work,'node_modules')),false);
});
}

test('chromium catches replacement of the sort grid and loss of source links',{timeout:15000},()=>{
  const replaced=fixture('replaced');
  script(replaced,'all',`document.addEventListener('click',event=>{
    const control=event.target.closest('[data-sort-field="name"]'),grid=control?.closest('[data-sortable]');
    if(grid&&!grid.className) queueMicrotask(()=>grid.replaceWith(grid.cloneNode(true)));
  });`);
  const result=cli('nav/sort',[],replaced);assert.equal(result.status,1);assert.match(result.stderr,/reuse its grid/);
  const lost=fixture('lost');
  script(lost,'all',`document.addEventListener('click',event=>{
    const control=event.target.closest('[data-sort-field="name"]'),grid=control?.closest('[data-sortable]');
    if(grid&&!grid.className) queueMicrotask(()=>grid.querySelectorAll('[data-list-entry]').forEach(link=>{
      const url=new URL(link.href);const fields=new URLSearchParams(url.hash.slice(1));fields.delete('from');url.hash=fields.toString();link.href=url.href;
    }));
  });`);
  const links=cli('nav/sort',[],lost);assert.equal(links.status,1);assert.match(links.stderr,/article link with its declared source/);
});

test('chromium catches blocked value cells and detached values',{timeout:15000},()=>{
  const pointer=fixture('pointer');
  write(path.join(pointer,'broken.css'),'[data-list-item] > [data-item-field="date"]{pointer-events:none!important}');
  fs.appendFileSync(path.join(pointer,'all/index.html'),'<link rel="stylesheet" href="/broken.css">');
  const blocked=cli('nav/sort',[],pointer);assert.equal(blocked.status,1);assert.match(blocked.stderr,/remain pointer targets/);
  const cells=fixture('cells');
  script(cells,'all',`document.addEventListener('click',event=>{
    const control=event.target.closest('[data-sort-field="name"]'),grid=control?.closest('[data-sortable]');
    if(grid&&!grid.className) queueMicrotask(()=>grid.querySelector('[data-list-item] > [data-item-field="date"]').textContent='Detached value');
  });`);
  const result=cli('nav/sort',[],cells);assert.equal(result.status,1);assert.match(result.stderr,/all of its cell values/);
});

test('chromium accepts selectable text clipped by fixed field widths',{timeout:10000},()=>{
  const clipped=fixture('clipped-value');
  write(path.join(clipped,'clipped.css'),':root{--item-date-inline:1.5rem}');
  fs.appendFileSync(path.join(clipped,'all/index.html'),'<link rel="stylesheet" href="/clipped.css">');
  const result=cli('nav/sort',['--timeout','5000'],clipped);
  assert.equal(result.status,0,result.stdout+result.stderr);
});

test('chromium rejects unselectable values and replaced row containers',{timeout:15000},()=>{
  const selection=fixture('selection');
  write(path.join(selection,'broken.css'),'[data-list-item] > [data-item-field="date"]{user-select:none!important}');
  fs.appendFileSync(path.join(selection,'all/index.html'),'<link rel="stylesheet" href="/broken.css">');
  const blocked=cli('nav/sort',[],selection);assert.equal(blocked.status,1);assert.match(blocked.stderr,/remain selectable with the mouse/);
  const replaced=fixture('replaced-row');
  script(replaced,'all',`document.addEventListener('click',event=>{
    const control=event.target.closest('[data-sort-field="name"]'),grid=control?.closest('[data-sortable]');
    if(grid&&!grid.className) queueMicrotask(()=>{
      const row=grid.querySelector('[data-list-item]'),replacement=row.cloneNode(false);
      replacement.append(...row.childNodes);row.replaceWith(replacement);
    });
  });`);
  const result=cli('nav/sort',[],replaced);assert.equal(result.status,1);assert.match(result.stderr,/reuse its grid, headers, complete rows and cells/);
});

test('chromium rejects pending navigation records created by in-place sorting',{timeout:15000},()=>{
  const pending=fixture('pending-sort');
  script(pending,'all',`document.addEventListener('click',event=>{
    if(event.target.closest('[data-sort-field]'))sessionStorage.setItem('banyan:canvas-navigation','unexpected');
  },true);`);
  const result=cli('nav/sort',[],pending);
  assert.equal(result.status,1);assert.match(result.stderr,/sorting must not create a pending canvas navigation/);
});

test('chromium rejects shortened date keys and a descending sort with ascending name ties',{timeout:15000},()=>{
  const precision=fixture('date-precision');
  script(precision,'all',`document.querySelectorAll('.slot-main [data-sort-date]').forEach(head=>{if(head.dataset.sortDate)head.dataset.sortDate=head.dataset.sortDate.slice(0,8);});`);
  const short=cli('nav/sort',[],precision);assert.equal(short.status,1);assert.match(short.stderr,/second-level precision/);
  const tie=fixture('date-tie');
  // Mutate after all click listeners; a microtask can run between native listeners.
  script(tie,'all',`document.addEventListener('click',event=>{
    const control=event.target.closest('[data-sort-field="date"]');if(!control)return;
    requestAnimationFrame(()=>{
      const grid=control.closest('[data-sortable]');
      const rows=[...grid.querySelectorAll(':scope > [data-list-item]')];
      const positions=rows.flatMap((row,index)=>row.querySelector('[data-list-entry]').href.includes('/swban-sort-tie-')?[index]:[]);
      if(positions.length!==2)throw new Error('Date tie fixture must contain two rows.');
      const ascending=positions.map(index=>rows[index]).sort((a,b)=>a.dataset.sortName.localeCompare(b.dataset.sortName,undefined,{numeric:true}));
      positions.forEach((index,offset)=>{rows[index]=ascending[offset];});
      rows.forEach(row=>grid.append(row));
    });
  });`);
  const wrong=cli('nav/sort',[],tie);assert.equal(wrong.status,1);assert.match(wrong.stderr,/complete group\/date\/name\/href tuple: desc/);
});

for(const {name,suffix} of engines){
test(name+' catches a misdirected skip link',{timeout:15000},()=>{
  const skip=fixture('skip-'+name);
  script(skip,'d/swban-nav-long',`document.querySelector('.skip-link').href='#missing-main';`);
  const anchors=cli('nav/anchors'+suffix,['--page',routes['nav/anchors'],'--timeout','1000'],skip);
  assert.equal(anchors.status,1);assert.match(anchors.stderr,/Timeout 1000ms/);
});

test(name+' catches keyboard traps and overflowing prose URLs',{timeout:15000},()=>{
  const trap=fixture('trap-'+name);
  script(trap,'appearance',`const button=document.createElement('button');button.textContent='Keyboard trap';document.querySelector('[data-root-navigation]').after(button);`);
  const keyboard=cli('nav/keyboard'+suffix,[],trap);assert.equal(keyboard.status,1);assert.match(keyboard.stderr,/next visible column/);
  const prose=fixture('prose-'+name);
  write(path.join(prose,'broken.css'),'#test-long a{white-space:nowrap!important;overflow-wrap:normal!important}');
  fs.appendFileSync(path.join(prose,'about/index.html'),'<link rel="stylesheet" href="/broken.css">');
  const layout=cli('prose/layout'+suffix,[],prose);assert.equal(layout.status,1);assert.match(layout.stderr,/Long URLs must fit/);
});

test(name+' detects ordinary table style loss and Chroma style leakage',{timeout:15000},()=>{
  for(const [fixtureName,cssText,message] of [
    ['ordinary-table','.prose [data-prose-table-fixture="ordinary"]{display:table!important}','Ordinary Markdown tables'],
    ['chroma-table','.prose .lntable{display:block!important;border-collapse:collapse!important}','Chroma line-number tables']
  ]) {
    const broken=fixture(fixtureName+'-'+name);write(path.join(broken,'broken.css'),cssText);
    fs.appendFileSync(path.join(broken,'about/index.html'),'<link rel="stylesheet" href="/broken.css">');
    const result=cli('prose/layout'+suffix,[],broken);assert.equal(result.status,1);assert.ok(result.stderr.includes(message),result.stderr);
  }
});

test(name+' rejects an article without headings and honors alternate page paths',{timeout:15000},()=>{
  const noHeading=cli('nav/anchors'+suffix,['--page','/about/']);assert.equal(noHeading.status,1);assert.match(noHeading.stderr,/native heading anchor/);
  const translated=cli('prose/layout'+suffix,['--page','/zh/about/']);assert.equal(translated.status,0,translated.stdout+translated.stderr);
  const article=cli('nav/keyboard'+suffix,['--page',routes['nav/anchors']]);assert.equal(article.status,0,article.stdout+article.stderr);
});

test(name+' prevents stale scheduled chapter reveals from overriding the skip link',{timeout:15000},async()=>{
  const server=await createStaticSiteServer(output),type=name==='chromium'?loadChromium():loadWebkit();
  let browser;
  try {
    await server.start();browser=await type.launch({executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
    context.setDefaultTimeout(5000);
    const page=await context.newPage(),url=server.getBaseUrl()+routes['nav/anchors'];
    await page.goto(url,{waitUntil:'load'});
    const id=await page.locator('.prose h2[id]').last().getAttribute('id');
    // Hold theme callbacks to exercise a pending chapter reveal deterministically.
    await page.evaluate(()=>{
      const original=window.requestAnimationFrame;
      window.__heldFrames=[];
      window.__releaseFrames=()=>{
        window.requestAnimationFrame=original;
        for(const callback of window.__heldFrames.splice(0))callback(performance.now());
      };
      window.requestAnimationFrame=callback=>{window.__heldFrames.push(callback);return 0;};
      window.addEventListener('hashchange',()=>{window.__heldHash=location.hash;});
    });
    await page.goto(url+'#'+encodeURIComponent(id));
    await page.waitForFunction(hash=>window.__heldFrames.length>0&&window.__heldHash===hash,'#'+encodeURIComponent(id));
    await page.locator('.skip-link').focus();await page.keyboard.press('Enter');
    await page.waitForURL(target=>target.hash==='#main');
    await page.waitForFunction(()=>document.querySelector('.page-content').scrollTop===0);
    const after=await page.evaluate(()=>{
      window.__releaseFrames();return document.querySelector('.page-content').scrollTop;
    });
    assert.equal(after,0,'A queued chapter reveal must honor the current fragment after skip navigation.');
  } finally {if(browser)await browser.close();await server.stop();}
});
}

test('anchor entry rejects a missing page',()=>{
  const missing=cli('nav/anchors');assert.equal(missing.status,1);assert.match(missing.stderr,/--page is required/);
});
