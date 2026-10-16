import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {toolExecutable} from '../.agents/skills/swaw-banyan/scripts.js/_toolchain/operations.mjs';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {verifyCspOutput} from '../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {inspect as inspectSitemap} from '../.agents/skills/swaw-banyan/tasks/check/sitemap/inspect.mjs';
import {extractStartTags,extractTagAttribute,extractCanonicalHref} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {stripRawText} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {readAnchor} from '../module/assets/js/browse/navigation-state.contract.js';

const root=fileURLToPath(new URL('../',import.meta.url)),origin='https://banyan.swaw.com';
const groups={guide:['getting-started','site-configuration','collection-lists','taxonomies','layout-slots','prefetch-stacks','security-csp','delivery','discovery','web-app'],
  development:['local-development','releasing','breadcrumb-models','navigation-state','partial-architecture','ui-naming','browser-regression','service-worker-regression-checklist']};
let work,output;
before(()=>{
  work=fs.mkdtempSync(path.join(os.tmpdir(),'banyan-documentation-'));
  output=path.join(work,'build');
  const result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
});
after(()=>{if(work){assert.ok(path.basename(work).startsWith('banyan-documentation-'));fs.rmSync(work,{recursive:true,force:true});}});

test('official documentation has one source, Chinese pages and honest English indexes',async()=>{
  assert.equal(fs.existsSync(path.join(root,'docs')),false,'Documentation must have one content source.');
  for(const prefix of ['','zh/'])for(const group of ['',...Object.keys(groups)]) {
    const pathname='/'+prefix+'docs/'+(group?group+'/':'');
    const html=fs.readFileSync(path.join(output,pathname,'index.html'),'utf8');
    assert.equal(extractCanonicalHref(html),origin+pathname);
    if(!prefix)assert.ok(extractStartTags(html,'a').some(tag=>extractTagAttribute(tag,'href').startsWith('/zh/docs/')));
  }
  for(const [group,names] of Object.entries(groups))for(const name of names) {
    const pathname='/zh/docs/'+group+'/'+name+'/',html=fs.readFileSync(path.join(output,pathname,'index.html'),'utf8');
    assert.equal(extractCanonicalHref(html),origin+pathname);
    assert.equal(extractStartTags(html,'h1').length,1,'One page title: '+pathname);
    assert.match(html,/<html[^>]+lang=(?:"zh"|zh)/);
    assert.ok(fs.existsSync(path.join(root,'content/docs',group,name,'index.zh.md')));
    assert.equal(fs.existsSync(path.join(output,'docs',group,name,'index.html')),false,'Do not publish Chinese as an English translation.');
    for(const tag of extractStartTags(stripRawText(html),'a')) {
      const href=extractTagAttribute(tag,'href');
      if(!href)continue;
      const target=new URL(href,origin+pathname);
      assert.ok(!target.pathname.endsWith('.md')||target.origin!==origin,'A published link must not point to local Markdown: '+href);
      if(target.origin!==origin||!target.pathname.startsWith('/zh/docs/'))continue;
      const targetFile=path.join(output,decodeURIComponent(target.pathname),'index.html');
      assert.ok(fs.existsSync(targetFile),'Missing documentation target: '+href);
      const anchor=readAnchor(target);
      if(!anchor)continue;
      const ids=[...fs.readFileSync(targetFile,'utf8').matchAll(/<[a-z][^>]*>/gi)].map(match=>extractTagAttribute(match[0],'id'));
      assert.ok(ids.includes(anchor),'Missing documentation anchor: '+href);
    }
  }
  const sitemap=fs.readFileSync(path.join(output,'zh/sitemap.xml'),'utf8');
  for(const [group,names] of Object.entries(groups))for(const name of names)
    assert.ok(sitemap.includes(origin+'/zh/docs/'+group+'/'+name+'/'),'Documentation must be discoverable.');
  assert.deepEqual((await inspectSitemap(output)).issues,[]);
  verifyCspOutput(output);
});

test('production discovery uses the official origin in sitemap, RSS and robots',()=>{
  for(const file of ['sitemap.xml','en/sitemap.xml','zh/sitemap.xml','index.xml','zh/index.xml','robots.txt','llms.txt']) {
    const text=fs.readFileSync(path.join(output,file),'utf8');
    assert.ok(text.includes(origin),file+' must use the official origin');
    assert.doesNotMatch(text,/https?:\/\/localhost:1313/,file+' must not publish preview URLs');
  }
});
