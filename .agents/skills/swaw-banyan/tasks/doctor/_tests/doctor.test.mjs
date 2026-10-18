import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseCatalog} from '../catalog.mjs';
import {readRelease} from '../banyan.mjs';
import {readBindings,resolveBinding,writeBindings} from '../../_shared/toolchain/bindings.mjs';
import {skillRoot} from '../../_shared/toolchain/manifest.mjs';

const parent=fs.realpathSync(os.tmpdir()),original=readBindings(),release=readRelease();
const runtime=resolveBinding(original.runtime,original).path;
let work,skill,site,bindings,catalog;
function write(root,file,text) {
  const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);
}
function cli(command,args=[],cwd=site,owner=skill) {
  const result=spawnSync(runtime,[path.join(owner,'tasks/_cli/main.mjs'),command,...args],{
    cwd,env:{...process.env,PATH:'',HUGO_CACHEDIR:path.join(work,'cache'),HUGO_RESOURCEDIR:path.join(work,'resources'),
      GOMODCACHE:path.join(work,'modules'),GOCACHE:path.join(work,'go-cache'),GIT_OPTIONAL_LOCKS:'0'},
    encoding:'utf8',timeout:30000,windowsHide:true
  });
  assert.ifError(result.error);return result;
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'swban-doctor-'));skill=path.join(work,'skill');site=path.join(work,'site');
  fs.cpSync(skillRoot,skill,{recursive:true,filter:file=>!file.split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  bindings={schema:original.schema,runtime:original.runtime,tools:Object.fromEntries([...new Set([original.runtime,'git','go','hugo'])].map(name=>[name,{...resolveBinding(name,original),source:'path'}]))};
  writeBindings(bindings,path.join(skill,'.tools'));
  catalog=fs.readFileSync(path.join(skill,'references/doctor.toml'),'utf8');
  write(site,'hugo.toml','baseURL="https://example.test/"\ntheme="banyan"\n');
  write(site,'themes/banyan/theme.toml','name="banyan"\nversion='+JSON.stringify(release.version)+'\n');
  write(site,'public/index.html','<h1>Fixture</h1>');
  write(site,'data/external-resources.yaml','resources: []\n');
});
after(()=>{
  assert.equal(path.dirname(fs.realpathSync(work)),parent);assert.ok(path.basename(work).startsWith('swban-doctor-'));
  fs.rmSync(work,{recursive:true,force:true});
});

test('ordinary checks, reports and sync run without a source site or Hugo bindings',()=>{
  const file=path.join(skill,'.tools/bindings.json'),before=fs.readFileSync(file);
  writeBindings({...bindings,tools:{[bindings.runtime]:bindings.tools[bindings.runtime]}},path.join(skill,'.tools'));
  const output=path.join(site,'public'),empty=path.join(work,'empty');fs.mkdirSync(empty);
  try {
    for (const [command,args,cwd] of [['check/html/headings',[output],empty],['report/size/assets',[output],empty],['sync/ext',[],site]]) {
      const result=cli(command,args,cwd);
      assert.equal(result.status,0,result.stdout+result.stderr);
    }
    const record=readBindings(path.join(skill,'.tools'));
    assert.deepEqual(Object.keys(record.tools),[bindings.runtime]);
  } finally {fs.writeFileSync(file,before);}
});

test('doctor checks selected tools, skips optional tools and leaves bindings and theme unchanged',()=>{
  const files=['.tools/bindings.json','.tools/cli.cmd'].map(file=>[file,fs.readFileSync(path.join(skill,file))]);
  const theme=fs.readFileSync(path.join(site,'themes/banyan/theme.toml'));
  const result=cli('doctor');
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.match(result.stdout,/site\.banyan: matched/);
  assert.match(result.stdout,/tool\.gh: not_selected/);
  for(const [file,before] of files)assert.deepEqual(fs.readFileSync(path.join(skill,file)),before);
  assert.deepEqual(fs.readFileSync(path.join(site,'themes/banyan/theme.toml')),theme);
});

test('doctor reports mismatched versions and catalog repair hints without blocking ordinary tasks',()=>{
  const file=path.join(site,'themes/banyan/theme.toml'),before=fs.readFileSync(file);
  fs.writeFileSync(file,'name="banyan"\nversion="99.99.99"\n');
  try {
    const result=cli('doctor');
    assert.equal(result.status,1);assert.match(result.stdout,/site\.banyan: mismatch/);
    assert.ok(result.stderr.includes('Skill '+release.version));
    assert.ok(result.stderr.includes('/archive/refs/tags/v'+release.version+'.zip'));
    assert.ok(result.stderr.includes('swban base/hugo mod get '+release.module+'@v'+release.version));
    assert.equal(cli('check/html/headings',['public']).status,0);
  } finally {fs.writeFileSync(file,before);}
});

test('a damaged optional tool is reported without hiding the site result or changing the selection',()=>{
  const file=path.join(skill,'.tools/bindings.json'),before=fs.readFileSync(file);
  writeBindings({...bindings,tools:{...bindings.tools,gh:{source:'path',path:path.join(work,'missing-gh.exe'),version:'2.98.0'}}},path.join(skill,'.tools'));
  const damaged=fs.readFileSync(file);
  try {
    const result=cli('doctor');
    assert.equal(result.status,1);assert.match(result.stdout,/tool\.gh: error/);
    assert.match(result.stdout,/site\.banyan: matched/);
    assert.match(result.stderr,/swban base\/gh\/ensure/);
    assert.deepEqual(fs.readFileSync(file),damaged);
  } finally {fs.writeFileSync(file,before);}
});

test('disabled or undeclared prerequisites block site inspection and make the report incomplete',()=>{
  const file=path.join(skill,'references/doctor.toml');
  const section=/\[checks\."tool\.hugo"\][\s\S]*?(?=\n\[checks\.|$)/;
  for(const text of [catalog.replace(section,match=>match.replace('enabled = true','enabled = false')),catalog.replace(section,'')]) {
    fs.writeFileSync(file,text);
    try {
      const result=cli('doctor');
      assert.equal(result.status,1);assert.match(result.stdout,/tool\.hugo: (?:disabled|not_declared)/);
      assert.match(result.stdout,/site\.banyan: blocked/);
      assert.match(result.stderr,/blocked_by: tool\.hugo/);
      assert.doesNotMatch(result.stdout,/site\.banyan: matched/);
    } finally {fs.writeFileSync(file,catalog);}
  }
});

test('doctor diagnoses malformed bindings instead of failing in the CLI preflight',()=>{
  const file=path.join(skill,'.tools/bindings.json'),before=fs.readFileSync(file);
  fs.writeFileSync(file,'{broken');
  try {
    const result=cli('doctor');
    assert.equal(result.status,1);assert.match(result.stdout,/tool\.runtime: error/);
    assert.match(result.stdout,/site\.banyan: blocked/);
    assert.match(result.stderr,/swban base\/bun\/ensure/);
  } finally {fs.writeFileSync(file,before);}
});

test('doctor help and an unprepared doctor do not create tools or install dependencies',()=>{
  const fresh=path.join(work,'fresh');
  fs.cpSync(skill,fresh,{recursive:true,filter:file=>!file.split(path.sep).includes('.tools')});
  assert.equal(cli('doctor',['--help'],site,fresh).status,0);
  const result=cli('doctor',[],site,fresh);
  assert.equal(result.status,1);assert.match(result.stdout,/tool\.runtime: error/);
  assert.equal(fs.existsSync(path.join(fresh,'.tools')),false);
  for(const args of [['--unknown'],['one','two']])assert.equal(cli('doctor',args).status,1);
  assert.match(cli('check/banyan').stderr,/unknown_command:check\/banyan/);
});

test('catalog rejects malformed TOML, unknown check IDs, invalid switches and translation templates',()=>{
  assert.equal(Object.keys(parseCatalog(catalog).checks).length,8);
  for(const text of ['{',catalog.replace('tool.runtime','tool.unknown'),catalog.replace('enabled = true','enabled = "true"'),
    catalog.replace('hint.zh =','hint.fr ='),catalog.replaceAll('{version}','{unknown}'),
    catalog.replace('schema_version = 1','schema_version = 2'),
    catalog.replace('hint.en = "Run swban base/bun/ensure or swban base/node/ensure to prepare the runtime."','hint.en = "{module}"')]) {
    assert.throws(()=>parseCatalog(text));
  }
});
