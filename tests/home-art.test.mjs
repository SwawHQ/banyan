import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {fixtureEnvironment,fixtureSiteFiles} from './_shared/hugo.mjs';
import {toolExecutable} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/operations.mjs';
import {listenOnLoopback} from '../.agents/skills/swaw-banyan/tasks/check/browser/_shared/server.mjs';
import {inspect as inspectStyles} from '../.agents/skills/swaw-banyan/tasks/check/html/styles/inspect.mjs';
import {inspect as inspectSri} from '../.agents/skills/swaw-banyan/tasks/check/sri/inspect.mjs';
import {inspect as inspectDelivery} from '../.agents/skills/swaw-banyan/tasks/check/delivery/inspect.mjs';
import {verifyCspOutput} from '../.agents/skills/swaw-banyan/tasks/check/csp/verify.mjs';
import {extractBlocks} from '../.agents/skills/swaw-banyan/tasks/_shared/html/blocks.mjs';
import {extractStartTags,extractTagAttribute,extractCanonicalHref,decodeHtmlAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {filesUnder} from '../.agents/skills/swaw-banyan/tasks/_shared/output.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),parent=path.join(fs.realpathSync(os.tmpdir()),'swaw/banyan/home-art');
const languages=[['','en'],['zh/','zh'],['ar/','ar']],wind='/_res/home-art/wind';
const entry=source=>'{{< home-art '+JSON.stringify(source)+' >}}';
let work,site;
function write(file,text){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
const suffix=language=>language==='en'?'':'.'+language;
function home(index,body,extra='') {
  return '---\ntitle: Home identity '+index+'\ndescription: Home description '+index+'\nlayout: page-home\nparams:\n  icon: home\n  browser_title: Browser identity '+index+'\n'+extra+'---\n\n'+body+'\n';
}
function artPage(title,params,body,extra='') {
  return '---\ntitle: '+JSON.stringify(title)+'\n'+extra+'params:\n'+params+'---\n\n'+body+'\n';
}
function windPage(index,prefix) {
  return artPage('Art source '+index,'  template: scene.html.tmpl\n  styles: [style.css]\n  scripts: [script.js]\n'+
    '  brand_line: "wind line '+index+'"\n  signal_drift_seconds: 80\n  signals:\n'+
    '    - name: "wind signal '+index+'"\n      url: /'+prefix+'about/\n      primary: true\n','');
}
function prepare(name) {
  const source=path.join(work,name);fixtureSiteFiles(source);
  write(path.join(source,'hugo.toml'),fs.readFileSync(path.join(root,'hugo.toml'),'utf8'));
  write(path.join(source,'go.mod'),'module fixture.invalid/home-art\n\ngo 1.18\n\nrequire github.com/SwawHQ/banyan/module v0.0.0\n\n'+
    'replace github.com/SwawHQ/banyan/module => '+JSON.stringify(path.join(root,'module').replaceAll('\\','/'))+'\n');
  return source;
}
function homes(source,body=entry(wind),extra='') {
  for(const [index,[,language]] of languages.entries())
    write(path.join(source,'content/_index'+suffix(language)+'.md'),home(index,typeof body==='function'?body(language):body,typeof extra==='function'?extra(language):extra));
}
function build(name,body=entry(wind),source=site,extra='') {
  homes(source,body,extra);
  const output=path.join(work,name),result=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',output],
    {cwd:source,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(result.error);return {output,result};
}
function passed(name,body,source,extra) {
  const {output,result}=build(name,body,source,extra);assert.equal(result.status,0,result.stdout+result.stderr);return output;
}
const htmlAt=(output,prefix)=>fs.readFileSync(path.join(output,prefix,'index.html'),'utf8');
const artSource=html=>extractTagAttribute(extractStartTags(html,'body')[0],'data-home-art-source');
function assetsIn(html,tag,attribute) {
  return extractStartTags(html,tag).filter(item=>extractTagAttribute(item,'data-home-art'))
    .map(item=>({source:extractTagAttribute(item,'data-home-art'),url:extractTagAttribute(item,attribute)}));
}
async function checked(output) {
  assert.deepEqual((await inspectStyles(output)).issues,[]);assert.deepEqual((await inspectSri(output)).issues,[]);
  assert.deepEqual((await inspectDelivery(output)).issues,[]);verifyCspOutput(output);
}
before(()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'run-'));site=prepare('source');
  for(const [index,[prefix,language]] of languages.entries())
    write(path.join(site,'content/_res/home-art/wind/index'+suffix(language)+'.md'),windPage(index,prefix));
});
after(()=>{if(work){assert.equal(path.dirname(fs.realpathSync(work)),parent);fs.rmSync(work,{recursive:true,force:true});}});

test('home body selects a translated hidden bundle while root identity stays intact',async()=>{
  const output=passed('wind');
  for(const [index,[prefix]] of languages.entries()) {
    const html=htmlAt(output,prefix);assert.equal(artSource(html),wind);
    assert.ok(html.includes('<title>Browser identity '+index+'</title>'));assert.equal(extractCanonicalHref(html),'https://banyan.swaw.com/'+prefix);
    assert.ok(extractStartTags(html,'meta').some(tag=>extractTagAttribute(tag,'name')==='description'&&extractTagAttribute(tag,'content')==='Home description '+index));
    assert.ok(html.includes('Home identity '+index));assert.ok(html.includes('wind line '+index));assert.ok(html.includes('wind signal '+index));
    assert.equal(extractStartTags(html,'nav').filter(tag=>tag.includes('data-root-navigation')).length,1);
    const styles=assetsIn(html,'link','href'),scripts=assetsIn(html,'script','src');
    assert.equal(styles.length,2);assert.equal(scripts.length,1);
    assert.equal(new Set(styles.map(item=>item.url)).size,styles.length);
    for(const resource of [...styles,...scripts]) {
      assert.equal(resource.source,wind);assert.match(resource.url,/\.[a-f0-9]{64}\.(?:css|js)$/);assert.ok(fs.existsSync(path.join(output,resource.url)));
    }
    assert.equal(fs.existsSync(path.join(output,prefix,'_res/home-art')),false);
    for(const name of ['index.xml','llms.txt'])assert.equal(fs.readFileSync(path.join(output,prefix,name),'utf8').includes('/_res/home-art/'),false);
    assert.equal(fs.readFileSync(path.join(output,prefix||'en/','sitemap.xml'),'utf8').includes('/_res/home-art/'),false);
  }
  const files=await filesUnder(output);assert.equal(files.some(file=>/unused|\.(?:md|toml|tmpl)$/.test(file)),false);
  assert.equal(files.some(file=>file.includes('home-art-render')),false);
  await checked(output);
});

test('a bundle template can render a different art with no wind assets or navigation',async()=>{
  const source='/_res/home-art/contract',bundle=path.join(site,'content',source);
  for(const [index,[,language]] of languages.entries())
    write(path.join(bundle,'index'+suffix(language)+'.md'),artPage('Source only '+index,
      '  template: scene.html.tmpl\n  styles: [style.css]\n  scripts: [script.js]\n  brand_line: '+JSON.stringify('<em>Art '+index+'</em>')+'\n',
      '**Art body**'));
  write(path.join(bundle,'style.css'),'@import "./tokens.css";@font-face{font-family:ArtFixture;src:url("./font.woff2") format("woff2")}.contract-scene{display:block;background-image:url("./badge.svg");color:var(--contract-ink)}');
  write(path.join(bundle,'tokens.css'),':root{--contract-ink:currentColor}');
  write(path.join(bundle,'script.js'),'import {message} from "./message.js";document.documentElement.dataset.contractArt=message;');
  write(path.join(bundle,'message.js'),'export const message="ART_IMPORT_READY";');
  // The CSS file loader copies opaque bytes; this font face is not used for text.
  write(path.join(bundle,'font.woff2'),'font fixture bytes');
  write(path.join(bundle,'badge.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0Z"/></svg>');
  write(path.join(bundle,'unused.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
  write(path.join(bundle,'scene.html.tmpl'),'<section class="contract-scene"><h1>{{ .Site.Home.Title | htmlEscape }}</h1>'+
    '<p class="contract-line">{{ .Params.brand_line | htmlEscape }}</p><span data-art-language="{{ .Language.Lang }}"></span>'+
    '{{ partial "system-ui/icon/render.html" (dict "name" "info") }}'+
    '{{ $image := partial "system-assets/publish-page.html" (dict "ctx" . "src" "badge.svg") }}<img src="{{ $image.src | htmlEscape }}" alt="Art badge">{{ .Content }}</section>');
  const output=passed('contract',entry(source),site,'  show_navigation: false\n');
  for(const [index,[prefix,language]] of languages.entries()) {
    const html=htmlAt(output,prefix);assert.equal(artSource(html),source);
    assert.equal(extractTagAttribute(extractStartTags(html,'body')[0],'data-home-navigation'),'false');
    assert.equal(extractStartTags(html,'nav').filter(tag=>tag.includes('data-root-navigation')).length,0);
    assert.equal(extractStartTags(html,'div').filter(tag=>extractTagAttribute(tag,'class').split(/\s+/).includes('page-rail')).length,0);
    assert.ok(html.includes('Home identity '+index));
    assert.ok(html.includes('<strong>Art body</strong>'));
    assert.ok(extractStartTags(html,'span').some(tag=>extractTagAttribute(tag,'data-art-language')===language));
    const line=extractBlocks(html,'p',tag=>extractTagAttribute(tag,'class')==='contract-line')[0].inner;
    assert.equal(decodeHtmlAttribute(line),'<em>Art '+index+'</em>');assert.doesNotMatch(line,/<em>/);
    assert.ok(extractStartTags(html,'symbol').some(tag=>extractTagAttribute(tag,'id')==='icon-info'));
    assert.equal(assetsIn(html,'link','href').length,1);assert.equal(assetsIn(html,'script','src').length,1);
    assert.equal(html.includes('home-art-wind__windsock'),false);
  }
  const files=(await filesUnder(output)).map(file=>path.relative(output,file).replaceAll('\\','/'));
  assert.equal(files.some(file=>/^(?:css|js)\/home-art\/wind\//.test(file)),false);
  assert.equal(files.some(file=>/unused|\.(?:md|toml|tmpl)$/.test(file)),false);
  await checked(output);
  const style=assetsIn(htmlAt(output,''),'link','href')[0].url,css=fs.readFileSync(path.join(output,style),'utf8');
  const dependencies=[...css.matchAll(/url\(["']?([^\s)"']+)["']?\)/g)].map(match=>match[1]);
  assert.equal(dependencies.length,2);
  for(const url of dependencies) {
    assert.match(url,/-[A-Z2-7]{8}\.(?:svg|woff2)$/);
    assert.ok(fs.existsSync(path.join(output,new URL(url,'https://fixture.invalid'+style).pathname)));
  }
  const script=assetsIn(htmlAt(output,''),'script','src')[0].url;
  assert.ok(fs.readFileSync(path.join(output,script),'utf8').includes('ART_IMPORT_READY'));
  write(path.join(bundle,'badge.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><circle cx="1" cy="1" r="1"/></svg>');
  write(path.join(bundle,'font.woff2'),'changed font fixture bytes');
  const changed=passed('contract-changed',entry(source),site,'  show_navigation: false\n'),nextStyle=assetsIn(htmlAt(changed,''),'link','href')[0].url;
  assert.notEqual(nextStyle,style);
  const nextCSS=fs.readFileSync(path.join(changed,nextStyle),'utf8');
  for(const url of dependencies)assert.equal(nextCSS.includes(url),false,'Changed CSS dependencies must receive new URLs.');
  await checked(changed);
});

test('copied bundles keep their own resource paths across languages',async()=>{
  const source=prepare('copied'),original=path.join(source,'content/_res/home-art/wind'),copy=path.join(source,'content/_res/home-art/breeze');
  fs.cpSync(original,copy,{recursive:true});fs.appendFileSync(path.join(copy,'style.css'),'\n.breeze-fixture{--art-fixture:1}\n');
  fs.appendFileSync(path.join(copy,'script.js'),'\ndocument.documentElement.dataset.breezeArt="selected";\n');
  const template=path.join(copy,'scene.html.tmpl');
  write(template,fs.readFileSync(template,'utf8').replace('<section class=','<section data-copy-template="breeze" class=').replace('$horizonOffsetRem := 31.2','$horizonOffsetRem := 30.2'));
  const output=passed('mixed',language=>entry(language==='en'?wind:'/_res/home-art/breeze'),source);
  function resource(prefix,tag,attribute,extension) {
    const row=assetsIn(htmlAt(output,prefix),tag,attribute).find(item=>item.url.includes('/home-art/')&&item.url.endsWith(extension));
    assert.ok(row);return {...row,text:fs.readFileSync(path.join(output,row.url),'utf8')};
  }
  for(const [tag,attribute,extension,marker] of [['link','href','.css','breeze-fixture'],['script','src','.js','breezeArt']]) {
    const first=resource('',tag,attribute,extension),second=resource('zh/',tag,attribute,extension);
    assert.notEqual(first.url,second.url);assert.equal(first.text.includes(marker),false);assert.ok(second.text.includes(marker));
  }
  const sceneStyle=assetsIn(htmlAt(output,'zh/'),'link','href').find(item=>item.url.includes('/home-art/breeze/scene.'));
  assert.ok(sceneStyle);assert.ok(fs.readFileSync(path.join(output,sceneStyle.url),'utf8').includes('--home-art-wind-field-height:24.2rem'));
  assert.equal(htmlAt(output,'').includes('data-copy-template'),false);
  assert.equal(fs.realpathSync(original),path.join(fs.realpathSync(source),'content','_res','home-art','wind'));
  fs.rmSync(original,{recursive:true,force:true});
  const renamed=passed('renamed',entry('/_res/home-art/breeze'),source);
  for(const [prefix] of languages) {
    const html=htmlAt(renamed,prefix);assert.equal(artSource(html),'/_res/home-art/breeze');
    assert.ok(extractStartTags(html,'section').some(tag=>extractTagAttribute(tag,'data-copy-template')==='breeze'));
    for(const item of [...assetsIn(html,'link','href'),...assetsIn(html,'script','src')])assert.ok(item.url.includes('/home-art/breeze/'));
  }
  await checked(output);await checked(renamed);
});

test('minimal art renders all translations without wind resources or scripts',async()=>{
  const output=passed('minimal',entry('/_res/home-art/minimal'));
  for(const [prefix,language] of languages) {
    const html=htmlAt(output,prefix),heading={en:'A place to begin',zh:'从这里开始',ar:'ابدأ من هنا'}[language];
    assert.equal(artSource(html),'/_res/home-art/minimal');assert.ok(html.includes(heading));
    assert.ok(html.includes('<strong>'));assert.equal(html.includes('home-art-wind'),false);
    const styles=assetsIn(html,'link','href');assert.equal(styles.length,1);assert.ok(styles[0].url.includes('/home-art/minimal/style.'));
    assert.equal(assetsIn(html,'script','src').length,0);
  }
  await checked(output);
});

test('the host homepage controls navigation without an art and independently for each language',async()=>{
  const output=passed('plain-home','Plain home.',site,language=>language==='en'?'  show_navigation: false\n':'');
  for(const [prefix,language] of languages) {
    const html=htmlAt(output,prefix),visible=language!=='en';
    assert.equal(artSource(html),'');assert.ok(html.includes('Plain home.'));
    assert.equal(extractTagAttribute(extractStartTags(html,'body')[0],'data-home-navigation'),String(visible));
    assert.equal(extractStartTags(html,'div').filter(tag=>extractTagAttribute(tag,'class').split(/\s+/).includes('page-rail')).length,visible?1:0);
  }
  await checked(output);
});

test('Hugo preview rebuilds art params, body, template and assets and clears a removed entry',{timeout:120000},async()=>{
  const source=prepare('preview'),bundle=path.join(source,'content/_res/home-art/wind');
  for(const [index,[prefix,language]] of languages.entries())
    write(path.join(bundle,'index'+suffix(language)+'.md'),windPage(index,prefix));
  homes(source,entry(wind),'  show_navigation: false\n');
  const scene='content/_res/home-art/wind/scene.html.tmpl';
  const probe=net.createServer();await listenOnLoopback(probe);
  const port=probe.address().port;await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
  const base='http://127.0.0.1:'+port,server=spawn(toolExecutable('hugo'),['server','--noBuildLock','--bind','127.0.0.1','--port',String(port),
    '--baseURL',base,'--disableLiveReload','--destination',path.join(work,'preview-build')],
    {cwd:source,env:fixtureEnvironment(path.join(work,'preview-cache')),windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='',launchError;server.on('error',error=>{launchError=error;});
  for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{logs+=chunk;});
  async function read(url) {
    const response=await fetch(base+url,{signal:AbortSignal.timeout(2000),headers:{Connection:'close'}});
    assert.equal(response.status,200,url);return response.text();
  }
  async function until(check) {
    const deadline=Date.now()+15000;let lastError;
    while(Date.now()<deadline) {
      if(launchError)throw launchError;
      if(server.exitCode!==null||server.signalCode!==null)throw new Error(logs);
      try {if(await check())return;}catch(error){lastError=error;}await delay(100);
    }
    throw new Error('Art preview did not rebuild: '+(lastError||'')+'\n'+logs);
  }
  function reference(html,tag,attribute,fragment) {
    const value=extractStartTags(html,tag).map(item=>extractTagAttribute(item,attribute)).find(item=>item.includes(fragment));
    assert.ok(value,fragment);return value;
  }
  function change(relative,transform) {
    const file=path.join(source,relative),previous=fs.readFileSync(file,'utf8'),next=transform(previous);
    assert.notEqual(next,previous,'Preview probe changes '+relative);write(file,next);
  }
  try {
    await until(async()=>artSource(await read('/zh/'))===wind);
    homes(source,entry('/_res/home-art/minimal'));
    for(const [prefix] of languages)await until(async()=>{
      const html=await read('/'+prefix);return artSource(html)==='/_res/home-art/minimal'&&assetsIn(html,'link','href').length===1&&assetsIn(html,'script','src').length===0&&!html.includes('home-art-wind');
    });
    change('content/_res/home-art/minimal/index.zh.md',text=>text.replace('heading: 从这里开始','heading: MINIMAL_HEADING_PROBE')+'\nMINIMAL_BODY_PROBE\n');
    await until(async()=>{const html=await read('/zh/');return html.includes('MINIMAL_HEADING_PROBE')&&html.includes('MINIMAL_BODY_PROBE');});
    change('content/_res/home-art/minimal/scene.html.tmpl',text=>text.replace('<section class=','<section data-minimal-probe="yes" class='));
    for(const [prefix] of languages)await until(async()=>(await read('/'+prefix)).includes('data-minimal-probe="yes"'));
    change('content/_res/home-art/minimal/style.css',text=>text+'\n.home-art-minimal{--minimal-probe:1}\n');
    await until(async()=>(await read(reference(await read('/zh/'),'link','href','/css/home-art/minimal/style.'))).includes('--minimal-probe:1'));
    homes(source,entry(wind),'  show_navigation: false\n');
    for(const [prefix] of languages)await until(async()=>{const html=await read('/'+prefix);return artSource(html)===wind&&assetsIn(html,'link','href').length===2&&assetsIn(html,'script','src').length===1&&!html.includes('home-art-minimal');});
    const initialScene=reference(await read('/zh/'),'link','href','/css/home-art/wind/scene.');
    change('content/_res/home-art/wind/index.zh.md',text=>text.replace('brand_line: "wind line 1"','brand_line: "ART_CONFIG_PROBE"').replace('signal_drift_seconds: 80','signal_drift_seconds: 78'));
    await until(async()=>(await read('/zh/')).includes('ART_CONFIG_PROBE'));
    await until(async()=>reference(await read('/zh/'),'link','href','/css/home-art/wind/scene.')!==initialScene);
    change('content/_res/home-art/wind/index.zh.md',text=>text+'\nART_BODY_PROBE\n');
    await until(async()=>(await read('/zh/')).includes('ART_BODY_PROBE'));
    change(scene,text=>text.replace('<section class="home-art-wind"','<section data-art-render-probe="yes" class="home-art-wind"'));
    await until(async()=>extractStartTags(await read('/zh/'),'section').some(tag=>extractTagAttribute(tag,'data-art-render-probe')==='yes'));
    change(scene,text=>text.replace('$horizonOffsetRem := 31.2','$horizonOffsetRem := 30.2'));
    await until(async()=>(await read(reference(await read('/zh/'),'link','href','/css/home-art/wind/scene.'))).includes('--home-art-wind-field-height:24.2rem'));
    change('content/_res/home-art/wind/style.css',text=>text+'\n:root{--art-css-probe:1}\n');
    await until(async()=>(await read(reference(await read('/zh/'),'link','href','/css/home-art/wind/style.'))).includes('--art-css-probe:1'));
    change('content/_res/home-art/wind/script.js',text=>text+'\nglobalThis.ART_JS_PROBE=true;\n');
    await until(async()=>(await read(reference(await read('/zh/'),'script','src','/js/home-art/wind/script.'))).includes('ART_JS_PROBE'));
    write(path.join(source,'content/_index.zh.md'),home(1,'Plain home.','  show_navigation: false\n'));
    await until(async()=>{
      const html=await read('/zh/');
      return !artSource(html)&&html.includes('Plain home.')&&assetsIn(html,'link','href').length===0&&assetsIn(html,'script','src').length===0
        &&extractStartTags(html,'nav').every(tag=>!tag.includes('data-root-navigation'));
    });
    write(path.join(source,'content/_index.zh.md'),home(1,'Plain home.'));
    await until(async()=>extractStartTags(await read('/zh/'),'nav').some(tag=>tag.includes('data-root-navigation')));
    write(path.join(source,'content/_index.zh.md'),home(1,entry(wind),'  show_navigation: false\n'));
    await until(async()=>{
      const html=await read('/zh/');
      return artSource(html)===wind&&assetsIn(html,'link','href').length===2&&assetsIn(html,'script','src').length===1
        &&extractStartTags(html,'nav').every(tag=>!tag.includes('data-root-navigation'));
    });
  }finally {
    if(server.pid&&server.exitCode===null) {
      const stopped=new Promise(resolve=>server.once('exit',resolve));assert.ok(server.kill(),'Could not stop test Hugo process.');await stopped;
    }
  }
});

test('wind signals accept canonical objects and text, and reject unsupported fields',()=>{
  const source=prepare('signal-fields'),file=path.join(source,'content/_res/home-art/wind/index.md');
  const params='  template: scene.html.tmpl\n  styles: [style.css]\n  scripts: [script.js]\n  signals:\n';
  const body='';
  write(file,artPage('Signals',params+'    - Plain signal\n    - name: Canonical signal\n      url: /about/\n      primary: true\n',body));
  const output=passed('canonical-signals',entry(wind),source),html=htmlAt(output,'');
  assert.ok(html.includes('Plain signal'));assert.ok(html.includes('Canonical signal'));
  assert.ok(extractStartTags(html,'a').some(tag=>tag.includes('data-home-art-wind-signal')&&extractTagAttribute(tag,'href')==='/about/'));
  for(const field of ['title','label','href']) {
    write(file,artPage('Signals',params+'    - name: Canonical signal\n      '+field+': unsupported\n',body));
    const {result}=build('invalid-signal-'+field,entry(wind),source);
    assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,new RegExp('unsupported signal field.*'+field));
  }
  write(file,artPage('Signals',params+'    - url: /about/\n',body));
  const {result}=build('invalid-signal-name',entry(wind),source);
  assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/signal objects require a non-empty name/);
});

test('wind templates escape text and quoted link attributes',()=>{
  const source=prepare('escaped-wind'),file=path.join(source,'content/_res/home-art/wind/index.md');
  const label='<em>Wind & "quoted"</em>',url='https://example.com/?q="quoted"&x=1';
  write(file,artPage('Wind','  template: scene.html.tmpl\n  brand_line: '+JSON.stringify(label)+'\n  signals:\n    - name: '+JSON.stringify(label)+'\n      url: '+JSON.stringify(url)+'\n','**Body stays Markdown**'));
  const html=htmlAt(passed('escaped-wind',entry(wind),source),'');
  assert.doesNotMatch(html,/<em>/);assert.ok(html.includes('<strong>Body stays Markdown</strong>'));
  const link=extractStartTags(html,'a').find(tag=>tag.includes('data-home-art-wind-signal'));
  assert.equal(extractTagAttribute(link,'href'),url);
  const line=extractBlocks(html,'p',tag=>extractTagAttribute(tag,'class')==='home-art-wind__anchor-line')[0].inner;
  assert.equal(decodeHtmlAttribute(line),label);
});

test('invalid entries and bundle resource declarations fail during build',()=>{
  const wrongLayout=prepare('invalid-home-layout');
  homes(wrongLayout,entry(wind));
  const homepage=path.join(wrongLayout,'content/_index.md');
  write(homepage,fs.readFileSync(homepage,'utf8').replace('layout: page-home','layout: page-article-norss'));
  const layoutBuild=spawnSync(toolExecutable('hugo'),['--minify','--noBuildLock','--destination',path.join(work,'invalid-home-layout-output')],
    {cwd:wrongLayout,env:fixtureEnvironment(work),encoding:'utf8',timeout:60000,windowsHide:true});
  assert.ifError(layoutBuild.error);assert.notEqual(layoutBuild.status,0);
  assert.match(layoutBuild.stdout+layoutBuild.stderr,/home-art requires homepage layout: page-home/);
  for(const [name,body] of [
    ['argument','{{< home-art >}}'],['relative',entry('_res/home-art/wind')],['outside',entry('/about/')],
    ['traversal',entry('/_res/home-art/../home-art/wind')],['missing',entry('/_res/home-art/missing')],
    ['duplicate',entry(wind)+'\n'+entry(wind)]
  ]) {
    const {result}=build('invalid-'+name,body);assert.notEqual(result.status,0,name);assert.match(result.stdout+result.stderr,/home-art|home art/i);
  }
  const invalid=path.join(site,'content/_res/home-art/invalid');
  write(path.join(invalid,'scene.html.tmpl'),'{{ .Content }}');
  const invalidNavigation=build('invalid-navigation-type',entry(wind),site,'  show_navigation: "false"\n').result;
  assert.notEqual(invalidNavigation.status,0);assert.match(invalidNavigation.stdout+invalidNavigation.stderr,/homepage.*show_navigation/);
  for(const [name,params,extra,body] of [
    ['styles-type','  styles: style.css\n','','Invalid art.'],
    ['scripts-type','  scripts: [42]\n','','Invalid art.'],
    ['missing-style','  styles: [missing.css]\n','','Invalid art.'],
    ['missing-script','  scripts: [missing.js]\n','','Invalid art.'],
    ['resource-path','  styles: [../style.css]\n','','Invalid art.'],
    ['visible','  styles: []\n','build: {render: link}\n','Invalid art.'],
    ['nested','  styles: []\n','',entry(wind)]
  ]) {
    for(const [,language] of languages)write(path.join(invalid,'index'+suffix(language)+'.md'),artPage('Invalid art','  template: scene.html.tmpl\n'+params,body,extra));
    const {result}=build('invalid-'+name,entry('/_res/home-art/invalid'));assert.notEqual(result.status,0,name);assert.match(result.stdout+result.stderr,/home-art|home art/i);
  }
  for(const value of [null,42,'','../scene.html.tmpl','/scene.html.tmpl','scene.html','missing.html.tmpl']) {
    for(const [,language] of languages)write(path.join(invalid,'index'+suffix(language)+'.md'),artPage('Invalid template',value===null?'  styles: []\n':'  template: '+JSON.stringify(value)+'\n',''));
    const {result}=build('invalid-template',entry('/_res/home-art/invalid'));assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/home-art.*template/);
  }
  const article=path.join(site,'content/entry-article/index.md');
  write(article,'---\ntitle: Article entry\nurl: article-entry/\nlayout: page-article-norss\n---\n'+entry(wind));
  try {const {result}=build('invalid-article');assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/home-art|homepage|home page/i);}
  finally {fs.unlinkSync(article);}
});
