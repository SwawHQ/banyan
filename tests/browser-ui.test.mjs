import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixtureEnvironment,fixtureSiteFiles,fixtureSitePages} from './_shared/hugo.mjs';
import {verifyRetiredOutput} from './output/retired.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {contrastCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/palette/contrast/options.mjs';
import {appearanceCommand} from '../.agents/skills/swaw-banyan/tasks/check/browser/appearance/options.mjs';
import {parseArguments,helpFor} from '../.agents/skills/swaw-banyan/tasks/_shared/arguments.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const source = path.join(root,'.agents/skills/swaw-banyan');
const parent = path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/browser-ui');
const sharedCommands = ['check/browser/palette/contrast','check/browser/appearance'];
const engines = [
  {name:'chromium',suffix:'',commands:[...sharedCommands,'check/browser/palette/roles']},
  {name:'webkit',suffix:'.webkit',commands:sharedCommands}
];
let work,skill,output,starter;
function write(file,text) { fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text); }
function cli(command,args=[]) {
  const result = spawnSync(process.execPath,[path.join(skill,'tasks',command,'entry.mjs'),output,...args],{
    cwd:work,encoding:'utf8',timeout:30000
  });
  assert.ifError(result.error); return result;
}
function fixture(name) {
  const directory = path.join(work,name); fs.cpSync(output,directory,{recursive:true}); return directory;
}
function checkFixture(command,directory,args=[]) {
  const result = spawnSync(process.execPath,[path.join(skill,'tasks',command,'entry.mjs'),directory,...args],{
    cwd:work,encoding:'utf8',timeout:30000
  });
  assert.ifError(result.error); return result;
}
function appendAsset(directory,route,name,text,tag) {
  write(path.join(directory,name),text);
  fs.appendFileSync(path.join(directory,route,'index.html'),tag);
}
before(async () => {
  fs.mkdirSync(parent,{recursive:true});
  work = fs.mkdtempSync(path.join(parent,'banyan-browser-ui-'));
  skill = path.join(work,'skill'); output = path.join(work,'public');
  fs.cpSync(source,skill,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  const runtime = 'node';
  write(path.join(skill,'.tools/bindings.json'),JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime,tools:{
    [runtime]:{source:'path',path:process.execPath,version:process.versions.node}
  }}));
  fs.symlinkSync(path.join(source,'tasks/_shared/browser/node_modules'),path.join(skill,'tasks/_shared/browser/node_modules'),'junction');
  fs.symlinkSync(path.join(source,'.tools/browser'),path.join(skill,'.tools/browser'),'junction');
  const build = spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],{
    cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000
  });
  assert.ifError(build.error); assert.equal(build.status,0,build.stdout+build.stderr);
  await verifyRetiredOutput(output);
  const consumer=path.join(work,'consumer');starter=path.join(work,'starter');
  fixtureSiteFiles(consumer);
  fixtureSitePages(consumer,['appearance','language','my','_res','rss','powered-by']);
  write(path.join(consumer,'hugo.toml'),fs.readFileSync(path.join(root,'hugo.toml'),'utf8'));
  write(path.join(consumer,'go.mod'),'module example.test/starter\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\nreplace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(root,'module').replaceAll('\\','/'))+'\n');
  for(const suffix of ['','.zh','.zh-tw'])write(path.join(consumer,'content/_index'+suffix+'.md'),'---\ntitle: Independent starter\ndescription: A minimal consumer site.\nlayout: page-home\n---\n\n{{< home-art "/_res/home-art/wind" >}}\n');
  const independent=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',starter],{
    cwd:consumer,env:fixtureEnvironment(path.join(work,'starter-work')),encoding:'utf8',timeout:60000
  });
  assert.ifError(independent.error);assert.equal(independent.status,0,independent.stdout+independent.stderr);
});
after(() => {
  if (work) { assert.equal(path.dirname(work),parent); fs.rmSync(work,{recursive:true,force:true}); }
});

test('UI paths, contrast defaults and detailed help use the same declarations',() => {
  const spec = contrastCommand('check/browser/palette/contrast');
  assert.throws(()=>parseArguments(spec,[]),/--page is required/);
  assert.equal(parseArguments(spec,['--page','/p/article/']).min,4.5);
  assert.equal(parseArguments(spec,['--min','5.1','--page','/zh/about/']).min,5.1);
  assert.equal(parseArguments(spec,['--page','/about/?view=full#part']).page,'/about/?view=full#part');
  assert.match(helpFor(spec,'en'),/--page/); assert.match(helpFor(spec,'en'),/--min/);
  for (const args of [['--min','0'],['--min','22'],['--min','NaN'],['--min','4.5x'],['--page','https://example.com'],['--page','//example.com'],['--page','/\\example.com']]) {
    assert.throws(()=>parseArguments(spec,args));
  }
  const appearance = appearanceCommand('check/browser/appearance');
  assert.equal(parseArguments(appearance,[]).from,'/');
  assert.equal(parseArguments(appearance,['--from','/zh/all/#sort=name-asc']).from,'/zh/all/#sort=name-asc');
});

test('appearance uses the home of an independent starter without a branded about page',{timeout:15000},()=>{
  assert.equal(fs.existsSync(path.join(starter,'about')),false);
  const result=checkFixture('check/browser/appearance',starter,['--out',path.join(work,'starter-reports')]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(result.stdout.match(/Artifacts: (.+)/)[1].trim(),'result.json'),'utf8'));
  assert.equal(report.details.from,'/');
});

test('chromium rejects broken palette scopes and accepts relocated role pages',{timeout:15000},() => {
  const fixed = fixture('fixed');
  appendAsset(fixed,'about','fixed.css','#palette-fixture th{background-color:#31547a!important}',
    '<link rel="stylesheet" href="/fixed.css">');
  const roles = checkFixture('check/browser/palette/roles',fixed,['--page','/about/']);
  assert.equal(roles.status,1); assert.match(roles.stderr,/headerBg follows/);
  const moved = fixture('moved-roles');
  write(path.join(moved,'articles/probe/index.html'),fs.readFileSync(path.join(moved,'about/index.html')));
  const palette = checkFixture('check/browser/palette/roles',moved,['--page','/articles/probe/']);
  assert.equal(palette.status,0,palette.stdout+palette.stderr);
});

for (const {name,suffix,commands} of engines) {
test(name+' runs its published checks and records contrast measurements',{timeout:30000},() => {
  for (const command of commands) {
    const result = cli(command+suffix,[...(command.includes('/palette/')?['--page','/about/']:[]),'--out',path.join(work,'reports')]);
    assert.equal(result.status,0,result.stdout+result.stderr);
    const artifacts = result.stdout.match(/Artifacts: (.+)/)[1].trim();
    const report = JSON.parse(fs.readFileSync(path.join(artifacts,'result.json'),'utf8'));
    assert.equal(report.browser,name);
    if (command.endsWith('/contrast')) {
      assert.equal(report.details.modes.length,2);
      assert.equal(report.details.modes[0].measurements.length,17);
      assert.ok(report.details.modes.every(mode=>mode.measurements.every(sample=>sample.ratio>=4.5)));
    }
    if (command.endsWith('/appearance')) {
      assert.deepEqual(report.details.startup.map(({preference,colorScheme})=>[preference,colorScheme]),
        [[null,'light'],['unexpected','light'],[null,'dark'],['unexpected','dark']]);
      assert.ok(report.details.startup.every(sample=>sample.first===sample.colorScheme&&sample.final===sample.colorScheme));
    }
  }
  assert.equal(fs.existsSync(path.join(work,'node_modules')),false);
});

test(name+' rejects low contrast',{timeout:15000},() => {
  const low = fixture('low-'+name);
  appendAsset(low,'about','broken.css','#contrast-fixture [data-contrast]{color:#777!important;background-color:#777!important}',
    '<link rel="stylesheet" href="/broken.css">');
  const contrast = checkFixture('check/browser/palette/contrast'+suffix,low,['--page','/about/']);
  assert.equal(contrast.status,1); assert.match(contrast.stderr,/needs 4\.5:1/);
});

test(name+' detects missing cross-tab synchronization',{timeout:15000},() => {
  const broken = fixture('storage-'+name);
  appendAsset(broken,'about','blocked-storage.js',"window.addEventListener('storage',event=>event.stopImmediatePropagation(),true);",
    '<script src="/blocked-storage.js"></script>');
  const result = checkFixture('check/browser/appearance'+suffix,broken,['--from','/about/','--timeout','2000']);
  assert.equal(result.status,1); assert.match(result.stderr,/Cross-tab synchronization failed/);
});

test(name+' bounds color-transition waiting with the declared action timeout',{timeout:10000},() => {
  const slow = fixture('slow-'+name);
  appendAsset(slow,'about','slow.css','body{transition-duration:60s!important}',
    '<link rel="stylesheet" href="/slow.css">');
  const result = checkFixture('check/browser/palette/contrast'+suffix,slow,['--page','/about/','--timeout','1000']);
  assert.equal(result.status,1); assert.match(result.stderr,/Timeout 1000ms/);
});

test(name+' accepts explicit language and relocated page paths',{timeout:30000},() => {
  const translated = cli('check/browser/palette/contrast'+suffix,['--page','/zh/about/']);
  assert.equal(translated.status,0,translated.stdout+translated.stderr);
  const moved = fixture('moved-'+name);
  const prose = fs.readFileSync(path.join(moved,'about/index.html'),'utf8').replaceAll('/appearance/','/settings/look/');
  write(path.join(moved,'articles/probe/index.html'),prose);
  write(path.join(moved,'settings/look/index.html'),fs.readFileSync(path.join(moved,'appearance/index.html')));
  const appearance = checkFixture('check/browser/appearance'+suffix,moved,['--page','/settings/look/','--from','/articles/probe/?keep=query']);
  assert.equal(appearance.status,0,appearance.stdout+appearance.stderr);
});
}
