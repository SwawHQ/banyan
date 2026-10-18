import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import http from 'node:http';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {browserCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/options.mjs';
import {cspCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/csp/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const source = fileURLToPath(new URL('../.agents/skills/swaw-banyan/',import.meta.url));
const parent = fs.realpathSync(os.tmpdir());
const engines = [{name:'chromium',suffix:''},{name:'webkit',suffix:'.webkit'}];
let work,skill,site;
function write(root,name,text) {
  const file = path.join(root,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text);
}
function cli(command,args=[],cwd=site) {
  const result = spawnSync(process.execPath,[path.join(skill,'tasks',command,'entry.mjs'),...args],{cwd,encoding:'utf8',timeout:30000});
  assert.ifError(result.error); return result;
}
function output(name) {
  const root = path.join(work,name); fs.cpSync(path.join(site,'public'),root,{recursive:true}); return root;
}
function suite(options={}) {
  const result=spawnSync(process.execPath,[path.join(site,'suite.mjs'),JSON.stringify(options)],{cwd:site,encoding:'utf8',timeout:30000});
  assert.ifError(result.error);return result;
}
before(() => {
  work = fs.mkdtempSync(path.join(parent,'banyan-browser-test-'));
  skill = path.join(work,'skill'); site = path.join(work,'site');
  fs.cpSync(source,skill,{recursive:true,filter:file => !path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const dependencies = 'tasks/_shared/browser/node_modules';
  assert.ok(fs.existsSync(path.join(source,dependencies)), 'Run swban base/browser/ensure and base/browser/ensure.webkit before browser tests.');
  fs.symlinkSync(path.join(source,dependencies),path.join(skill,dependencies),'junction');
  const runtime = 'node';
  write(skill,'.tools/bindings.json',JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  write(site,'public/index.html','<!doctype html><html><head><title>Fixture</title><script src="/main.js"></script><script src="/js/browse/path-entry.fixture.js"></script></head><body><main class="slot-main">Browser fixture</main></body></html>');
  write(site,'public/main.js','document.title="Loaded by JavaScript";');
  write(site,'public/preload/index.html','<!doctype html><title>Preload fixture</title><link rel="preload" href="/main.js" as="script" crossorigin="anonymous"><script src="/main.js"></script><main class="slot-main">Preload fixture</main>');
  write(site,'public/js/browse/path-entry.fixture.js','void 0;');
  write(site,'public/_headers',"/*\n  Content-Security-Policy: default-src 'self'; script-src 'self'\n");
  const suiteModule=new URL('file:///'+path.join(skill,'tasks/check/browser/_shared/suite.mjs').replaceAll('\\','/')).href;
  const runtimeModule=new URL('file:///'+path.join(skill,'tasks/_shared/browser/runtime.mjs').replaceAll('\\','/')).href;
  write(site,'suite.mjs',[
    "import assert from 'node:assert/strict';",
    'import {runScenarioSuite} from '+JSON.stringify(suiteModule)+';',
    'import {loadWebkit} from '+JSON.stringify(runtimeModule)+';',
    'const options=JSON.parse(process.argv[2]);',
    'const first={id:"first",kind:"single",serviceWorkers:"block",async run({page,baseUrl,browser}){',
    '  await page.goto(baseUrl);assert.equal(await page.title(),"Loaded by JavaScript");',
    '  if(options.customLaunch)assert.notEqual(await page.evaluate(()=>navigator.userAgent),"SwbanLaunchFixture");',
    '  await page.evaluate(()=>localStorage.setItem("suite-probe","first"));return {title:await page.title()};}};',
    'const second={id:"second",kind:"single",serviceWorkers:"block",async run({page,baseUrl}){',
    '  await page.goto(baseUrl);assert.equal(await page.evaluate(()=>localStorage.getItem("suite-probe")),null);',
    '  if(options.fail){const error=new Error("Fixture scenario failed");error.details={phase:"second"};throw error;}return {isolated:true};}};',
    'const upgrade={id:"upgrade",kind:"upgrade",serviceWorkers:"block",async run({page,baseUrl,server,upgradePair}){',
    '  const before=await page.goto(baseUrl);assert.equal(await page.title(),"Loaded by JavaScript");',
    '  assert.ok(before.headers()["content-security-policy"]);await server.setRoot(upgradePair.toDir);',
    '  const after=await page.reload();assert.equal(await page.title(),"Second build");',
    '  assert.equal(after.headers()["cache-control"],"no-cache");assert.equal(after.headers()["content-security-policy"],undefined);',
    '  return {origin:new URL(page.url()).origin,switched:true};}};',
    'const cases=[first,second,upgrade];',
    'if(options.customLaunch)cases.push({id:"bfcache",kind:"single",serviceWorkers:"block",',
    '  launchOptions:{ignoreDefaultArgs:["--disable-back-forward-cache"],args:["--user-agent=SwbanLaunchFixture"]},async run({page,baseUrl}){',
    '  await page.goto(baseUrl);const userAgent=await page.evaluate(()=>navigator.userAgent);',
    '  assert.equal(userAgent,"SwbanLaunchFixture");return {userAgent};}});',
    'if(options.timeout){cases.splice(2,0,{id:"timeout",kind:"single",timeoutMs:100,run:()=>new Promise(()=>{})});',
    '  cases.push({id:"after",kind:"single",serviceWorkers:"block",async run({page,baseUrl}){await page.goto(baseUrl);',
    '    assert.equal(await page.title(),"Loaded by JavaScript");return {continued:true};}});}',
    'if(options.badId)cases[0].id="../escape";',
    'if(options.duplicate)cases[1].id=cases[0].id;',
    'if(options.empty)cases.length=0;',
    'const browserType=options.webkit?loadWebkit():options.launchFailure?',
    '  {name:()=>"chromium",executablePath:()=>"fixture",launch:()=>{throw new Error("Fixture launch failed");}}:undefined;',
    'await runScenarioSuite({scenarios:cases,primaryBuildDir:"public",outputDir:options.out??"reports",',
    '  onlyScenarioIds:options.only??[],trace:options.trace??false,browserType,upgradePair:options.upgradePair??null});'
  ].join('\n'));
});
after(() => {
  if (work) { assert.equal(path.dirname(work),parent); fs.rmSync(work,{recursive:true,force:true}); }
});

test('argument declarations and localized help cover the same options and defaults',() => {
  const spec = browserCommand('check/browser/home');
  assert.deepEqual(parseArguments(spec,[]),{dir:'public',headed:false,trace:false,out:false,timeout:15000});
  assert.equal(parseArguments(spec,['--timeout=1000','--headed','--out','space here','build']).dir,'build');
  for (const option of spec.options) assert.ok(helpFor(spec,'en').includes('--'+option.name));
  for (const args of [['--no-such-flag'],['--headed=false'],['--timeout','0'],['--timeout','1x'],['--out'],['a','b'],['--trace','--trace']]) {
    assert.throws(()=>parseArguments(spec,args));
  }
});
test('CSP declares a home default and explicit local page paths',()=>{
  const spec=cspCommand('check/browser/csp');assert.equal(parseArguments(spec,[]).page,'/');
  assert.equal(parseArguments(spec,['--page','/nested/path/#sort=name-desc']).page,'/nested/path/#sort=name-desc');
  for(const page of ['https://outside.invalid/','//outside/','/path\\bad'])
    assert.throws(()=>parseArguments(spec,['--page',page]));
  assert.match(helpFor(spec,'en'),/--page/);
});
test('missing browser packages fail without installing dependencies',() => {
  const modules = path.join(skill,'tasks/_shared/browser/node_modules');
  fs.unlinkSync(modules);
  try {
    const result = cli('check/browser/home');
    assert.equal(result.status,1); assert.match(result.stderr,/base\/browser\/ensure/);
    assert.match(cli('check/browser/home.webkit').stderr,/base\/browser\/ensure\.webkit/);
    assert.equal(fs.existsSync(modules),false,'Checks must not install packages.');
  } finally { fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),modules,'junction'); }
});
test('missing WebKit fails explicitly without installing or switching to Chromium',{timeout:30000},() => {
  const cache = path.join(skill,'.tools/browser');
  fs.unlinkSync(cache); fs.mkdirSync(cache);
  try {
    for (const name of fs.readdirSync(path.join(source,'.tools/browser')).filter(name=>name.startsWith('chromium-'))) {
      fs.symlinkSync(path.join(source,'.tools/browser',name),path.join(cache,name),'junction');
    }
    const before = fs.readdirSync(cache);
    const missing = cli('check/browser/home.webkit');
    assert.equal(missing.status,1); assert.match(missing.stderr,/WebKit is missing; run swban base\/browser\/ensure\.webkit/);
    assert.deepEqual(fs.readdirSync(cache),before,'Checks must not download browser files.');
    assert.equal(cli('check/browser/home').status,0,'Chromium remains usable independently.');
  } finally {
    fs.rmSync(cache,{recursive:true,force:true});
    fs.symlinkSync(path.join(source,'.tools/browser'),cache,'junction');
  }
});

for (const {name,suffix} of engines) {
test('home uses real '+name+' without site npm and writes requested artifacts',{timeout:30000},() => {
  const before = fs.readFileSync(path.join(site,'public/index.html'));
  const result = cli('check/browser/home'+suffix,['--trace','--out',path.join(work,'reports')]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const directory = result.stdout.match(/Artifacts: (.+)/)[1].trim();
  const report = JSON.parse(fs.readFileSync(path.join(directory,'result.json'),'utf8'));
  assert.equal(report.details.title,'Loaded by JavaScript');
  assert.equal(report.browser,name);
  assert.ok(report.browserVersion);
  assert.ok(fs.statSync(path.join(directory,'trace.zip')).size>0);
  assert.ok(fs.statSync(path.join(directory,'page.png')).size>0);
  assert.deepEqual(fs.readFileSync(path.join(site,'public/index.html')),before);
  assert.equal(fs.existsSync(path.join(site,'node_modules')),false);
});
test(name+' home fails for JS errors and missing assets; saves failure details',{timeout:30000},() => {
  const directory = output('broken-js');
  write(directory,'main.js','throw new Error("fixture runtime failure");');
  const failed = cli('check/browser/home'+suffix,[directory,'--out',path.join(work,'failures')]);
  assert.equal(failed.status,1); assert.match(failed.stderr,/fixture runtime failure/);
  const reportDir = failed.stdout.match(/Artifacts: (.+)/)[1].trim();
  assert.ok(JSON.parse(fs.readFileSync(path.join(reportDir,'result.json'))).issues.length);
  fs.unlinkSync(path.join(directory,'main.js'));
  assert.equal(cli('check/browser/home'+suffix,[directory]).status,1);
});
test(name+' CSP checks enforced headers and real violations independently of home',{timeout:30000},() => {
  assert.equal(cli('check/browser/csp'+suffix).status,0);
  const directory = output('blocked-inline');
  fs.appendFileSync(path.join(directory,'index.html'),'<script>window.unregistered=true;</script>');
  const blocked = cli('check/browser/csp'+suffix,[directory]);
  assert.equal(blocked.status,1); assert.match(blocked.stderr,/CSP violations/);
  assert.equal(cli('check/browser/home'+suffix,[directory]).status,0);
  write(directory,'_headers','');
  const missing = cli('check/browser/csp'+suffix,[directory]);
  assert.equal(missing.status,1); assert.match(missing.stderr,/missing enforced/);
});
test(name+' CSP loads the selected nested page and preserves its query',{timeout:30000},()=>{
  const directory=output('csp-path-'+name),nested='nested/path/index.html';
  write(directory,nested,fs.readFileSync(path.join(directory,'index.html'),'utf8'));
  // A broken home proves the selected path is actually inspected.
  fs.appendFileSync(path.join(directory,'index.html'),'<script>window.blockedHome=true;</script>');
  const page='/nested/path/#sort=name-desc',passed=cli('check/browser/csp'+suffix,[directory,'--page',page,'--out',path.join(work,'csp-reports')]);
  assert.equal(passed.status,0,passed.stdout+passed.stderr);
  const folder=passed.stdout.match(/Artifacts: (.+)/)[1].trim(),report=JSON.parse(fs.readFileSync(path.join(folder,'result.json'),'utf8'));
  assert.equal(report.details.page,page);assert.ok(report.details.headers['content-security-policy']);
  assert.equal(cli('check/browser/csp'+suffix,[directory]).status,1);
  fs.appendFileSync(path.join(directory,nested),'<script>window.blockedPath=true;</script>');
  const blocked=cli('check/browser/csp'+suffix,[directory,'--page',page]);
  assert.equal(blocked.status,1);assert.match(blocked.stderr,/CSP violations/);
  write(directory,'_headers',"/*\n  Content-Security-Policy: script-src 'self' 'unsafe-inline'\n");
  const unsafe=cli('check/browser/csp'+suffix,[directory,'--page',page]);
  assert.equal(unsafe.status,1);assert.match(unsafe.stderr,/must not allow unsafe-inline/);
  const missing=cli('check/browser/csp'+suffix,[directory,'--page','/absent/']);
  assert.equal(missing.status,1);assert.match(missing.stderr,/successful response|ERR_HTTP_RESPONSE_CODE_FAILURE/);
});
}
test('Chromium CSP rejects real preload credential mismatches',{timeout:30000},()=>{
  const result=cli('check/browser/csp',['--page','/preload/','--out',path.join(work,'preload-reports')]);
  assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/preload credential mismatch/);
  const directory=output('matched-preload');
  const file=path.join(directory,'preload/index.html');
  fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(' crossorigin="anonymous"',''));
  const matched=cli('check/browser/csp',[directory,'--page','/preload/']);
  assert.equal(matched.status,0,matched.stdout+matched.stderr);
});
test('an artifact destination inside the build is rejected before writing',() => {
  const outputDir = path.join(site,'public','new-artifacts');
  assert.equal(cli('check/browser/home',['--out',outputDir]).status,1);
  assert.equal(fs.existsSync(outputDir),false);
});
test('local server retries occupied and reserved ports with a bounded attempt count',async () => {
  for(const [code,blocked,attempts] of [['EACCES',1,2],['EADDRINUSE',1,2],['EACCES',Infinity,10],['EINVAL',Infinity,1]]) {
    const create=http.createServer,error=Object.assign(new Error('Fixture listen failure'),{code});
    let calls=0,server;
    http.createServer=(...args)=>{
      const native=create(...args),listen=native.listen.bind(native);
      native.listen=()=>{
        calls++;
        if(calls<=blocked){queueMicrotask(()=>native.emit('error',error));return native;}
        return listen(0,'127.0.0.1');
      };
      return native;
    };
    try {
      server=await createStaticSiteServer(output('listen-'+code+'-'+attempts));
      if(blocked===Infinity)await assert.rejects(()=>server.start(),value=>value===error);
      else {await server.start();assert.equal((await fetch(server.getBaseUrl())).status,200);}
      assert.equal(calls,attempts);
    } finally {http.createServer=create;await server?.stop();}
  }
});

test('local server uses generated headers, supports HEAD, and contains file reads',async () => {
  const directory = output('server');
  write(directory,'private-name.txt','Inside file');
  write(directory,'nested/index.html','Nested');
  write(work,'outside/secret.txt','Never serve this');
  fs.symlinkSync(path.join(work,'outside'),path.join(directory,'linked'),'junction');
  const server = await createStaticSiteServer(directory); await server.start();
  try {
    const base = server.getBaseUrl();
    const response = await fetch(base+'/');
    assert.match(response.headers.get('content-security-policy'),/script-src/);
    assert.equal(response.headers.get('cache-control'),null,'The server must not invent deployment cache policy.');
    const head = await fetch(base+'/',{method:'HEAD'}); assert.equal(await head.text(),'');
    assert.equal(await (await fetch(base+'/nested/')).text(),'Nested');
    assert.equal((await fetch(base+'/linked/secret.txt')).status,403);
    assert.equal((await fetch(base+'/%ZZ')).status,400);
    assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
    const next=output('next-server-build');
    write(next,'index.html','Next build');write(next,'_headers','/*\n  Cache-Control: no-cache\n');
    await server.setRoot(next);
    const switched=await fetch(base+'/');
    assert.equal(await switched.text(),'Next build');assert.equal(switched.headers.get('cache-control'),'no-cache');
    assert.equal(switched.headers.get('content-security-policy'),null,'Switching builds must also replace their headers.');
    await assert.rejects(()=>server.setRoot(path.join(work,'missing-server-build')));
    assert.equal(await (await fetch(base+'/')).text(),'Next build','A failed switch must retain the current build.');
  } finally { await server.stop(); }
});

test('scenario suites use prepared Chromium, isolated contexts and reports without site dependencies',{timeout:30000},()=>{
  const out=path.join(work,'suite-reports'),result=suite({out,trace:true});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
  assert.equal(report.browser,'chromium');assert.ok(report.browserVersion);
  assert.deepEqual(report.totals,{passed:2,failed:0,skipped:1});assert.equal(report.scenarios[1].details.isolated,true);
  assert.ok(fs.statSync(path.join(out,'first/trace.zip')).size>0);
  assert.equal(fs.existsSync(path.join(site,'package.json')),false);assert.equal(fs.existsSync(path.join(site,'node_modules')),false);
});
test('scenario launch options affect real Chromium independently and retain suite traces',{timeout:30000},()=>{
  const out=path.join(work,'suite-bfcache'),result=suite({out,customLaunch:true,trace:true});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
  assert.deepEqual(report.totals,{passed:3,failed:0,skipped:1});
  assert.equal(report.scenarios.at(-1).details.userAgent,'SwbanLaunchFixture');
  assert.ok(fs.statSync(path.join(out,'bfcache/trace.zip')).size>0);
});

test('scenario suites continue after failures and timeouts, retaining diagnostics',{timeout:30000},()=>{
  const out=path.join(work,'suite-failures'),result=suite({out,fail:true,timeout:true,trace:true});
  assert.equal(result.status,1,result.stdout+result.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
  assert.deepEqual(report.totals,{passed:2,failed:2,skipped:1});
  assert.equal(report.scenarios[1].details.phase,'second');assert.match(report.scenarios[2].message,/timed out after 100ms/);
  assert.equal(report.scenarios.at(-1).details.continued,true);
  assert.ok(fs.statSync(path.join(out,'second/failure.png')).size>0);
  assert.ok(fs.statSync(path.join(out,'second/trace.zip')).size>0);
});

test('scenario suites switch upgrade documents and generated headers together',{timeout:30000},()=>{
  const next=output('suite-next');write(next,'main.js','document.title="Second build";');write(next,'_headers','/*\n  Cache-Control: no-cache\n');
  const out=path.join(work,'suite-upgrade'),result=suite({out,only:['upgrade','first'],upgradePair:{fromDir:path.join(site,'public'),toDir:next}});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
  assert.deepEqual(report.scenarios.map(item=>item.id),['first','upgrade']);assert.equal(report.scenarios[1].details.switched,true);
  assert.deepEqual(report.totals,{passed:2,failed:0,skipped:0});
});

test('scenario suites reject unknown, duplicate and unsafe IDs before loading browsers',()=>{
  const modules=path.join(skill,'tasks/_shared/browser/node_modules');fs.unlinkSync(modules);
  try {
    for(const [options,message] of [[{only:['absent']},/Unknown browser scenario/],[{empty:true},/requires explicit scenarios/],
      [{badId:true},/plain directory names/],[{duplicate:true},/must be unique/]]){
      const out=path.join(work,'suite-invalid'),result=suite({...options,out});
      assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,message);assert.equal(fs.existsSync(out),false);
    }
  }finally{fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),modules,'junction');}
});

test('scenario reports cannot modify published builds through direct or linked paths',()=>{
  const linked=path.join(work,'suite-linked-build');fs.symlinkSync(path.join(site,'public'),linked,'junction');
  for(const out of [path.join(site,'public','reports'),path.join(linked,'reports')]){
    const result=suite({out});assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/outside the published build/);
    assert.equal(fs.existsSync(out),false);
  }
});

test('WebKit suites run without Chromium installed and record their actual engine',{timeout:30000},()=>{
  const cache=path.join(skill,'.tools/browser');fs.unlinkSync(cache);fs.mkdirSync(cache);
  try {
    for(const name of fs.readdirSync(path.join(source,'.tools/browser')).filter(name=>name.startsWith('webkit-')))
      fs.symlinkSync(path.join(source,'.tools/browser',name),path.join(cache,name),'junction');
    const out=path.join(work,'suite-webkit'),result=suite({out,webkit:true,only:['first','second']});
    assert.equal(result.status,0,result.stdout+result.stderr);
    const report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
    assert.equal(report.browser,'webkit');assert.ok(report.browserVersion);assert.deepEqual(report.totals,{passed:2,failed:0,skipped:0});
  }finally{fs.rmSync(cache,{recursive:true,force:true});fs.symlinkSync(path.join(source,'.tools/browser'),cache,'junction');}
});

test('suite browser launch failures close the server and leave no reports',()=>{
  const out=path.join(work,'suite-launch-failure'),result=suite({out,launchFailure:true});
  assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stderr,/Fixture launch failed/);
  assert.equal(fs.existsSync(out),false);
});
