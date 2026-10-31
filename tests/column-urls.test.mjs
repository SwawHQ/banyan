import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fixtureEnvironment,fixtureSiteFiles,fixtureSiteMounts,fixtureDelivery,serviceWorkerPolicy} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {extractCanonicalHref} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {listenOnLoopback} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/column-url-policy-tests');
const suffixes=['','.zh','.zh-tw','.ar'];
let work,source,output,configuration,buildNumber=0;
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
const section=(fields='')=>'---\ntitle: Column\nlayout: page-collection-directory\nparams:\n  slots: [breadcrumb]\n'+fields+'---\n';

function build(config=configuration) {
  output=path.join(work,'public-'+buildNumber++);
  write(path.join(source,'hugo.toml'),config);
  return spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--enableGitInfo=false','--destination',output],
    {cwd:source,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
}
function passed(result) {assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);}
function rejected(result,detail,context='') {
  assert.ifError(result.error);assert.notEqual(result.status,0,'A column address override must fail the build.\n'+context);
  assert.match(result.stdout+result.stderr,/Column URL/);
  assert.match(result.stdout+result.stderr,detail);
}
function changed(file,text,check,config=configuration) {
  const previous=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  write(file,text);
  try {check(build(config));} finally {
    if(previous===null)fs.rmSync(file);else write(file,previous);
  }
}
const content=relative=>path.join(source,'content',relative);

before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));
  source=path.join(work,'site');output=path.join(work,'public');
  fixtureSiteFiles(source);
  fs.mkdirSync(path.join(source,'themes'),{recursive:true});
  fs.cpSync(path.join(repository,'module'),path.join(source,'themes/banyan'),{recursive:true});
  write(path.join(source,'assets/site/delivery.toml'),fixtureDelivery(serviceWorkerPolicy('disable')));
  configuration='theme="banyan"\nbaseURL="https://example.test/base/"\ntitle="Column URL fixture"\n'+
    'defaultContentLanguage="en"\n[params.appearance]\npalette="css/theme.css"\n[minify]\ndisableJS=true\n'+
    '[taxonomies]\n[outputs]\nhome=["HTML"]\nsection=["HTML"]\npage=["HTML"]\n'+
    '[languages.en]\nlabel="English"\nweight=1\n[languages.zh]\nlabel="中文"\nweight=2\n'+
    '[languages.zh-tw]\nlabel="繁體"\nweight=3\n[languages.ar]\nlabel="العربية"\nweight=4\n'+
    '[[cascade]]\n[cascade.build]\npublishResources=false\n'+fixtureSiteMounts;
  for(const suffix of suffixes) {
    write(content('_index'+suffix+'.md'),'---\ntitle: Home\ndescription: Column address policy fixture.\nlayout: page-article-norss\n---\nHome.\n');
    write(content('docs/_index'+suffix+'.md'),section());
    write(content('docs/child/_index'+suffix+'.md'),section());
    write(content('docs/child/item'+suffix+'.md'),'---\ntitle: Stable article\nurl: p/stable/\nlayout: page-article-norss\n---\nArticle.\n');
    write(content('leaf/_index'+suffix+'.md'),'---\ntitle: Flat aggregate\nlayout: page-collection-directory-all\nparams:\n  aggregate: /docs\n  slots: [breadcrumb]\n---\n');
  }
});

after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('directory columns keep natural URLs while articles keep independent URLs',()=>{
  passed(build());
  for(const prefix of ['','zh/','zh-tw/','ar/']) {
    for(const route of ['docs/','docs/child/','leaf/','p/stable/']) {
      const html=fs.readFileSync(path.join(output,prefix,route,'index.html'),'utf8');
      assert.equal(extractCanonicalHref(html),'https://example.test/base/'+prefix+route);
    }
  }
});

test('columns reject explicit URL and slug overrides',()=>{
  for(const field of ['url','slug']) {
    changed(content('docs/child/_index.md'),section(field+': changed/\n'),result=>rejected(result,new RegExp(field)));
  }
});

test('homepage address fields fail instead of being silently ignored',()=>{
  for(const field of ['url','slug'])changed(content('_index.md'),
    '---\ntitle: Home\ndescription: Policy fixture.\nlayout: page-article-norss\n'+field+': changed/\n---\n',
    result=>rejected(result,new RegExp(field)));
});

test('inherited column address fields are rejected',()=>{
  for(const field of ['url','slug'])changed(content('docs/_index.md'),
    section('cascade:\n  - target: {kind: section, path: /docs/child}\n    '+field+': inherited/\n'),
    result=>rejected(result,new RegExp(field)));
});

test('global and language-specific section permalinks cannot move columns away from their directory',()=>{
  for(const extra of ['\n[permalinks.section]\ndocs="/moved/:sections[last]/"\n',
    '\n[languages.zh.permalinks.section]\ndocs="/moved/:sections[last]/"\n',
    '\n[[permalinks]]\npattern="/moved/:sections[last]/"\n[permalinks.target]\nkind="section"\npath="/docs/**"\n',
    '\n[[permalinks]]\npattern="/moved/:sections[last]/"\n[permalinks.target]\nkind="section"\npath="/docs/**"\n[permalinks.target.sites.matrix]\nlanguages="zh"\n']) {
    const result=build(configuration+extra);
    rejected(result,/directory/,extra);
  }
});

test('an unrendered ancestor still rejects explicit address overrides',()=>{
  for(const field of ['url','slug'])changed(content('docs/_index.md'),
    section('build: {render: never, list: local, publishResources: false}\n'+field+': changed/\n'),
    result=>rejected(result,new RegExp(field)));
});

test('aliases preserve old links without changing the current column address',()=>{
  changed(content('docs/child/_index.md'),section('aliases: [/old-child/]\n'),passed);
  assert.equal(extractCanonicalHref(fs.readFileSync(path.join(output,'docs/child/index.html'),'utf8')),
    'https://example.test/base/docs/child/');
  assert.ok(fs.existsSync(path.join(output,'old-child/index.html')));
});

test('standard Hugo case and Unicode URL normalization remains valid',()=>{
  changed(content('docs/UpperCase/_index.md'),section(),passed);
  assert.ok(fs.existsSync(path.join(output,'docs/uppercase/index.html')));
  changed(content('docs/中文+栏目/_index.md'),section(),passed);
  const html=fs.readFileSync(path.join(output,'docs/中文+栏目/index.html'),'utf8');
  assert.equal(decodeURIComponent(new URL(extractCanonicalHref(html)).pathname),'/base/docs/中文+栏目/');
});

test('case-preserving and accent-removing Hugo settings keep directory columns valid',()=>{
  const keepCase='disablePathToLower=true\n'+configuration;
  for(const name of ['UpperCase','Äpfel']) {
    changed(content('docs/'+name+'/_index.md'),section(),passed,keepCase);
    const html=fs.readFileSync(path.join(output,'docs',name,'index.html'),'utf8');
    assert.equal(decodeURIComponent(new URL(extractCanonicalHref(html)).pathname),'/base/docs/'+name+'/');
  }
  changed(content('docs/Äpfel/_index.md'),section(),passed,'disablePathToLower=true\nremovePathAccents=true\n'+configuration);
  const html=fs.readFileSync(path.join(output,'docs/Apfel/index.html'),'utf8');
  assert.equal(decodeURIComponent(new URL(extractCanonicalHref(html)).pathname),'/base/docs/Apfel/');
});

test('public column paths reject an intermediate directory without an index',()=>{
  changed(content('docs/virtual/child/_index.md'),section(),result=>{
    assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/Public navigation:[\s\S]*_index\.md/);
  });
});

test('unlisted collections cannot bypass their own address check when path slots are disabled',()=>{
  const file=content('leaf/_index.md');
  const leaf=fields=>'---\ntitle: Unlisted aggregate\nlayout: page-collection-directory-all\nbuild: {list: never}\n'+fields+
    'params:\n  aggregate: /docs\n  slots: []\n---\n';
  changed(file,leaf(''),passed);
  assert.ok(fs.existsSync(path.join(output,'leaf/index.html')),'An unlisted collection can still render HTML.');
  const checks=[];
  for(const field of ['url','slug'])changed(file,leaf(field+': changed/\n'),result=>checks.push({result,detail:new RegExp(field),name:field}));
  const override='\n[[permalinks]]\npattern="/moved-leaf/"\n[permalinks.target]\nkind="section"\npath="/leaf"\n'+
    '[permalinks.target.sites.matrix]\nlanguages="en"\n';
  changed(file,leaf(''),result=>checks.push({result,detail:/directory/,name:'permalink'}),configuration+override);
  const statuses=JSON.stringify(checks.map(({result,name})=>({name,status:result.status})));
  for(const {result,detail} of checks)rejected(result,detail,statuses);
});

test('preview edits invalidate cached URL checks and recover after removing the override',{timeout:60000},async()=>{
  const probe=net.createServer();
  await listenOnLoopback(probe);
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const base='http://127.0.0.1:'+port,file=content('docs/child/_index.md'),original=fs.readFileSync(file,'utf8');
  write(path.join(source,'hugo.toml'),configuration);
  const server=spawn(toolExecutable('hugo'),['server','--noBuildLock','--enableGitInfo=false','--disableLiveReload',
    '--bind','127.0.0.1','--port',String(port),'--baseURL',base,'--destination',path.join(work,'preview')],
    {cwd:source,env:fixtureEnvironment(work),windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='',launchError;
  server.on('error',error=>{launchError=error;});
  server.stdout.on('data',chunk=>{logs+=chunk;});server.stderr.on('data',chunk=>{logs+=chunk;});
  async function until(check) {
    const deadline=Date.now()+10000;let last;
    while(Date.now()<deadline) {
      if(launchError)throw launchError;
      assert.equal(server.exitCode,null,logs);
      try {if(await check())return;}catch(error){last=error;}
      await delay(100);
    }
    assert.fail('Column URL preview did not update: '+(last||'')+'\n'+logs);
  }
  async function current(title) {
    const response=await fetch(base+'/docs/child/',{signal:AbortSignal.timeout(1500),headers:{Connection:'close'}});
    return response.status===200&&(await response.text()).includes('<title>'+title+' - Column URL fixture</title>');
  }
  try {
    await until(()=>current('Column'));
    for(const field of ['url','slug']) {
      const offset=logs.length;
      write(file,original.replace('---\n','---\n'+field+': /changed-column/\n'));
      await until(()=>new RegExp('Column URL:[^\\r\\n]*\\b'+field+'\\b').test(logs.slice(offset)));
      const title='Recovered '+field;
      write(file,original.replace('title: Column','title: '+title));
      await until(()=>current(title));
    }
  } finally {
    if(server.exitCode===null) {
      const exited=new Promise(resolve=>server.once('exit',resolve));server.kill();await exited;
    }
    write(file,original);
  }
});
