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
import {fixtureEnvironment,fixtureSiteMounts} from './_shared/hugo.mjs';
import {inspect} from '../.agents/skills/swaw-banyan/tasks/check/sitemap/inspect.mjs';
import {inspect as inspectLlms} from '../.agents/skills/swaw-banyan/tasks/check/llms/inspect.mjs';
import {decodeHtmlAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)), parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/llms-sitemap-tests');
const languages=[['',''],['.zh','/zh'],['.zh-tw','/zh-tw']];
const cases={local:'build: {list: local}\naliases: [/sitemap-alias/]',
  'never-list':'build: {list: never}',disabled:'sitemap: {disable: true}',
  noindex:'params: {robots: "follow, NOINDEX"}',none:'params: {robots: none}',
  unrendered:'build: {render: never}',link:'build: {render: link}',
  text:'outputs: [TEXT]',draft:'draft: true'};
let work,content,config;
function write(file,text) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function page(name,fields='',url='sitemap-'+name+'/') {return `---\ntitle: Sitemap ${name}\nurl: ${url}\nlayout: page-article-norss\n${fields}\n---\nSitemap fixture.\n`;}
function urls(xml) {return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>decodeHtmlAttribute(match[1]));}
function llmsUrls(text) {
  return [...text.matchAll(/\]\(<([^>\r\n]+)>\)/g)].map(match=>decodeHtmlAttribute(match[1]))
    .filter(url=>!new URL(url).pathname.match(/\.(?:txt|xml)$/));
}
function assertLlmsMatchesSitemap(text,locs) {
  const links=llmsUrls(text);
  for(const group of text.split(/^## /m)) {
    const entries=llmsUrls(group);
    assert.equal(new Set(entries).size,entries.length,'Duplicate LLMS HTML link in one group');
  }
  assert.deepEqual([...new Set(links)].toSorted(),locs.toSorted(),'LLMS and sitemap must list the same HTML pages');
}
function relative(file) {return path.relative(root,file).replaceAll('\\','/');}
function args(destination) {return ['--noBuildLock','--config',`hugo.toml,${relative(config)}`,
  '--enableGitInfo=false','--destination',destination];}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));
  content=path.join(work,'content');config=path.join(work,'overlay.toml');
  for(const [suffix] of languages) {
    for(const [name,fields] of Object.entries(cases)) write(path.join(content,`sitemap-${name}/index${suffix}.md`),page(name,fields));
    const mixed=suffix==='.zh'?'sitemap: {disable: true}':suffix==='.zh-tw'?'params: {robots: noindex}':'';
    write(path.join(content,`sitemap-mixed/index${suffix}.md`),page('mixed',mixed));
    write(path.join(content,`sitemap-cascade/_index${suffix}.md`),page('cascade','cascade: {sitemap: {disable: true}}'));
    write(path.join(content,`sitemap-cascade/child${suffix}.md`),page('child','','sitemap-cascade/sitemap-child/'));
    write(path.join(content,`sitemap-tree/_index${suffix}.md`),page('tree'));
    write(path.join(content,`sitemap-tree/leaf${suffix}.md`),page('leaf','','sitemap-tree/sitemap-leaf/'));
    write(path.join(content,`sitemap-parent/_index${suffix}.md`),page('parent','sitemap: {disable: true}'));
    write(path.join(content,`sitemap-parent/child${suffix}.md`),page('parent-child','','sitemap-parent/sitemap-parent-child/'));
    write(path.join(content,`d/_index${suffix}.md`),'---\ntitle: LLMS Group\nlayout: page-collection-directory\ncascade: [ { target: { kind: page }, layout: page-article-norss } ]\n---\n');
    write(path.join(content,`d/llms-special/index${suffix}.md`),'---\n'+
      'title: "LLMS [brackets] *stars* `code`"\nurl: d/llms-special/\nlayout: page-article-norss\n'+
      'description: "First [detail]\\nSecond _value_"\n---\nLLMS fixture.\n');
    write(path.join(content,`d/llms-undescribed/index${suffix}.md`),'---\ntitle: LLMS undescribed\nurl: d/llms-undescribed/\nlayout: page-article-norss\n---\n');
    for(const [name,fields] of [['references',''],['other',''],['hidden','params: {robots: noindex}'],['disabled','sitemap: {disable: true}']])
      write(path.join(content,`llms-${name}/_index${suffix}.md`),'---\ntitle: LLMS '+(name==='other'?'references':name)+'\nlayout: page-collection-directory\n'+fields+'\n---\n');
  }
  write(path.join(content,'d/llms-en-only/index.md'),'---\ntitle: LLMS English only\nurl: d/llms-en-only/\nlayout: page-article-norss\n---\n');
  for(const name of ['references','other','hidden','disabled'])
    write(path.join(content,`llms-${name}/_map.toml`),'refs = '+JSON.stringify(['/d/llms-special','/d/llms-undescribed','/d/llms-en-only','/sitemap-local','/sitemap-disabled','/sitemap-noindex','/sitemap-none','/sitemap-mixed'])+'\n');
  write(path.join(work,'layouts/page-article-norss.text.txt'),'{{ .Content }}');
  write(config,`[[module.mounts]]\nsource = "${relative(content)}"\ntarget = "content"\n`+
    '[[module.mounts]]\nsource = "content"\ntarget = "content"\n'+
    `[[module.mounts]]\nsource = "${relative(path.join(work,'layouts'))}"\ntarget = "layouts"\n`+
    '[outputFormats.TEXT]\nmediaType = "text/plain"\nbaseName = "page"\nisPlainText = true\n'+fixtureSiteMounts);
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('sitemap and grouped LLMS share rendered HTML pages, exclusions and metadata',async()=>{
  const output=path.join(work,'public');
  const result=spawnSync(toolExecutable('hugo'),[...args(output),'--minify','--baseURL','https://example.test/'],
    {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:30000,windowsHide:true});
  assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
  for(const [,prefix] of languages) {
    const xml=fs.readFileSync(path.join(output,prefix||'/en','sitemap.xml'),'utf8'), locs=urls(xml);
    assert.equal(new Set(locs).size,locs.length,'Duplicate sitemap loc');
    for(const name of ['local','never-list']) assert.ok(locs.includes(`https://example.test${prefix}/sitemap-${name}/`),`${prefix}/${name}`);
    for(const name of ['disabled','noindex','none','unrendered','link','text','draft','alias','cascade','cascade/sitemap-child']) {
      assert.ok(!locs.includes(`https://example.test${prefix}/sitemap-${name}/`),`${prefix}/${name}`);
    }
    assert.doesNotMatch(xml,/href="https:\/\/example\.test\/(?:zh|zh-tw)\/sitemap-mixed\/"/);
    assert.equal(locs.includes(`https://example.test${prefix}/sitemap-mixed/`),prefix==='');
    assert.ok(!locs.includes(`https://example.test${prefix}/sitemap-parent/`));
    assert.ok(locs.includes(`https://example.test${prefix}/sitemap-parent/sitemap-parent-child/`),'A disabled parent must not hide an eligible child');
    const llms=fs.readFileSync(path.join(output,prefix,'llms.txt'),'utf8');
    assertLlmsMatchesSitemap(llms,locs);
    const special=llms.split('\n').find(line=>line.includes('/d/llms-special/'));
    assert.ok(special,'The article permalink must follow its physical directory');
    assert.ok(special.includes('[LLMS \\[brackets\\] \\*stars\\* \\`code\\`]'),special);
    assert.ok(special.endsWith(': First \\[detail\\] Second \\_value\\_'),special);
    assert.equal([...llms.slice(0,llms.indexOf(special)).matchAll(/^## (.+)$/gm)].at(-1)[1],'LLMS Group','Group by Hugo hierarchy');
    const undescribed=llms.split('\n').find(line=>line.includes('/d/llms-undescribed/'));
    assert.match(undescribed,/^\- \[LLMS undescribed\]\(<https:\/\/example\.test(?:\/zh|\/zh-tw)?\/d\/llms-undescribed\/>\)$/);
    const groups=llms.split(/^## /m).slice(1);
    const shared='https://example.test'+prefix+'/d/llms-special/';
    assert.equal(llmsUrls(llms).filter(url=>url===shared).length,3,'One physical group and two reference groups');
    for(const name of ['references','other']) {
      const group=groups.find(text=>text.includes('](<https://example.test'+prefix+'/llms-'+name+'/>)'));
      assert.ok(group,'Each reference directory retains its group, including matching titles');
      const entries=llmsUrls(group);
      assert.ok(entries.includes(shared),'References retain the original canonical URL');
      assert.ok(entries.includes('https://example.test'+prefix+'/d/llms-undescribed/'));
      assert.ok(entries.includes('https://example.test'+prefix+'/sitemap-local/'),'Locally listed articles retain discovery');
      assert.equal(entries.includes('https://example.test/d/llms-en-only/'),prefix==='','Missing translations do not link another language');
      for(const excluded of ['disabled','noindex','none'])
        assert.ok(!entries.includes('https://example.test'+prefix+'/sitemap-'+excluded+'/'),'A reference cannot bypass sitemap exclusions');
      assert.equal(entries.includes('https://example.test'+prefix+'/sitemap-mixed/'),prefix==='');
    }
    assert.ok(!groups.some(group=>group.startsWith('LLMS hidden\n')),'Noindex reference directories do not add groups');
    assert.ok(!groups.some(group=>group.startsWith('LLMS disabled\n')),'Sitemap-disabled reference directories do not add groups');
    assert.match(fs.readFileSync(path.join(output,prefix,'sitemap-disabled/index.html'),'utf8'),/data-sitemap-disabled=(?:"true"|true)/);
    assert.ok(fs.existsSync(path.join(output,prefix,'sitemap-never-list/index.html')));
    for(const name of ['unrendered','link','text','draft']) assert.ok(!fs.existsSync(path.join(output,prefix,`sitemap-${name}/index.html`)),name);
    for(const loc of locs) {
      const pathname=new URL(loc).pathname;
      assert.ok(fs.existsSync(path.join(output,pathname,'index.html')),`No HTML for ${loc}`);
    }
  }
  assert.equal(fs.existsSync(path.join(output,'en/llms.txt')),false,'Default language must use its native root LLMS output');
  assert.deepEqual((await inspect(output)).issues,[]);
  assert.deepEqual((await inspectLlms(output)).issues,[]);
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
  async function waitFor(present,absent,language='en') {
    const deadline=Date.now()+15000;let state='No response';
    while(Date.now()<deadline) {
      assert.equal(server.exitCode,null,logs);
      try {
        const [response,llms]=await Promise.all([`/${language}/sitemap.xml`,`/${language==='en'?'':language+'/'}llms.txt`].map(file=>fetch(base+file,{signal:AbortSignal.timeout(1000),headers:{Connection:'close'}})));
        if(response.ok&&llms.ok) {
          const pageURLs=urls(await response.text()),text=await llms.text();
          const locs=pageURLs.map(url=>new URL(url).pathname);
          const links=llmsUrls(text).map(url=>new URL(url).pathname);
          state=JSON.stringify({present,absent,sitemap:locs,llms:links});
          if(present.every(url=>locs.includes(url)) && absent.every(url=>!locs.includes(url))) {
            assertLlmsMatchesSitemap(text,pageURLs);
            return;
          }
        } else state=`HTTP sitemap=${response.status}, llms=${llms.status}`;
      } catch(error) {state=String(error.cause||error);}
      await delay(100);
    }
    assert.fail('Sitemap and LLMS rebuild timed out or their pages differ.\n'+state+'\n'+logs);
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
    const chinese=path.join(content,'sitemap-local/index.zh.md');
    await waitFor(['/zh/sitemap-local/'],[],'zh');
    write(chinese,page('local','sitemap: {disable: true}'));
    await waitFor(['/zh/sitemap-never-list/'],['/zh/sitemap-local/'],'zh');
    write(chinese,page('local','build: {list: local}'));
    await waitFor(['/zh/sitemap-local/','/zh/sitemap-never-list/'],[],'zh');
  } finally {
    if(server.exitCode===null) {
      const exited=new Promise(resolve=>server.once('exit',resolve));
      server.kill();await exited;
    }
    write(target,page('local',cases.local));
    write(path.join(content,'sitemap-local/index.zh.md'),page('local',cases.local));
  }
});

test('LLMS supports site subpaths, language routing, independent weights and disabled output',async()=>{
  const variants=[
    {name:'monolingual-subpath',config:'disableLanguages = ["zh", "zh-tw"]\n',base:'https://example.test/manual/',files:['llms.txt']},
    {name:'language-subdir',config:'defaultContentLanguageInSubdir = true\n',files:['en/llms.txt','zh/llms.txt','zh-tw/llms.txt']},
    {name:'language-weight',config:'[languages.en]\nweight = 9\n[languages.zh]\nweight = 1\n',files:['llms.txt','zh/llms.txt','zh-tw/llms.txt']},
    {name:'disabled',config:'[outputs]\nhome = ["HTML", "RSS"]\n',files:[]}
  ];
  for(const variant of variants) {
    const overlay=path.join(work,variant.name+'.toml'),destination=path.join(work,variant.name);
    write(overlay,variant.config);
    const result=spawnSync(toolExecutable('hugo'),['--noBuildLock','--config',`hugo.toml,${relative(config)},${relative(overlay)}`,
      '--enableGitInfo=false','--destination',destination,'--baseURL',variant.base||'https://example.test/'],
      {cwd:root,env:fixtureEnvironment(work),encoding:'utf8',timeout:30000,windowsHide:true});
    assert.ifError(result.error);assert.equal(result.status,0,variant.name+'\n'+result.stdout+result.stderr);
    for(const file of variant.files) {
      const text=fs.readFileSync(path.join(destination,file),'utf8');
      const sitemap=path.join(destination,file==='llms.txt'&&variant.name!=='monolingual-subpath'?'en':path.dirname(file),'sitemap.xml');
      assertLlmsMatchesSitemap(text,urls(fs.readFileSync(sitemap,'utf8')));
    }
    if(variant.name!=='language-subdir')assert.equal(fs.existsSync(path.join(destination,'en/llms.txt')),false,'Do not copy the default language LLMS');
    if(!variant.files.length)for(const prefix of ['','en','zh','zh-tw'])
      assert.equal(fs.existsSync(path.join(destination,prefix,'llms.txt')),false,'LLMS must remain optional');
    if(variant.files.length)assert.deepEqual((await inspectLlms(destination)).issues,[],variant.name);
  }
});
