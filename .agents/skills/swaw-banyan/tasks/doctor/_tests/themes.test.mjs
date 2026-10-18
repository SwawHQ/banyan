import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {themesFromMounts,assess} from '../banyan.mjs';

const parent=fs.realpathSync(os.tmpdir()),release={module:'github.com/SwawHQ/banyan/module',version:'0.1.0'};
let work;
beforeEach(()=>{work=fs.mkdtempSync(path.join(parent,'swban-theme-'));});
afterEach(()=>{
  assert.equal(path.dirname(fs.realpathSync(work)),parent);
  assert.ok(path.basename(work).startsWith('swban-theme-'));
  fs.rmSync(work,{recursive:true,force:true});
});
function component(name,metadata) {
  const dir=path.join(work,name);fs.mkdirSync(dir,{recursive:true});
  if(metadata!==undefined)fs.writeFileSync(path.join(dir,'theme.toml'),metadata);
  return {path:name,owner:'project',version:'',dir,mounts:[{source:'layouts',target:'layouts'}]};
}
const output=items=>items.map(item=>JSON.stringify(item,null,3)).join('\n')+'\n';

test('resolved directories identify renamed themes and preserve braces in JSON strings',()=>{
  const item=component('主题 } { directory','name="banyan"\nversion="0.1.0"\n');
  const themes=themesFromMounts(output([{path:'project',owner:'',dir:work},item]),release.module);
  assert.equal(themes.length,1);assert.equal(themes[0].directory,item.dir);
  assert.equal(assess(themes[0],release).state,'matched');
  assert.equal(assess(themes[0],{...release,version:'0.2.0'}).state,'mismatch');
});

test('missing theme identity or version is unverified instead of a release match',()=>{
  for(const metadata of [undefined,'name="banyan"\n','name="other"\nversion="0.1.0"\n']) {
    const item=component('banyan',metadata);
    if(metadata===undefined)fs.rmSync(path.join(item.dir,'theme.toml'),{force:true});
    const [theme]=themesFromMounts(output([item]),release.module);
    assert.equal(assess(theme,release).state,'unverified');
  }
});

test('unrelated themes and versioned Modules do not supply a Banyan theme version',()=>{
  const other=component('other','name="other"\nversion=42\n');
  const module={...component('banyan','name="banyan"\nversion="0.1.0"\n'),path:release.module,version:'v0.1.0'};
  assert.deepEqual(themesFromMounts(output([other,module]),release.module),[]);
});

test('malformed metadata and invalid versions fail explicitly',()=>{
  const item=component('banyan','');
  for(const metadata of ['name="banyan"\nversion=42\n','name="banyan"\nversion="v0.1.0"\n','name="banyan"\nversion="0.1.0"\nversion="0.2.0"\n']) {
    fs.writeFileSync(path.join(item.dir,'theme.toml'),metadata);
    assert.throws(()=>themesFromMounts(output([item]),release.module));
  }
  assert.throws(()=>themesFromMounts('{broken',release.module));
});
