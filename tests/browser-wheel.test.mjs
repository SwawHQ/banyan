import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureContentDirectory,fixtureSiteMounts} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {loadChromium} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {check as checkTouch} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/touch/check.mjs';
import {check as checkTouchFree} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/touch/free.mjs';
import {wheelCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/canvas/wheel/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),skill=path.join(root,'.agents/skills/swaw-banyan');
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/canvas-wheel');
const article='/d/wheel-long/',short='/d/wheel-short/';
let work,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function cli(suffix='',directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks/check/browser/canvas/wheel'+suffix+'/entry.mjs'),directory,
    '--page',article,'--short',short,'--widths','390,1440'],{cwd:work,encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);return result;
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'fixture-'));output=path.join(work,'public');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  fixtureContentDirectory(content);
  const front=(title,url)=>'---\ntitle: '+title+'\nurl: '+url+'\ndate: "2026-10-01T00:00:00+08:00"\n---\n\n';
  let body='A long article for horizontal wheel and native touch checks.\n\n';
  body+='```text\n'+('wide-code-'.repeat(140))+'\n```\n\n';
  body+='| Wide table | Value |\n| --- | --- |\n| '+('WideTable'.repeat(140))+' | Content |\n\n';
  for(let index=0;index<24;index++)body+='## Chapter '+index+'\n\n'+('Reading text that makes this column scroll vertically without moving the surrounding canvas.\n\n'.repeat(8));
  write(path.join(content,'d/wheel-long.md'),front('Wheel long article',article)+body);
  write(path.join(content,'d/wheel-short.md'),front('Wheel short article',short)+'Short reading text.\n\n[Read the long article]('+article+')\n');
  write(config,'[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n'+
    '[[module.mounts]]\nsource = "content"\ntarget = "content"\n'+fixtureSiteMounts);
  const built=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(built.error);assert.equal(built.status,0,built.stdout+built.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('wheel check validates local pages and widths before opening a browser',()=>{
  const spec=wheelCommand('check/browser/canvas/wheel');
  assert.throws(()=>parseArguments(spec,['--page',article]),/--short is required/);
  assert.throws(()=>parseArguments(spec,['--page','https://outside.invalid/','--short',short]),/local site/);
  assert.throws(()=>parseArguments(spec,['--page',article,'--short',short,'--widths','390,390']),/distinct integers/);
  assert.equal(parseArguments(spec,['--page',article,'--short',short]).widths,'390,1440');
  assert.match(helpFor(spec,'en'),/--short/);
});

for(const [name,suffix] of [['Chromium',''],['WebKit','.webkit']]) {
  test(name+' checks wheel locking, native clicks, gap-only cursors and light edge alignment',{timeout:65000},()=>{
    const result=cli(suffix);assert.equal(result.status,0,result.stdout+result.stderr);
  });
}
test('wheel check detects a missing tail space',{timeout:20000},()=>{
  const broken=path.join(work,'missing-tail');fs.cpSync(output,broken,{recursive:true});
  write(path.join(broken,'broken.css'),'.reading-group{min-inline-size:0!important}');
  fs.appendFileSync(path.join(broken,article,'index.html'),'<link rel="stylesheet" href="/broken.css">');
  const result=cli('',broken);assert.equal(result.status,1);assert.match(result.stderr,/tail|blank|padding|留白/i);
});
test('native touch still pans roots, prose and metadata and restores history',{timeout:35000},async()=>{
  const server=await createStaticSiteServer(output);let browser;
  try {
    await server.start();const type=loadChromium();browser=await type.launch({headless:true,executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const page=await context.newPage();
    await checkTouch({page,context,baseUrl:server.getBaseUrl(),options:{page:article,next:short}});
    assert.notEqual(await page.locator('html').getAttribute('data-canvas-wheel'),'locked');
    await context.close();
  } finally {try{if(browser)await browser.close();}finally{await server.stop();}}
});

test('native touch aligns within 64px after inertia and preserves free positioning and wide columns',{timeout:30000},async()=>{
  const server=await createStaticSiteServer(output);let browser;
  try {
    await server.start();const type=loadChromium();browser=await type.launch({headless:true,executablePath:type.executablePath()});
    const context=await browser.newContext({viewport:{width:390,height:900},hasTouch:true,isMobile:true,serviceWorkers:'block'});
    const page=await context.newPage();
    await checkTouchFree({page,context,baseUrl:server.getBaseUrl(),options:{page:article}});
    await context.close();
  } finally {try{if(browser)await browser.close();}finally{await server.stop();}}
});
