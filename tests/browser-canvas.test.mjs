import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {scrollbarCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/scrollbar/options.mjs';
import {historyCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/history/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=fs.realpathSync(os.tmpdir());
const engines=[{name:'chromium',suffix:''},{name:'webkit',suffix:'.webkit'}],commands=['scroll','scrollbar','history'];
const route='/d/canvas-first/?from=all',next='/d/canvas-next/?from=all';
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/canvas/'+command,directory,...args],{cwd:work,encoding:'utf8',timeout:45000});
  assert.ifError(result.error);return result;
}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function css(directory,text){write(path.join(directory,'broken.css'),text);fs.appendFileSync(path.join(directory,'d/canvas-first/index.html'),'<link rel="stylesheet" href="/broken.css">');}
function script(directory,text){write(path.join(directory,'probe.js'),text);for(const name of ['canvas-first','canvas-next'])fs.appendFileSync(path.join(directory,'d',name,'index.html'),'<script src="/probe.js"></script>');}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-canvas-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime=process.versions.bun?'bun':'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun??process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  let body='Leading article text to exercise native scrolling.\n\n';
  for(let i=0;i<24;i++)body+='## Chapter '+i+'\n\n'+('A paragraph with enough words to exercise independent columns and history restoration.\n\n'.repeat(8));
  for(const name of ['canvas-first','canvas-next'])write(path.join(content,'d',name+'.md'),
    '---\ntitle: '+name+'\nslug: '+name+'\nurl: /d/'+name+'/\ndate: "2026-01-01T00:00:00+08:00"\nlastmod: "2026-01-02T00:00:00+08:00"\n---\n\n'+body);
  write(config,`[[module.mounts]]\nsource = ${JSON.stringify(content.replaceAll('\\','/'))}\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n`);
  const built=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(built.error);assert.equal(built.status,0,built.stdout+built.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('canvas paths, widths, touch and history arguments have generated help',()=>{
  const spec=scrollbarCommand('scrollbar','Scrollbar');
  assert.throws(()=>parseArguments(spec,[]),/--page is required/);
  const options=parseArguments(spec,['--page',route,'--widths','390,1800','--touch']);
  assert.equal(options.page,route);assert.equal(options.widths,'390,1800');assert.equal(options.touch,true);
  assert.match(helpFor(spec),/--touch/);assert.match(helpFor(spec),/default: 390,768,1800/);
  assert.throws(()=>parseArguments(spec,['--page',route,'--widths','390,390']),/distinct integers/);
  const history=historyCommand('history','History');
  assert.throws(()=>parseArguments(history,['--page',route]),/--next is required/);
  assert.throws(()=>parseArguments(history,['--page',route,'--next','https://example.com/']));
  assert.equal(parseArguments(history,['--page',route,'--next',next]).next,next);
  assert.match(helpFor(history),/--next/);
});

for(const {name,suffix} of engines){
test(name+' runs scroll, scrollbar and history on independent article fixtures',{timeout:30000},()=>{
  for(const command of commands){
    const args=['--page',route,'--out',path.join(work,'reports')];
    if(command==='history')args.push('--next',next);else args.push('--widths','390,1440');
    const result=cli(command+suffix,args);assert.equal(result.status,0,command+'\n'+result.stdout+result.stderr);
    const folder=result.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
    assert.equal(report.browser,name);assert.ok(report.browserVersion);assert.equal(report.details.page,route);
    if(command==='scroll')assert.ok(report.details.cases.some(state=>state.pannedX>0));
    if(command==='scrollbar') {
      assert.equal(report.details.cases.length,3,'Resizing must return to the first width.');
      assert.equal(typeof report.details.cases[0].resized.supportsColor,'boolean','Reports must declare native color support.');
    }
    if(command==='history')assert.equal(report.details.next,next);
  }
  assert.equal(fs.existsSync(path.join(work,'node_modules')),false);
});

test(name+' checks mobile scrollbar activity and native color capability',{timeout:15000},()=>{
  const result=cli('scrollbar'+suffix,['--page',route,'--widths','390,768','--touch']);assert.equal(result.status,0,result.stdout+result.stderr);
});

test(name+' checks collection scrolling without an article aside',{timeout:15000},()=>{
  const result=cli('scroll'+suffix,['--page','/all/','--widths','390,1440']);assert.equal(result.status,0,result.stdout+result.stderr);
});

test(name+' rejects coupled columns and document vertical overflow',{timeout:20000},()=>{
  const coupled=fixture('coupled-'+name);script(coupled,"document.querySelector('#document-aside').addEventListener('scroll',()=>{document.querySelector('.page-content').scrollTop=0;});");
  const scroll=cli('scroll'+suffix,['--page',route,'--widths','390'],coupled);assert.equal(scroll.status,1);assert.match(scroll.stderr,/without changing another column/);
  const vertical=fixture('vertical-'+name);css(vertical,'body{min-height:200vh!important}');
  const overflow=cli('scroll'+suffix,['--page',route,'--widths','390'],vertical);assert.equal(overflow.status,1);assert.match(overflow.stderr,/extend the document vertically/);
});

test(name+' rejects broken scrollbar activity and changed active spacing',{timeout:20000},()=>{
  const blocked=fixture('blocked-'+name);script(blocked,"document.addEventListener('scroll',event=>{if(event.target.matches?.('.page-content'))event.stopImmediatePropagation();},true);");
  const inactive=cli('scrollbar'+suffix,['--page',route,'--widths','390','--timeout','1500'],blocked);assert.equal(inactive.status,1);assert.match(inactive.stderr,/Timeout 1500ms/);
  if(name==='chromium') {
    const hidden=fixture('hidden-'+name);css(hidden,'[data-scrolling]{scrollbar-color:transparent transparent!important}');
    const active=cli('scrollbar'+suffix,['--page',route,'--widths','390'],hidden);assert.equal(active.status,1);assert.match(active.stderr,/reveal native scrollbar colors/);
  }
  const gap=fixture('gap-'+name);css(gap,'.page-content[data-scrolling]{margin-right:20px!important}');
  const moved=cli('scrollbar'+suffix,['--page',route,'--widths','390'],gap);assert.equal(moved.status,1);assert.match(moved.stderr,/preserve the aside gap/);
});

test(name+' rejects manual history restoration and duplicate article URLs',{timeout:15000},()=>{
  const reset=fixture('reset-'+name);script(reset,"history.scrollRestoration='manual';");
  const result=cli('history'+suffix,['--page',route,'--next',next],reset);assert.equal(result.status,1);assert.match(result.stderr,/browser must own history/);
  const same=cli('history'+suffix,['--page',route,'--next',route]);assert.equal(same.status,1);assert.match(same.stderr,/different article URLs/);
});
}
