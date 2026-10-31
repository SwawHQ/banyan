import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fixtureEnvironment,fixtureSiteFiles,fixtureSiteMounts,fixtureDelivery,serviceWorkerPolicy} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {extractCanonicalHref} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {listenOnLoopback} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/collection-structure-tests');
const layouts=['page-collection-directory-name-only','page-collection-directory','page-collection-directory-all',
  'page-collection-products','page-collection-products-all','page-collection-language','page-collection-appearance'];
let work,source,configuration,output,buildNumber=0;
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
const content=relative=>path.join(source,'content',relative);
const collection=(layout,fields='')=>'---\ntitle: Collection\nlayout: '+layout+'\noutputs: [HTML]\n'+fields+
  'params:\n  slots: []\n  labels: {back: Back, auto: Auto, light: Light, dark: Dark, missing_translation: Missing}\n'+
  (layout.endsWith('-all')?'  aggregate: /docs\n':'')+'---\n';
const article=title=>'---\ntitle: '+title+'\nurl: p/probe/\nlayout: page-article-norss\nparams: {slots: []}\n---\nArticle.\n';

function build() {
  output=path.join(work,'public-'+buildNumber++);
  return spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--enableGitInfo=false','--destination',output],
    {cwd:source,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
}
function passed(result) {assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);}
function rejected(result) {
  assert.ifError(result.error);assert.notEqual(result.status,0,'A regular page must not use a collection layout.');
  assert.match(result.stdout+result.stderr,/Collection page[^\r\n]*_index\.md/);
}
function changed(file,text,check) {
  const previous=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  write(file,text);
  try {check(build());} finally {if(previous===null)fs.rmSync(file);else write(file,previous);}
}

before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));source=path.join(work,'site');
  fixtureSiteFiles(source);fs.mkdirSync(path.join(source,'themes'),{recursive:true});
  fs.cpSync(path.join(repository,'module'),path.join(source,'themes/banyan'),{recursive:true});
  write(path.join(source,'assets/site/delivery.toml'),fixtureDelivery(serviceWorkerPolicy('disable')));
  configuration='theme="banyan"\nbaseURL="https://example.test/base/"\ntitle="Structure fixture"\n'+
    '[params.appearance]\npalette="css/theme.css"\n[minify]\ndisableJS=true\n[taxonomies]\n'+
    '[outputs]\nhome=["HTML"]\nsection=["HTML"]\npage=["HTML"]\n'+
    '[[cascade]]\n[cascade.build]\npublishResources=false\n'+fixtureSiteMounts;
  write(path.join(source,'hugo.toml'),configuration);
  write(content('_index.md'),'---\ntitle: Home\ndescription: Collection structure fixture.\nlayout: page-article-norss\n---\nHome.\n');
  write(content('docs/_index.md'),collection('page-collection-directory'));
  write(content('docs/item.md'),'---\ntitle: Source article\nurl: p/source/\nlayout: page-article-norss\n---\nSource.\n');
});

after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('all collection layouts require section bundles while article index pages keep independent URLs',()=>{
  for(const [index,layout] of layouts.entries())write(content('section-'+index+'/_index.md'),collection(layout));
  write(content('probe/index.md'),article('Article'));
  passed(build());
  for(const index of layouts.keys())assert.ok(fs.existsSync(path.join(output,'section-'+index+'/index.html')));
  assert.equal(extractCanonicalHref(fs.readFileSync(path.join(output,'p/probe/index.html'),'utf8')),
    'https://example.test/base/p/probe/');
  fs.rmSync(content('probe/index.md'));
});

test('each collection layout rejects an ordinary index page',()=>{
  for(const layout of layouts)changed(content('probe/index.md'),collection(layout),rejected);
});

test('ordinary Markdown, inherited layouts and unlisted or unrendered pages cannot bypass the section rule',()=>{
  changed(content('probe.md'),collection('page-collection-directory-name-only'),rejected);
  changed(content('probe/index.md'),collection('page-collection-directory-all','build: {list: never}\n'),rejected);
  changed(content('probe/index.md'),collection('page-collection-directory-all','build: {render: never}\n'),rejected);
  const home=content('_index.md'),original=fs.readFileSync(home,'utf8');
  write(home,original.replace('---\n','---\ncascade:\n  - target: {kind: page, path: /probe}\n    layout: page-collection-directory-name-only\n'));
  try {changed(content('probe/index.md'),'---\ntitle: Inherited\nparams: {slots: []}\n---\n',rejected);}
  finally {write(home,original);}
});

test('public navigation requires explicit section pages and rendered ancestors',()=>{
  const check=result=>{
    assert.ifError(result.error);assert.notEqual(result.status,0);
    assert.match(result.stdout+result.stderr,/Public navigation:/);
  };
  changed(content('docs/implicit/child/_index.md'),collection('page-collection-directory'),result=>{
    check(result);assert.match(result.stdout+result.stderr,/_index\.md/);
  });
  changed(content('implicit-root/child/_index.md'),collection('page-collection-directory'),result=>{
    check(result);assert.match(result.stdout+result.stderr,/_index\.md/);
  });
  for(const file of ['docs/missing/item/index.md','docs/missing/item.md'])
    changed(content(file),article('Missing section').replace('slots: []','slots: [breadcrumb]'),result=>{
      check(result);assert.match(result.stdout+result.stderr,/_index\.md/);
    });
  const child=content('docs/child/_index.md');write(child,collection('page-collection-directory'));
  try {
    for(const value of [collection('page-collection-directory','build: {render: never}\n'),
      collection('page-collection-directory','build: {render: link}\n'),collection('page-collection-directory').replace('outputs: [HTML]','outputs: [RSS]')])
      changed(content('docs/_index.md'),value,result=>{
        check(result);assert.match(result.stdout+result.stderr,/requires an HTML page/);
      });
  } finally {fs.rmSync(path.dirname(child),{recursive:true,force:true});}
});

test('visible read-only ancestors work and internal hidden trees need no path columns',()=>{
  changed(content('docs/direct/index.md'),article('Direct leaf').replace('slots: []','slots: [breadcrumb]'),passed);
  changed(content('docs/_index.md'),'---\ntitle: Read only\nlayout: page-article-norss\noutputs: [HTML]\n---\n',passed);
  const internal=content('_res/private');
  write(path.join(internal,'_index.md'),'---\ntitle: Internal\nlayout: page-article-norss\nbuild: {list: never, render: never}\nparams: {slots: []}\n---\n');
  write(path.join(internal,'nested/item.md'),article('Internal item').replace('p/probe/','_res/private-item/'));
  try {passed(build());} finally {fs.rmSync(internal,{recursive:true,force:true});}
});

test('preview rejects changing an article into a collection and recovers after restoring it',{timeout:60000},async()=>{
  const probe=net.createServer();
  await listenOnLoopback(probe);
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const file=content('probe/index.md'),base='http://127.0.0.1:'+port;
  write(file,article('Article'));
  const server=spawn(toolExecutable('hugo'),['server','--noBuildLock','--enableGitInfo=false','--disableLiveReload',
    '--bind','127.0.0.1','--port',String(port),'--baseURL',base,'--destination',path.join(work,'preview')],
    {cwd:source,env:fixtureEnvironment(work),windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='',launchError;
  server.on('error',error=>{launchError=error;});
  server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  async function until(check) {
    const deadline=Date.now()+10000;let last;
    while(Date.now()<deadline) {
      if(launchError)throw launchError;assert.equal(server.exitCode,null,logs);
      try {if(await check())return;}catch(error){last=error;}
      await delay(100);
    }
    assert.fail('Collection preview did not update: '+(last||'')+'\n'+logs);
  }
  async function current(title) {
    const response=await fetch(base+'/p/probe/',{signal:AbortSignal.timeout(1500),headers:{Connection:'close'}});
    return response.status===200&&(await response.text()).includes('<title>'+title+' - Structure fixture</title>');
  }
  try {
    await until(()=>current('Article'));const offset=logs.length;
    write(file,collection('page-collection-directory-all'));
    await until(()=>/Collection page[^\r\n]*_index\.md/.test(logs.slice(offset)));
    write(file,article('Recovered'));await until(()=>current('Recovered'));
  } finally {
    if(server.exitCode===null){const exited=new Promise(resolve=>server.once('exit',resolve));server.kill();await exited;}
    fs.rmSync(file);
  }
});
