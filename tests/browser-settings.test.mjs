import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {urlCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/settings/url/options.mjs';
import {historyCommand,pageList} from '../.agents/skills/swaw-banyan/tasks/check/browser/settings/history/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=fs.realpathSync(os.tmpdir());
const article='/d/settings-fixture/#from=all&sorts=name-asc&anchor=details';
const pages=['/prefs/one/','/prefs/appearance/','/prefs/plain/','/prefs/language/'];
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/settings/'+command,directory,...args],{cwd:work,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
function report(result){
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
function probe(directory,name,code,routes){
  write(path.join(directory,name+'.js'),code);
  for(const route of routes){
    const file=path.join(directory,route,'index.html'),html=fs.readFileSync(file,'utf8');
    write(file,html.replace('</head>','<script defer src="/'+name+'.js"></script></head>'));
  }
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-settings-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime=process.versions.bun?'bun':'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun??process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  write(path.join(content,'d/settings-fixture/index.md'),'---\ntitle: Independent settings source\nslug: settings-source\nurl: /d/settings-fixture/\ndate: 2026-01-01\n---\n\n## Details\n\nIndependent source content.');
  for(const lang of ['en','zh','zh-tw']) {
    const prefix=lang==='en'?'':'/'+lang,suffix=lang==='en'?'':'.'+lang;
    for(const [name,route] of [['my','one'],['appearance','appearance'],['language','language']]) {
      const text=fs.readFileSync(path.join(root,'module/content',name,'index'+suffix+'.md'),'utf8');
      write(path.join(content,name,'index'+suffix+'.md'),text.replace(/^---\r?\n/,'---\nurl: '+prefix+'/prefs/'+route+'/\n'));
    }
    write(path.join(content,'settings-plain/index'+suffix+'.md'),
      '---\ntitle: Independent plain settings\nslug: plain-settings\nlayout: page-article\nurl: '+prefix+'/prefs/plain/\nroot_nav: true\nicon: code\nweight: 85\nbuild:\n  list: local\n---\n\nPlain settings have browser Back and no custom Back link.');
  }
  write(config,'[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n');
  const build=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(build.error);assert.equal(build.status,0,build.stdout+build.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('settings declarations expose source fragments, page order and detailed help',()=>{
  const history=historyCommand('history','History'),url=urlCommand('url','URL');
  assert.throws(()=>parseArguments(history,[]),/--from is required/);
  assert.throws(()=>parseArguments(history,['--from',article]),/--pages is required/);
  assert.throws(()=>parseArguments(url,[]),/--page is required/);
  for(const value of ['/one/','/one/,/one/','/one/?return=x,/two/','/one/,https://example.invalid/'])assert.throws(()=>pageList(value));
  const options=parseArguments(history,['--from',article,'--pages',pages.join(',')]);
  assert.equal(options.from,article);assert.deepEqual(options.pages,pages);
  assert.match(helpFor(history),/--pages <paths>/);assert.match(helpFor(url),/--page <path>/);
});

test('settings URL checks retain unknown query, fragment and state through visits and reloads',{timeout:20000},()=>{
  for(const route of ['/prefs/language/','/prefs/appearance/','/prefs/one/','/prefs/plain/']) {
    const state=report(cli('url',['--page',route,'--out',path.join(work,'reports')]));
    assert.equal(state.details.cases.length,4);
    assert.deepEqual(state.details.cases.map(item=>item.phase),['visit','reload','visit','reload']);
  }
});

test('settings chains use one-step native history and language homes without prior history',{timeout:20000},()=>{
  const state=report(cli('history',['--from',article,'--pages',pages.join(','),'--trace','--out',path.join(work,'reports')]));
  assert.equal(state.details.returned,article);assert.deepEqual(state.details.steps,pages);
  assert.equal(state.details.empty.length,3);assert.ok(state.details.empty.every(item=>item.home==='/'));
  const translated=report(cli('history',['--from','/zh/all/#sort=name-asc&anchor=reading-position','--pages',pages.map(page=>'/zh'+page).join(','),'--out',path.join(work,'reports')]));
  assert.equal(translated.details.returned,'/zh/all/#sort=name-asc&anchor=reading-position');
  assert.ok(translated.details.empty.every(item=>item.home==='/zh/'));
});

test('URL checks detect stripped queries, fragments and caller history state',{timeout:20000},()=>{
  for(const [name,code,message] of [
    ['stripped-query','history.replaceState(history.state,"",location.pathname+location.hash);',/unused query and fragment/],
    ['stripped-fragment','history.replaceState(history.state,"",location.pathname+location.search);',/unused query and fragment/],
    ['stripped-state','history.replaceState(null,"",location.href);',/caller history state/]
  ]) {
    const broken=fixture(name);probe(broken,name,code,['prefs/appearance']);
    const result=cli('url',['--page','/prefs/appearance/'],broken);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('history checks reject rewritten root links and duplicated visits',{timeout:15000},()=>{
  for(const [name,code,message] of [
    ['rewritten-links','document.addEventListener("DOMContentLoaded",()=>{for(const link of document.querySelectorAll("[data-root-href]"))link.href+="?return=wrong";});',/ordinary URLs/],
    ['duplicate-history','history.pushState(history.state,"",location.href);',/one native history entry/]
  ]) {
    const broken=fixture(name);probe(broken,name,code,[name==='rewritten-links'?'d/settings-fixture':'prefs/one']);
    const result=cli('history',['--from',article,'--pages',pages.join(',')],broken);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});

test('history checks detect wrong Back, lost source state and broken no-history fallback',{timeout:20000},()=>{
  for(const [name,code,routes,message] of [
    ['wrong-back','document.addEventListener("click",event=>{if(event.target.closest("[data-page-action=back]")){event.preventDefault();event.stopImmediatePropagation();location.assign("/");}},true);',['prefs/language'],/Timeout/],
    ['lost-source-state','if(performance.getEntriesByType("navigation")[0]?.type==="back_forward")history.replaceState(null,"",location.href);',['d/settings-fixture'],/restore caller history state/],
    ['broken-empty-back','document.addEventListener("click",event=>{if(history.length===1&&event.target.closest("[data-page-action=back]")){event.preventDefault();event.stopImmediatePropagation();}},true);',['prefs/one'],/Timeout/]
  ]) {
    const broken=fixture(name);probe(broken,name,code,routes);
    const result=cli('history',['--from',article,'--pages',pages.join(','),'--timeout','1500'],broken);
    assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);
  }
});
