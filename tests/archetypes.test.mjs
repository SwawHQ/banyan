import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixtureEnvironment,previewWorkspace} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {parseToml,parseYaml} from '../.agents/skills/swaw-banyan/tasks/_shared/parsers.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
function page(file) {
  const [,header,body]=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n').split(/^---\s*$/m);
  return {fields:parseYaml(header),body};
}

test('the reference site and deployment prototype expose the same setting names and types',()=>{
  const settings='assets/deploy/settings.toml';
  function fields(value) {
    if (Array.isArray(value)) return 'array';
    if (typeof value!=='object') return typeof value;
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,fields(item)]));
  }
  const read=base=>fields(parseToml(fs.readFileSync(path.join(base,settings),'utf8')));
  assert.deepEqual(read(root),read(path.join(root,'module/archetypes')));
});

test('each layout has a usable Module archetype and Powered by keeps its diagnostic fields and calls',t=>{
  const moduleRoot=path.join(root,'module');
  const kinds=fs.readdirSync(path.join(moduleRoot,'layouts')).filter(name=>/^page-.*\.html$/.test(name)).map(name=>path.basename(name,'.html')).sort();
  assert.deepEqual(fs.readdirSync(path.join(moduleRoot,'archetypes')).filter(name=>name.endsWith('.md')).sort(),kinds.map(kind=>kind+'.md').sort());
  const parent=path.join(os.tmpdir(),'swaw/banyan/archetypes');
  fs.mkdirSync(parent,{recursive:true});
  const site=fs.mkdtempSync(path.join(parent,'site-'));
  t.after(()=>fs.rmSync(site,{recursive:true,force:true}));
  fs.mkdirSync(path.join(site,'content'));
  fs.cpSync(moduleRoot,path.join(site,'module'),{recursive:true});
  fs.copyFileSync(path.join(root,'hugo.toml'),path.join(site,'hugo.toml'));
  previewWorkspace(site);
  const env={...fixtureEnvironment(site),HUGO_MODULE_WORKSPACE:'hugo.work'};
  for(const kind of kinds) {
    const section=kind==='page-root-navigation'||kind==='page-search'||kind.startsWith('page-collection-');
    const file=kind==='page-root-navigation'?'_index.zh.md':kind+'/'+(section?'_index.zh.md':'index.md');
    execFileSync(toolExecutable('hugo'),['new','content','--kind',kind,file],{cwd:site,env});
    const generated=page(path.join(site,'content',file));
    assert.ok(generated.fields.title,kind);
    if(kind==='page-article-rss')assert.equal(generated.fields.url,'p/page-article-rss/');
    else assert.equal(generated.fields.layout,kind);
    if(kind==='page-powered-by'){
      const reference=page(path.join(root,'content/powered-by/index.md'));
      const calls=body=>Array.from(body.matchAll(/{{<[^>]*>}}/g),match=>match[0]);
      assert.deepEqual(calls(generated.body),calls(reference.body));
      for(const suffix of ['','.zh','.ar']){
        const {fields}=page(path.join(root,'content/powered-by/index'+suffix+'.md'));
        assert.equal(fields.layout,kind);
        assert.deepEqual(Object.keys(generated.fields.params.diagnostics).sort(),Object.keys(fields.params.diagnostics).sort());
        for(const name of ['site_status','prefetch_debug'])
          assert.deepEqual(Object.keys(generated.fields.params[name].labels).sort(),Object.keys(fields.params[name].labels).sort());
      }
    }
  }
});

test('the shortcode index covers the public templates',()=>{
  const moduleRoot=path.join(root,'module');
  const index=parseToml(fs.readFileSync(path.join(moduleRoot,'archetypes/shortcodes.toml'),'utf8'));
  const names=fs.readdirSync(path.join(moduleRoot,'layouts/_shortcodes')).filter(name=>name.endsWith('.html')).map(name=>path.basename(name,'.html'));
  assert.deepEqual(Object.keys(index).sort(),names.sort());
  for(const name of names)assert.ok(index[name].examples.every(call=>call.startsWith('{{< '+name+' ')),name);
});
