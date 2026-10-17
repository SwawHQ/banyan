import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {siteDirectory} from '../pairing.mjs';
import {readRelease} from '../../check/banyan/inspect.mjs';
import {readBindings,resolveBinding} from '../../_shared/toolchain/bindings.mjs';
import {skillRoot} from '../../_shared/toolchain/manifest.mjs';

const parent=fs.realpathSync(os.tmpdir()),release=readRelease();
const bindings=readBindings(),runtime=resolveBinding(bindings.runtime,bindings).path;
for (const name of ['git','go','hugo']) resolveBinding(name,bindings);
let work,matched,mismatch,missing,unverified,output;
function write(root,file,value) {
  const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);
}
function cli(command,args=[],cwd=matched) {
  const result=spawnSync(runtime,[path.join(skillRoot,'tasks/_cli/main.mjs'),command,...args],{
    cwd,env:{...process.env,HUGO_CACHEDIR:path.join(work,'cache'),HUGO_RESOURCEDIR:path.join(work,'resources'),
      GOMODCACHE:path.join(work,'modules'),GOCACHE:path.join(work,'go-cache'),GIT_OPTIONAL_LOCKS:'0'},
    encoding:'utf8',timeout:30000,windowsHide:true
  });
  assert.ifError(result.error);return result;
}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'swban-pairing-'));
  for(const [name,version] of [['matched',release.version],['mismatch','99.99.99'],['unverified',null]]) {
    const root=path.join(work,name);
    write(root,'hugo.toml','baseURL="https://example.test/"\ntheme="banyan"\n');
    write(root,'themes/banyan/theme.toml','name="banyan"\n'+(version===null?'':'version='+JSON.stringify(version)+'\n'));
  }
  matched=path.join(work,'matched');mismatch=path.join(work,'mismatch');unverified=path.join(work,'unverified');
  missing=path.join(work,'missing');write(missing,'hugo.toml','baseURL="https://example.test/"\n');
  output=path.join(work,'output');write(output,'index.html','<h1>Fixture</h1>');
});
after(()=>{
  assert.equal(path.dirname(fs.realpathSync(work)),parent);assert.ok(path.basename(work).startsWith('swban-pairing-'));
  fs.rmSync(work,{recursive:true,force:true});
});

test('entry checks matching sites quietly',()=>{
  const result=cli('check/html/headings',[output]);
  assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(result.stdout.trim(),'check/html/headings: 0 issues');
});

test('every task category stops on mismatch before running the requested task',()=>{
  write(mismatch,'edgeone.json','keep existing config');write(output,'edgeone.json','{}');
  for(const [command,args] of [
    ['check/html/headings',[output]],['report/size/assets',[output]],['sync/ext',[]],
    ['deploy/edgeone/sync',[output]],['check/http/cache',['http://127.0.0.1:9/']]
  ]) {
    const result=cli(command,args,mismatch);
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.match(result.stderr,/Banyan pairing: mismatch/);
    assert.match(result.stderr,/https:\/\/github.com\/SwawHQ\/banyan\/releases/);
    assert.ok(result.stderr.includes('/archive/refs/tags/v'+release.version+'.zip'));
    assert.equal(result.stdout,'');
  }
  assert.equal(fs.readFileSync(path.join(mismatch,'edgeone.json'),'utf8'),'keep existing config');
});

test('missing or unverifiable Banyan versions also stop the task',()=>{
  for(const [cwd,state] of [[missing,'missing'],[unverified,'unverified']]) {
    const result=cli('check/html/headings',[output],cwd);
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.ok(result.stderr.includes('Banyan pairing: '+state));
  }
});

test('help, native tools and the explicit diagnostic remain usable on mismatch',()=>{
  for(const [command,args] of [['help/en',[]],['check/http/cache',['--help']],['base/hugo',['version']]]) {
    const result=cli(command,args,mismatch);assert.equal(result.status,0,result.stdout+result.stderr);
    assert.doesNotMatch(result.stderr,/Banyan pairing:/);
  }
  const result=cli('check/banyan',[],mismatch);
  assert.equal(result.status,1);assert.match(result.stdout,/Pairing: mismatch/);
  assert.doesNotMatch(result.stderr,/Banyan pairing:/);
});

test('explicit source directories are checked instead of the working directory',()=>{
  assert.equal(siteDirectory('check/content/share-image',[mismatch]),mismatch);
  assert.equal(siteDirectory('check/browser/site',[output,'--site='+matched]),matched);
  for(const [command,args] of [
    ['check/content/share-image',[mismatch]],
    ['check/browser/site',[output,'--site',mismatch]]
  ]) {
    const result=cli(command,args,matched);
    assert.equal(result.status,1);assert.match(result.stderr,/Banyan pairing: mismatch/);
    assert.ok(result.stderr.includes(mismatch));
  }
  const result=cli('check/content/translation-placeholder',[matched],mismatch);
  assert.equal(result.status,0,result.stdout+result.stderr);
});
