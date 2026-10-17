import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {assess,readRelease} from '../inspect.mjs';
import {readBindings,resolveBinding,writeBindings} from '../../../_shared/toolchain/bindings.mjs';
import {skillRoot} from '../../../_shared/toolchain/manifest.mjs';

const release=readRelease(),parent=fs.realpathSync.native(os.tmpdir());
function write(root,file,value) {
  const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);
}
function fixture(run) {
  const root=fs.mkdtempSync(path.join(parent,'swban-source-'));
  const skill=path.join(root,'.agents/skills/swaw-banyan'),module=path.join(root,'module');
  fs.mkdirSync(skill,{recursive:true});fs.mkdirSync(module);
  try {run({root,skill,module});}
  finally {
    assert.equal(path.dirname(fs.realpathSync.native(root)),parent);
    assert.ok(path.basename(root).startsWith('swban-source-'));
    fs.rmSync(root,{recursive:true,force:true});
  }
}

test('archive pairing uses the sibling source version and rejects missing identity or external replacements',()=>fixture(({root,skill,module})=>{
  const source={path:release.module,directory:module,version:''};
  const check=()=>assess(source,release,{root:skill,site:root});
  assert.equal(fs.existsSync(path.join(root,'.git')),false);
  assert.equal(check().state,'unverified');
  for(const metadata of ['', 'name="banyan"\n', 'name="other"\nversion='+JSON.stringify(release.version)+'\n',
    'name="banyan"\nversion=42\n', 'name="banyan"\nversion="v0.1.0"\n']) {
    write(module,'theme.toml',metadata);assert.equal(check().state,'unverified');
  }
  write(module,'theme.toml','name="banyan"\nversion='+JSON.stringify(release.version)+'\n');
  assert.equal(check().state,'matched');
  const different=release.version==='99.99.99'?'99.99.98':'99.99.99';
  write(module,'theme.toml','name="banyan"\nversion='+JSON.stringify(different)+'\n');
  assert.equal(check().state,'mismatch');assert.ok(check().issues[0].includes('v'+different));
  const external=path.join(root,'external');
  write(external,'theme.toml','name="banyan"\nversion='+JSON.stringify(release.version)+'\n');
  assert.equal(assess({...source,directory:external},release,{root:skill,site:root}).state,'unverified');
}));

test('a source archive builds and runs site tasks while mixed versions remain blocked',()=>fixture(({root,skill,module})=>{
  const bindings=readBindings(),runtime=bindings.runtime;
  const tools=Object.fromEntries([...new Set([runtime,'git','go','hugo'])].map(name=>[name,{...resolveBinding(name,bindings),source:'path'}]));
  fs.cpSync(skillRoot,skill,{recursive:true,filter:file=>!file.split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
  writeBindings({schema:bindings.schema,runtime,tools},path.join(skill,'.tools'));
  write(root,'hugo.toml','baseURL="https://example.test/"\ndisableKinds=["taxonomy","term","rss","sitemap"]\n[[module.imports]]\npath='+JSON.stringify(release.module)+'\n');
  const goMod=replacement=>'module example.test/archive\n\ngo 1.18\nrequire '+release.module+' v0.0.0\nreplace '+release.module+' => '+replacement+'\n';
  write(root,'go.mod',goMod('./module'));write(module,'go.mod','module '+release.module+'\ngo 1.18\n');
  write(module,'theme.toml','name="banyan"\nversion='+JSON.stringify(release.version)+'\n');
  write(module,'layouts/home.html','<h1>Archive preview</h1>');
  const output=path.join(root,'output'),env={...process.env,HUGO_CACHEDIR:path.join(root,'cache'),HUGO_RESOURCEDIR:path.join(root,'resources'),GOMODCACHE:path.join(root,'modules'),GOCACHE:path.join(root,'go-cache'),GIT_OPTIONAL_LOCKS:'0'};
  const cli=(command,args=[])=>{
    const result=spawnSync(tools[runtime].path,[path.join(skill,'tasks/_cli/main.mjs'),command,...args],{cwd:root,env,encoding:'utf8',timeout:30000,windowsHide:true});
    assert.ifError(result.error);return result;
  };
  const build=cli('base/hugo',['--noBuildLock','--destination',output]);assert.equal(build.status,0,build.stdout+build.stderr);
  const diagnostic=cli('check/banyan');assert.equal(diagnostic.status,0,diagnostic.stdout+diagnostic.stderr);assert.match(diagnostic.stdout,/Pairing: matched/);
  for(const command of ['check/html/headings','report/size/assets']) {
    const result=cli(command,[output]);assert.equal(result.status,0,result.stdout+result.stderr);
  }
  write(module,'theme.toml','name="banyan"\nversion="99.99.99"\n');
  const mismatch=cli('check/html/headings',[output]);assert.equal(mismatch.status,1);assert.match(mismatch.stderr,/Banyan pairing: mismatch/);
  fs.cpSync(module,path.join(root,'external'),{recursive:true});
  write(root,'external/theme.toml','name="banyan"\nversion='+JSON.stringify(release.version)+'\n');
  write(root,'go.mod',goMod('./external'));
  const external=cli('check/html/headings',[output]);assert.equal(external.status,1);assert.match(external.stderr,/Banyan pairing: unverified/);
  assert.equal(fs.existsSync(path.join(root,'.git')),false);
}));
