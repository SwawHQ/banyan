import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {referenceSiteEnvironment,fixtureSiteMounts,fixtureContentDirectory,directoryPage} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {choicesCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/choices/options.mjs';
import {returnCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/return/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';
import {inspect} from '../.agents/skills/swaw-banyan/tasks/check/html/scripts/inspect.mjs';
import {loadChromium,loadWebkit} from '../.agents/skills/swaw-banyan/tasks/_shared/browser/runtime.mjs';
import {createStaticSiteServer} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {bfcacheCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/language/bfcache/options.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'.agents/skills/swaw-banyan'),parent=fs.realpathSync(os.tmpdir());
const article='/d/language-fixture/first/#from=all&sorts=name-asc&anchor=details';
const untranslated='/d/language-fixture/untranslated/?probe=keep#details';
let work,skill,output;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function fixture(name){const directory=path.join(work,name);fs.cpSync(output,directory,{recursive:true});return directory;}
function cli(command,args=[],directory=output){
  const result=spawnSync(process.execPath,[path.join(skill,'tasks','check/browser/language/'+command,'entry.mjs'),directory,...args],{cwd:work,encoding:'utf8',timeout:45000});
  assert.ifError(result.error);return result;
}
function report(result){
  assert.equal(result.status,0,result.stdout+result.stderr);
  return JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
}
function change(directory,route,edit){
  const file=path.join(directory,route,'index.html'),html=fs.readFileSync(file,'utf8'),next=edit(html);
  assert.notEqual(next,html,'Mutation must change the published fixture.');write(file,next);
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-browser-language-'));skill=path.join(work,'skill');output=path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime='node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const content=path.join(work,'content'),config=path.join(work,'fixture.toml');
  fixtureContentDirectory(content);
  for(const language of ['en','zh','ar'])
    write(path.join(content,'d/language-fixture/_index.'+language+'.md'),directoryPage('Language fixture'));
  write(path.join(content,'language/_index.md'),fs.readFileSync(path.join(root,'content/language/_index.md'),'utf8')
    .replace(/^  language_icon:.*$/m,'  language_icon: { text: "AX" }'));
  for(const lang of ['en','zh','ar'])for(const name of ['first','second']){
    const prefix=lang==='en'?'':'/'+lang;
    write(path.join(content,'d/language-fixture',name+'.'+lang+'.md'),
      '---\ntitle: Independent '+lang+' '+name+'\nurl: '+prefix+'/d/language-fixture/'+name+'/\ndate: 2026-01-01\n---\n\n## Details\n\n'+('Independent language content.\n\n'.repeat(10)));
  }
  write(path.join(content,'d/language-fixture/untranslated.en.md'),
    '---\ntitle: Independent untranslated page\nurl: /d/language-fixture/untranslated/\ndate: 2026-01-01\n---\n\n## Details\n\nUntranslated fixture content.');
  write(config,'[[module.mounts]]\nsource = '+JSON.stringify(content.replaceAll('\\','/'))+'\ntarget = "content"\n[[module.mounts]]\nsource = "content"\ntarget = "content"\n[languages.zh]\nlabel = "Independent target language"\n'+fixtureSiteMounts);
  const build=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--config','hugo.toml,'+config,'--destination',output],{cwd:root,env:referenceSiteEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(build.error);assert.equal(build.status,0,build.stdout+build.stderr);
});
after(()=>{if(work){assert.equal(path.dirname(work),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('language options expose paths, target codes and source fragments',()=>{
  const spec=returnCommand('check/browser/language/return');
  assert.throws(()=>parseArguments(spec,[]),/--from is required/);
  assert.throws(()=>parseArguments(spec,['--from',article]),/--to is required/);
  assert.throws(()=>parseArguments(spec,['--from','https://example.invalid/','--to','zh']));
  assert.throws(()=>parseArguments(spec,['--from',article,'--to','../zh']));
  assert.equal(parseArguments(spec,['--from',article,'--to','zh']).from,article);
  assert.match(helpFor(spec,'en'),/--to <code>/);
  assert.match(helpFor(choicesCommand('check/browser/language/choices'),'en'),/default: \/language\//);
  const cached=bfcacheCommand('check/browser/language/bfcache');
  assert.equal(parseArguments(cached,['--from',article,'--to','zh','--next','ar']).next,'ar');
  assert.match(helpFor(cached,'en'),/Second target; default: source language/);
  assert.throws(()=>parseArguments(cached,['--from',article,'--to','zh','--next','../en']));
});

test('choices use real native links without JS and accessible translated settings',{timeout:45000},()=>{
  const state=report(cli('choices',['--page','/zh/language/','--trace','--out',path.join(work,'reports')]));
  assert.equal(state.browser,'chromium');assert.ok(state.browserVersion);
  assert.deepEqual(state.details.staticCases.map(state=>state.language),['en','zh','ar']);
  assert.deepEqual(state.details.runtimeCases.map(state=>state.language),['en','zh','ar']);
  assert.equal(fs.existsSync(path.join(work,'node_modules')),false);
});

test('language choices replace settings with the translated source or the chosen home',{timeout:45000},()=>{
  for(const [from,to,returned,missing] of [[article,'zh','/zh'+article,false],[article,'en',article,false],
    ['/zh/all/#sorts=name-asc','en','/all/#sorts=name-asc',false],[untranslated,'zh','/zh/',true]]) {
    const picker=from.startsWith('/zh/')?'/zh/language/':'/language/';
    const result=report(cli('return',['--from',from,'--page',picker,'--to',to,'--out',path.join(work,'reports')]));
    assert.equal(result.details.returned,returned);
    assert.equal(result.details.missingTranslation,missing);
  }
});

test('browser Back restores the original language, and Forward reopens the translation',{timeout:30000},()=>{
  const result=report(cli('bfcache',['--from',article,'--to','zh','--next','ar','--out',path.join(work,'reports')]));
  assert.equal(result.details.returned,'/ar'+article);
});

test('the first language click resolves the source even when the controller loads slowly',async()=>{
  const server=await createStaticSiteServer(output),type=loadWebkit();let browser;
  try {
    await server.start();browser=await type.launch({executablePath:type.executablePath()});
    const page=await browser.newPage(),base=server.getBaseUrl();
    const held=Promise.withResolvers();
    await page.route('**/js/preferences/language-page*.js',route=>held.resolve(route));
    await page.goto(base+'/language/#languages&en=%2F&zh=%2Fzh%2Fd%2Flanguage-fixture%2Ffirst%2F',{waitUntil:'commit'});
    const route=await held.promise,choice=page.locator('[data-language-choice="zh"]');
    assert.equal(await choice.count(),0);
    const click=choice.click();
    await route.continue();await click;
    await page.waitForURL(base+'/zh/d/language-fixture/first/');
  }finally{await browser?.close();await server.stop();}
});

test('foreign fragment targets cannot redirect language choices outside the site',async()=>{
  const server=await createStaticSiteServer(output),type=loadChromium();let browser;
  try {
    await server.start();browser=await type.launch({executablePath:type.executablePath()});
    const page=await browser.newPage();
    await page.goto(server.getBaseUrl()+'/language/#languages&en=%2F&zh=%2F%2Fevil.invalid');
    assert.equal(await page.locator('[data-language-choice="zh"]').getAttribute('href'),'/zh/');
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('[data-language-choice="zh"]').click();
    await page.waitForURL(server.getBaseUrl()+'/zh/');
  }finally{await browser?.close();await server.stop();}
});

test('HTML script boundaries follow page capabilities across all languages',{timeout:30000},async()=>{
  assert.deepEqual((await inspect(output)).issues,[]);
  const stray=fixture('stray-controller');
  const settings=fs.readFileSync(path.join(stray,'zh/language/index.html'),'utf8');
  const script=settings.match(/<script\b[^>]*src=[^>]*\/js\/preferences\/language-page[^>]*><\/script>/)?.[0];
  assert.ok(script,'Published settings must have their page controller.');
  change(stray,'',html=>html.replace('</body>',script+'</body>'));
  assert.ok((await inspect(stray)).issues.some(issue=>issue.includes('preferences/language-page')&&issue.includes('expected 0')));
  const missing=fixture('missing-controller');change(missing,'zh/language',html=>html.replace(script,''));
  assert.ok((await inspect(missing)).issues.some(issue=>issue.includes('preferences/language-page')&&issue.includes('expected 1')));
  for(const route of ['','language','zh/language','ar/language'])assert.doesNotMatch(
    fs.readFileSync(path.join(output,route,'index.html'),'utf8'),/<body\b[^>]*\sdata-language-context(?:\s|=|>)/,
    'Theme output must not restore retired language context.');
  const global=fixture('global-controller'),main=fs.readFileSync(path.join(global,'index.html'),'utf8').match(/src=["']?(\/js\/main\.[^"' >]+)/)[1];
  fs.appendFileSync(path.join(global,main),'/* data-language-choice */');
  assert.ok((await inspect(global)).issues.some(issue=>issue.includes('stay out of shared bundle')));
});
