import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {fixtureEnvironment} from './_shared/hugo.mjs';
import {inspect} from '../.agents/skills/swaw-banyan/tasks/check/sitemap/inspect.mjs';
import {decodeHtmlAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)), parent=fs.realpathSync(os.tmpdir());
const languages=[['',''],['.zh','/zh'],['.zh-tw','/zh-tw']];
const cases={local:'build: {list: local}\naliases: [/sitemap-alias/]',
  'never-list':'build: {list: never}',disabled:'sitemap: {disable: true}',
  noindex:'robots: "follow, NOINDEX"',none:'robots: none',placeholder:'translation_placeholder: true',
  unrendered:'build: {render: never}',link:'build: {render: link}',
  text:'outputs: [TEXT]',draft:'draft: true'};
let work,content,config;
function write(file,text) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function page(name,fields='') {return `---\ntitle: Sitemap ${name}\nslug: sitemap-${name}\nlayout: page-article\n${fields}\n---\nSitemap fixture.\n`;}
function urls(xml) {return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>decodeHtmlAttribute(match[1]));}
function relative(file) {return path.relative(root,file).replaceAll('\\','/');}
function args(destination) {return ['--noBuildLock','--config',`hugo.toml,${relative(config)}`,
  '--enableGitInfo=false','--destination',destination];}
before(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-sitemap-'));
  content=path.join(work,'content');config=path.join(work,'overlay.toml');
  for(const [suffix] of languages) {
    for(const [name,fields] of Object.entries(cases)) write(path.join(content,`sitemap-${name}/index${suffix}.md`),page(name,fields));
    const mixed=suffix==='.zh'?'sitemap: {disable: true}':suffix==='.zh-tw'?'robots: noindex':'';
    write(path.join(content,`sitemap-mixed/index${suffix}.md`),page('mixed',mixed));
    write(path.join(content,`sitemap-cascade/_index${suffix}.md`),page('cascade','cascade: {sitemap: {disable: true}}'));
    write(path.join(content,`sitemap-cascade/child${suffix}.md`),page('child'));
    write(path.join(content,`sitemap-tree/_index${suffix}.md`),page('tree'));
    write(path.join(content,`sitemap-tree/leaf${suffix}.md`),page('leaf'));
  }
  write(path.join(work,'layouts/page-article.text.txt'),'{{ .Content }}');
  write(config,`[[module.mounts]]\nsource = "${relative(content)}"\ntarget = "content"\n`+
    '[[module.mounts]]\nsource = "content"\ntarget = "content"\n'+
    `[[module.mounts]]\nsource = "${relative(path.join(work,'layouts'))}"\ntarget = "layouts"\n`+
    '[outputFormats.TEXT]\nmediaType = "text/plain"\nbaseName = "page"\nisPlainText = true\n');
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('sitemaps contain rendered indexable HTML regardless of list settings and honor native exclusions',async()=>{
  const output=path.join(work,'public');
  const result=spawnSync(toolExecutable('hugo'),[...args(output),'--minify','--baseURL','https://example.test/'],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:30000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  for(const [,prefix] of languages) {
    const xml=fs.readFileSync(path.join(output,prefix||'/en','sitemap.xml'),'utf8'), locs=urls(xml);
    assert.equal(new Set(locs).size,locs.length,'Duplicate sitemap loc');
    for(const name of ['local','never-list']) assert.ok(locs.includes(`https://example.test${prefix}/sitemap-${name}/`),`${prefix}/${name}`);
    for(const name of ['disabled','noindex','none','placeholder','unrendered','link','text','draft','alias','cascade','cascade/sitemap-child']) {
      assert.ok(!locs.includes(`https://example.test${prefix}/sitemap-${name}/`),`${prefix}/${name}`);
    }
    assert.doesNotMatch(xml,/href="https:\/\/example\.test\/(?:zh|zh-tw)\/sitemap-mixed\/"/);
    assert.equal(locs.includes(`https://example.test${prefix}/sitemap-mixed/`),prefix==='');
    assert.match(fs.readFileSync(path.join(output,prefix,'sitemap-disabled/index.html'),'utf8'),/data-sitemap-disabled=(?:"true"|true)/);
    assert.ok(fs.existsSync(path.join(output,prefix,'sitemap-never-list/index.html')));
    for(const name of ['unrendered','link','text','draft']) assert.ok(!fs.existsSync(path.join(output,prefix,`sitemap-${name}/index.html`)),name);
    for(const loc of locs) {
      const pathname=new URL(loc).pathname;
      assert.ok(fs.existsSync(path.join(output,pathname,'index.html')),`No HTML for ${loc}`);
    }
  }
  assert.deepEqual((await inspect(output)).issues,[]);
});

test('full preview rebuilds remove disabled, unrendered, renamed and deleted pages without losing unchanged pages',async()=>{
  const probe=net.createServer();
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base=`http://127.0.0.1:${port}`, target=path.join(content,'sitemap-local/index.md');
  const server=spawn(toolExecutable('hugo'),['server',...args(path.join(work,'preview')),
    '--bind','127.0.0.1','--port',String(port),'--baseURL',base,'--disableLiveReload','--disableFastRender'],
    {cwd:root,env:fixtureEnvironment(work),windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='';server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  async function waitFor(present,absent) {
    const deadline=Date.now()+15000;
    while(Date.now()<deadline) {
      assert.equal(server.exitCode,null,logs);
      try {
        const response=await fetch(base+'/en/sitemap.xml',{signal:AbortSignal.timeout(1000),headers:{Connection:'close'}});
        if(response.ok) {
          const locs=urls(await response.text()).map(url=>new URL(url).pathname);
          if(present.every(url=>locs.includes(url)) && absent.every(url=>!locs.includes(url))) return;
        }
      } catch {}
      await delay(100);
    }
    assert.fail('Sitemap rebuild timed out.\n'+logs);
  }
  try {
    await waitFor(['/sitemap-local/','/sitemap-never-list/'],[]);
    for(const fields of ['sitemap: {disable: true}','build: {render: never}','build: {render: link}','outputs: [TEXT]']) {
      write(target,page('local',fields));
      await waitFor(['/sitemap-never-list/'],['/sitemap-local/']);
      write(target,page('local','build: {list: local}'));
      await waitFor(['/sitemap-local/','/sitemap-never-list/'],[]);
    }
    write(target,page('renamed','build: {list: local}'));
    await waitFor(['/sitemap-renamed/','/sitemap-never-list/'],['/sitemap-local/']);
    fs.unlinkSync(target);await waitFor(['/sitemap-never-list/'],['/sitemap-local/','/sitemap-renamed/']);
    const branch=path.join(content,'sitemap-tree/_index.md'), leaf='/sitemap-tree/sitemap-leaf/';
    await waitFor([leaf],[]);
    write(branch,page('tree','cascade: {build: {render: link}}'));
    await waitFor(['/sitemap-never-list/'],[leaf]);
    write(branch,page('tree'));
    await waitFor([leaf],[]);
  } finally {
    if(server.exitCode===null) {
      const exited=new Promise(resolve=>server.once('exit',resolve));
      server.kill();await exited;
    }
  }
});
