import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createStaticSiteServer} from '../server.mjs';
import {discoverSite} from '../../site/discover.mjs';

test('discovery and server retain deployment paths and local language redirects',async()=>{
  const parent=path.join(os.tmpdir(),'swaw/banyan/browser-location-tests');
  await fs.mkdir(parent,{recursive:true});const work=await fs.mkdtemp(path.join(parent,'run-'));
  let server;
  try {
    for(const prefix of ['/','/blog/','/a%20b/','/a%25b/'])for(const language of ['', 'zh/']) {
      const root=path.join(work,String((await fs.readdir(work)).length));await fs.mkdir(root);
      const home=prefix+language,canonical='https://example.test'+home;
      const html='<html lang="zh"><head><link rel="canonical" href="'+canonical+'"></head><body><main class="prose">Home</main></body></html>';
      await fs.mkdir(path.join(root,language),{recursive:true});await fs.writeFile(path.join(root,language,'index.html'),html);
      if(language)await fs.writeFile(path.join(root,'index.html'),'<link rel="canonical" href="'+canonical+'"><meta http-equiv="refresh" content="0; url='+canonical+'">');
      await fs.mkdir(path.join(root,'css'));await fs.writeFile(path.join(root,'css/site.css'),'body{}');
      await fs.writeFile(path.join(root,'_headers'),prefix+'css/*\n  X-Location: correct\n');
      const site=await discoverSite(root);assert.equal(site.home,home);assert.equal(site.prose,home);
      if(server)await server.setRoot(root);else {server=await createStaticSiteServer(root);await server.start();}
      const origin=server.getBaseUrl();
      const response=await fetch(origin+prefix);assert.equal(response.status,200);assert.equal(response.url,origin+home);
      assert.equal((await fetch(origin+'/')).url,origin+home);
      const asset=await fetch(origin+prefix+'css/site.css');assert.equal(asset.status,200);assert.equal(asset.headers.get('x-location'),'correct');
      if(prefix!=='/')assert.equal((await fetch(origin+'/css/site.css')).status,404);
      assert.equal((await fetch(origin+prefix+'%2e%2e%2fsecret')).status,403);
    }
  } finally {
    await server?.stop();assert.equal(path.dirname(await fs.realpath(work)),await fs.realpath(parent));await fs.rm(work,{recursive:true,force:true});
  }
});
