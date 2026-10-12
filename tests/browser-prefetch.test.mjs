import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {command as rulesCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/prefetch/rules/options.mjs';
import {command as overlapCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/prefetch/overlap/options.mjs';
import {command as debugCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/prefetch/debug/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan');
const parent=fs.realpathSync(os.tmpdir()),page='/prefetch-probe/',debugPage='/diagnostics/prefetch/';
let work,skill,full,partial,worker,off;
const faults={};
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(name,directory=full,args=[]) {
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/prefetch/'+name,directory,
    '--page',name==='debug'?debugPage:page,'--timeout','2000',...args],{cwd:work,encoding:'utf8',timeout:15000});
  assert.ifError(result.error);return result;
}
function passed(name,directory=full,args=[]) {
  const result=cli(name,directory,['--out',path.join(work,'reports'),...args]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8')).details;
}
function fails(name,directory,pattern,args=[]) {
  const result=cli(name,directory,args);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,pattern);
}
function output(name,from=full) {
  const directory=path.join(work,name);fs.cpSync(from,directory,{recursive:true});return directory;
}
function headers(directory,change) {
  const file=path.join(directory,'_headers');write(file,change(fs.readFileSync(file,'utf8')));
}
function rulesFile(directory) {return path.join(directory,'site','speculation-rules',fs.readdirSync(path.join(directory,'site','speculation-rules'))[0]);}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-prefetch-'));skill=path.join(work,'skill');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime=process.versions.bun?'bun':'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.bun??process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),layouts=path.join(work,'layouts'),config=path.join(work,'fixture.toml');
  const anchors=['nav','crumb','sort','desc','post'].map(slot=>'<a href="/probe-'+slot+'/" data-prefetch-slot="'+slot+'">Probe '+slot+'</a>').join('\n')+
    '<a href="/probe-nav/" data-prefetch-slot="crumb">Same URL in an unowned conservative slot</a>';
  write(path.join(layouts,'page-prefetch-probe.html'),'{{ define "main" }}<article class="article"><div class="prose"><h1>{{ .Title }}</h1>'+anchors+'</div></article>{{ end }}');
  const debugLayout=fs.readFileSync(path.join(root,'module/layouts/page-prefetch-debug.html'),'utf8');
  write(path.join(layouts,'page-prefetch-debug.html'),debugLayout.replace('{{ partial "entry-page-prefetch-debug/render.html" . }}',
    '{{ partial "entry-page-prefetch-debug/render.html" . }}'+anchors));
  for(const language of ['en','zh','zh-tw']) {
    const prefix=language==='en'?'':'/'+language,suffix=language==='en'?'':'.'+language;
    write(path.join(content,'prefetch-probe/index'+suffix+'.md'),'---\ntitle: Independent prefetch probe\nslug: prefetch-probe\nurl: '+prefix+page+'\nlayout: page-prefetch-probe\n---\n');
    write(path.join(content,'diagnostics/index'+suffix+'.md'),'---\ntitle: Independent diagnostics\nslug: prefetch-diagnostics\nurl: '+prefix+debugPage+'\nlayout: page-prefetch-debug\nrobots: noindex, follow\nprefetch_debug:\n  loading_label: 正在读取预取状态\n---\n');
  }
  for(const slot of ['nav','crumb','sort','desc','post'])write(path.join(content,'probe-'+slot+'/index.md'),'---\ntitle: Target '+slot+'\nslug: probe-'+slot+'\nurl: /probe-'+slot+'/\nlayout: page-article\n---\n');
  const mount=(directory,target)=>'[[module.mounts]]\nsource = '+JSON.stringify(directory.replaceAll('\\','/'))+'\ntarget = "'+target+'"\n';
  const mounts=mount(content,'content')+mount('content','content')+mount(layouts,'layouts')+mount('layouts','layouts');
  function build(name,partialRules=false,transport='link',asset,code,mode='header') {
    const assets=path.join(work,name+'-assets');if(asset)write(path.join(assets,'js/prefetch/'+asset),code);
    let text=mounts+(asset?mount(assets,'assets')+mount('assets','assets'):'')+
      '[params.service_worker]\nmode="enable"\n[params.prefetch_runtime]\nmode="enable"\n[params.prefetch_runtime.env.TT]\n'+
      ['nav','crumb','sort_siblings','descendants','post'].map((slot,index)=>slot+'="'+transport+'_'+(index===1?'s':index===4?'m':'x')+'f"\n').join('')+
      '[params.prefetch_runtime.env.FT]\nref=""\nnav="sw_xf"\ncrumb="sw_sf"\nsort_siblings="sw_xf"\ndescendants="sw_xf"\npost="sw_mf"\n'+
      '[params.speculation_rules]\nmode="'+mode+'"\nruntime_coordination="preempt_runtime_when_supported"\nnav="prefetch_eager"\n'+
      ['crumb','sort_siblings','descendants','post'].map(slot=>slot+'="'+(partialRules?'off':'prefetch_eager')+'"\n').join('')+
      '[params.build]\nversion="v20261010002001"\n';
    write(config,text);
    const destination=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',destination],
      {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return destination;
  }
  full=build('full');partial=build('partial',true);worker=build('worker',true,'sw');off=build('off',false,'link',undefined,undefined,'off');
  const entry=fs.readFileSync(path.join(root,'module/assets/js/prefetch/runtime-entry.js.tmpl'),'utf8');
  const owned=/const specOwnedSlotSet = new Set\(resolveActiveSpeculationOwnedSlots\([\s\S]*?\n    \)\);/;
  const actions=/const actions = buildRuntimeActions\([\s\S]*?\n    \);/;
  assert.match(entry,owned);assert.match(entry,actions);
  faults.unsuppressed=build('unsuppressed',false,'link','runtime-entry.js.tmpl',entry.replace(owned,'const specOwnedSlotSet = new Set();'));
  faults['all-off']=build('all-off',true,'link','runtime-entry.js.tmpl',entry.replace(actions,'const actions = {};'));
  faults.late=build('late',false,'link','runtime-entry.js.tmpl',entry.replace('(function () {',
    '(function () { setTimeout(()=>{const link=document.createElement("link");link.rel="prefetch";link.dataset.prefetchLink="runtime";link.href=document.querySelector("a[data-prefetch-slot=nav]").href;document.head.appendChild(link);},150);'));
  const debug=fs.readFileSync(path.join(root,'module/assets/js/prefetch/debug-page.js'),'utf8');
  for(const [name,search,replacement] of [
    ['debug-support','speculationRules: speculationRulesSupported','speculationRules: false'],
    ['debug-active','preemptionActive: ownedSlotDetails.preemptionActive','preemptionActive: false'],
    ['debug-filtered','filteredActions: filteredActions','filteredActions: {}'],
    ['debug-suppressed','suppressedActions: suppressedActions','suppressedActions: {}'],
    ['debug-meta','runtimeMeta: runtimeMeta || null','runtimeMeta: {}'],
    ['debug-header',"speculationRulesHeader: speculationHeaderState.header || ''","speculationRulesHeader: ''"]
  ]) {
    assert.ok(debug.includes(search));faults[name]=build(name,true,'link','debug-page.js',debug.replace(search,replacement));
  }
},{timeout:60000});
after(()=>{if(work){assert.equal(path.dirname(work),parent);assert.ok(path.basename(work).startsWith('banyan-browser-prefetch-'));fs.rmSync(work,{recursive:true,force:true});}});

test('prefetch declarations expose expected mode, eager slots and explicit page boundaries',()=>{
  assert.equal(parseArguments(rulesCommand(),[]).expect,'header');
  for(const factory of [overlapCommand,debugCommand])assert.throws(()=>parseArguments(factory(),[]),/--page is required/);
  for(const value of ['inline','disabled'])assert.throws(()=>parseArguments(rulesCommand(),['--expect',value]));
  for(const value of ['nav,nav','unknown',''])assert.throws(()=>parseArguments(rulesCommand(),['--eager',value]));
  for(const factory of [rulesCommand,overlapCommand,debugCommand]) {
    assert.throws(()=>parseArguments(factory(),['--page','https://outside.invalid/']));
    assert.match(helpFor(factory()),/--page <path>/);
  }
});

test('rules identify a real browser request and accepted rule set on independent translated paths',{timeout:15000},()=>{
  const detail=passed('rules',full,['--eager','nav,sort','--trace']);
  assert.ok(detail.ruleSet.requestId);assert.equal(detail.status,200);assert.equal(detail.enabled,true);
  // Run another language and preserve its query without tying the task to /all/.
  const result=spawnSync(process.execPath,[path.join(skill,'scripts.js/swban.mjs'),'check/browser/prefetch/rules',full,'--page','/zh'+page+'?keep=yes'],
    {cwd:work,encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(passed('rules',off,['--expect','off']).enabled,false);
});

test('rules fail missing headers, failed assets and invalid MIME even when page JS fetches JSON',{timeout:20000},()=>{
  const missing=output('missing-header');headers(missing,text=>text.replace(/^\s*Speculation-Rules:.*\r?\n/gm,''));
  fails('rules',missing,/response must declare/);
  const absent=output('missing-asset');fs.unlinkSync(rulesFile(absent));fails('rules',absent,/Chromium must register|must return 200/);
  const mime=output('bad-mime');headers(mime,text=>text.replace('Content-Type: application/speculationrules+json','Content-Type: application/json'));
  const html=path.join(mime,page,'index.html'),asset='/fake-rule-fetch.js',url='/site/speculation-rules/'+path.basename(rulesFile(mime));
  write(path.join(mime,asset),'void fetch('+JSON.stringify(url)+');');
  write(html,fs.readFileSync(html,'utf8').replace('</head>','<script defer src="'+asset+'"></script></head>'));
  fails('rules',mime,/Chromium must register|application\/speculationrules/);
});

test('Chromium parser errors fail for invalid JSON and partially valid rule documents',{timeout:12000},()=>{
  const invalid=output('invalid-json');write(rulesFile(invalid),'{broken');fails('rules',invalid,/Chromium rejected rules/);
  const partialJSON=output('invalid-rule');const payload=JSON.parse(fs.readFileSync(rulesFile(partialJSON),'utf8'));
  payload.prefetch.push({source:'document',where:{selector_matches:'a'},eagerness:'not-an-eagerness'});
  write(rulesFile(partialJSON),JSON.stringify(payload));fails('rules',partialJSON,/Chromium rejected rules/);
});

test('off mode and explicit eager expectations detect wrong delivery and configuration',{timeout:15000},()=>{
  fails('rules',full,/Off mode must not send/,['--expect','off']);
  const inline=output('inline-rules',off),file=path.join(inline,page,'index.html');
  write(file,fs.readFileSync(file,'utf8').replace('</head>','<script type="speculationrules">{"prefetch":[]}</script></head>'));
  fails('rules',inline,/inline speculationrules/,['--expect','off']);
  fails('rules',partial,/Missing expected eager prefetch slot: sort/,['--eager','sort']);
  fails('rules',off,/--eager cannot/,['--expect','off','--eager','nav']);
});

test('overlap preserves unowned eager and focused actions for both link and real worker transports',{timeout:15000},()=>{
  const owned=passed('overlap');assert.equal(owned.remaining.length,0);assert.equal(owned.actions.length,0);
  for(const directory of [partial,worker]) {
    const detail=passed('overlap',directory);assert.ok(detail.remaining.length);assert.ok(detail.actions.length);
    assert.ok(detail.actions.every(href=>!detail.suppressed.includes(href)));
    if(directory===worker)assert.ok(detail.recorded.messages.length);else assert.ok(detail.recorded.links.length);
  }
});

test('overlap catches missing suppression, delayed duplicates and disabling all runtime actions',{timeout:15000},()=>{
  for(const name of ['unsuppressed','late'])fails('overlap',faults[name],/Runtime must not prefetch speculation-owned/);
  fails('overlap',faults['all-off'],/still execute eager\/focused actions/);
});

test('debug diagnostics match page payloads with partial ownership, shared URLs and custom loading copy',{timeout:15000},()=>{
  assert.equal(Object.keys(passed('debug').panels['actions-filtered'].filteredActions).length,0);
  assert.ok(Object.keys(passed('debug',partial).panels['actions-filtered'].filteredActions).length);
});

test('debug diagnostics detect false capabilities, preemption, filtering and payload metadata',{timeout:25000},()=>{
  for(const [name,message] of [['debug-support',/actual speculation support/],['debug-active',/active preemption/],
    ['debug-filtered',/retain actions in unowned/],['debug-suppressed',/exactly the suppressed/],
    ['debug-meta',/preserve runtime metadata/],['debug-header',/actual response header/]])fails('debug',faults[name],message);
});

test('debug rejects missing panels and broken JSON without recognizing a loading label',{timeout:15000},()=>{
  const missing=output('missing-panel'),file=path.join(missing,debugPage,'index.html');
  write(file,fs.readFileSync(file,'utf8').replace('id=prefetch-debug-payload','id=missing-panel').replace('id="prefetch-debug-payload"','id="missing-panel"'));
  fails('debug',missing,/Missing prefetch debug panel: payload/);
  const broken=output('broken-panels'),html=path.join(broken,debugPage,'index.html');
  write(html,fs.readFileSync(html,'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,script=>script.includes('prefetch/debug-page.')?'':script));
  fails('debug',broken,/Timeout|timeout/);
});

test('reports cannot be written into the published build',()=>{
  for(const name of ['rules','overlap','debug']) {
    const out=path.join(full,'forbidden-'+name),result=cli(name,full,['--out',out]);
    assert.equal(result.status,1);assert.match(result.stderr,/outside the published build/);assert.equal(fs.existsSync(out),false);
  }
});
