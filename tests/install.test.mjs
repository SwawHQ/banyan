import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {zip} from './fixtures/zip.mjs';
import {filesUnder,relativeName} from '../.agents/skills/swaw-banyan/tasks/_shared/output.mjs';
import {readBindings,resolveBinding,writeBindings} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/bindings.mjs';
import {hugoEnvironment} from '../.agents/skills/swaw-banyan/tasks/base/hugo/run.mjs';
import {readRelease,inspect} from '../.agents/skills/swaw-banyan/tasks/doctor/banyan.mjs';
import {extractStartTags,extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';
import {fixtureSiteFiles,fixtureSitePages,fixtureDelivery,serviceWorkerPolicy} from './_shared/hugo.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const skill=path.join(repository,'.agents/skills/swaw-banyan'),moduleRoot=path.join(repository,'module');
const release=readRelease(),version='v'+release.version,parent=path.join(fs.realpathSync.native(os.tmpdir()),'swaw/banyan');
const guide=fs.readFileSync(path.join(skill,'references/install.md'),'utf8');
const toml=[...guide.matchAll(/```toml\r?\n([\s\S]*?)```/g)].map(match=>match[1]);
const markdown=[...guide.matchAll(/```markdown\r?\n([\s\S]*?)```/g)].map(match=>match[1]);
let work,installed,environment;
function write(root,name,value) {
  const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);
}
function command(root,owner,args) {
  const toolRoot=path.join(owner,'.tools'),record=readBindings(toolRoot);
  const runtime=resolveBinding(record.runtime,record,toolRoot).path;
  const result=spawnSync(runtime,[path.join(owner,'tasks/_cli/main.mjs'),...args],
    {cwd:root,env:{...environment,PATH:''},encoding:'utf8',timeout:30000,windowsHide:true});
  assert.ifError(result.error);return result;
}
function passed(root,owner,args) {
  const result=command(root,owner,args);assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout;
}
function consumer(name,{replacement='',multilingual=false}={}) {
  const root=path.join(work,name);
  let config=toml[1]+'\n'+toml[0];
  if(multilingual)config=config.replace('disableLanguages = ["zh", "zh-tw"]','disableLanguages = []')+
    '\n[languages.zh]\nlabel = "中文"\nlocale = "zh-CN"\nweight = 2\nparams.icon = { text = "简" }\n'+
    '\n[languages.zh-tw]\nlabel = "繁體"\nlocale = "zh-TW"\nweight = 3\nparams.icon = { text = "繁" }\n';
  write(root,'hugo.toml',config);
  write(root,'go.mod',`module example.test/consumer\n\ngo 1.18\n\nrequire ${release.module} ${version}\n`+
    (replacement?`\nreplace ${release.module} => ${JSON.stringify(replacement.replaceAll('\\','/'))}\n`:''));
  fixtureSiteFiles(root);
  fixtureSitePages(root,['appearance','language','my','_res','rss','powered-by']);
  for(const suffix of multilingual?['','.zh','.zh-tw']:['']) {
    const translated=value=>value.replace(/^title: (.+)$/m,'title: $1'+suffix);
    write(root,'content/_index'+suffix+'.md',markdown[0]);
    write(root,'content/articles/_index'+suffix+'.md',translated(markdown[1]));
    write(root,'content/articles/sample/_index'+suffix+'.md',translated(markdown[2]));
    write(root,'content/articles/related/_index'+suffix+'.md',translated(markdown[2].replaceAll('Sample','Related')));
    for(const [name,title,date] of [['alpha','Alpha','2026-01-01'],['beta','Beta','2026-01-02']])
      write(root,'content/articles/sample/'+name+'/index'+suffix+'.md',translated(markdown[3]
        .replaceAll('alpha',name).replaceAll('Alpha',title).replaceAll('2026-01-01',date)));
    write(root,'content/articles-all/_index'+suffix+'.md',translated(markdown[4]));
    write(root,'content/products/_index'+suffix+'.md',translated(markdown[5]));
    write(root,'content/products/free/_index'+suffix+'.md',translated(markdown[6]));
    write(root,'content/products/featured/_index'+suffix+'.md',translated(markdown[6].replaceAll('Free','Featured')));
    write(root,'content/products-all/_index'+suffix+'.md',translated(markdown[7]));
  }
  for(const directory of ['articles/related','products/free','products/featured'])
    write(root,'content/'+directory+'/_map.toml',toml[2]);
  return root;
}
function build(root,owner) {
  const result=passed(root,owner,['base/hugo','--minify','--noBuildLock']);
  assert.doesNotMatch(result,/\bWARN\b/,'Starter must build without missing layouts or defaults.');
  return path.join(root,'public');
}
function checks(root,owner,output) {
  for(const task of ['html/metadata','html/headings','html/scripts','html/styles','sitemap','robots','llms','csp','sri'])
    passed(root,owner,['check/'+task,output]);
}
function directoryDefaults(output,{prefix='',suffix=''}={}) {
  const directory=fs.readFileSync(path.join(output,prefix,'articles/index.html'),'utf8');
  assert.ok(directory.includes('<title>Articles - Categories'+suffix));
  assert.match(directory,/data-sort-variant="?section\b/);
  assert.ok(directory.includes('Sample'+suffix));
  const section=fs.readFileSync(path.join(output,prefix,'articles/sample/index.html'),'utf8');
  assert.match(section,/data-sort-variant="?section\b/);
  for(const name of ['alpha','beta'])assert.match(section,new RegExp('href=["\']?/'+prefix+'p/'+name+'/'));
  const related=fs.readFileSync(path.join(output,prefix,'articles/related/index.html'),'utf8');
  assert.ok(related.includes('/'+prefix+'p/alpha/#from=articles/related'));
  assert.ok(fs.readFileSync(path.join(output,prefix,'p/alpha/index.html'),'utf8').includes('data-directory-reference'));
  assert.equal(fs.existsSync(path.join(output,prefix,'articles/related/_map.toml')),false);
  const entries=fs.readFileSync(path.join(output,prefix,'articles-all/index.html'),'utf8');
  assert.ok(entries.includes('<title>Articles - All'+suffix));
  for(const name of ['alpha','beta'])assert.ok(entries.includes('/'+prefix+'p/'+name+'/'));
  const products=fs.readFileSync(path.join(output,prefix,'products-all/index.html'),'utf8');
  assert.ok(products.includes('<title>Products - All'+suffix));
  assert.match(products,/data-sort-variant="?products\b/);
  assert.equal([...products.matchAll(/data-sort-price=/g)].length,1,'Repeated references produce one product row.');
  assert.ok(products.includes('An example product.'));
  assert.ok(products.includes('/'+prefix+'p/alpha/'));
  const category=fs.readFileSync(path.join(output,prefix,'products/free/index.html'),'utf8');
  assert.match(category,/data-sort-variant="?products\b/);
  assert.ok(category.includes('/'+prefix+'p/alpha/#from=products/free'));
  for(const name of ['discover','all','catalog','catalog-all','about','github'])
    assert.equal(fs.existsSync(path.join(output,prefix,name)),false,'Module must not supply site-owned '+name+'.');
}
before(async()=>{
  fs.mkdirSync(parent,{recursive:true});work=fs.mkdtempSync(path.join(parent,'install-'));
  environment=hugoEnvironment({...process.env,GIT_OPTIONAL_LOCKS:'0',HUGO_CACHEDIR:path.join(work,'hugo-cache'),
    HUGO_RESOURCEDIR:path.join(work,'resources'),GOMODCACHE:path.join(work,'go-modules'),GOCACHE:path.join(work,'go-cache'),
    HUGO_MODULE_PROXY:pathToFileURL(path.join(work,'proxy')).href,HUGO_MODULE_PRIVATE:'none',HUGO_MODULE_NOPROXY:'none',
    GOSUMDB:'off',GOPRIVATE:'',GONOPROXY:'',GONOSUMDB:''});
  const prefix=release.module+'@'+version+'/';
  const moduleEntries=(await filesUnder(moduleRoot)).map(file=>({
    name:prefix+relativeName(moduleRoot,file),bytes:fs.readFileSync(file)}));
  const proxy=path.join(work,'proxy',release.module.replace(/[A-Z]/g,char=>'!'+char.toLowerCase()),'@v',version);
  write(work,path.relative(work,proxy+'.mod'),fs.readFileSync(path.join(moduleRoot,'go.mod')));
  write(work,path.relative(work,proxy+'.info'),JSON.stringify({Version:version,Time:'2026-01-01T00:00:00Z'}));
  write(work,path.relative(work,proxy+'.zip'),zip(moduleEntries));
  const forbidden=new Set(['.tools','node_modules','.git']);
  const files=(await filesUnder(skill)).filter(file=>!relativeName(skill,file).split('/').some(part=>forbidden.has(part)));
  const archive=path.join(work,'swaw-banyan.zip');
  fs.writeFileSync(archive,zip(files.map(file=>({name:'swaw-banyan/'+relativeName(skill,file),bytes:fs.readFileSync(file)}))));
  const unpacked=path.join(work,'installed skill with spaces');
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const expanded=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem\n[IO.Compression.ZipFile]::ExtractToDirectory('+quote(archive)+','+quote(unpacked)+')'],
    {encoding:'utf8',timeout:30000,windowsHide:true});
  assert.ifError(expanded.error);assert.equal(expanded.status,0,expanded.stdout+expanded.stderr);
  installed=path.join(unpacked,'swaw-banyan');
  assert.equal(fs.existsSync(path.join(installed,'.tools')),false);
  assert.equal(fs.existsSync(path.join(installed,'tasks/_shared/browser/node_modules')),false);
  assert.ok(fs.existsSync(path.join(installed,'LICENSE')));
  assert.ok(fs.existsSync(path.join(installed,'tasks/check/http/cache/entry.mjs')));
  const help=spawnSync(process.execPath,[path.join(installed,'tasks/_cli/main.mjs'),'help/en'],{encoding:'utf8',timeout:15000});
  assert.ifError(help.error);assert.equal(help.status,0,help.stdout+help.stderr);
  assert.ok(help.stdout.includes('doctor'));assert.equal(fs.existsSync(path.join(installed,'.tools')),false);
  fs.cpSync(path.join(skill,'node_modules'),path.join(installed,'node_modules'),{recursive:true});
  const tools=Object.fromEntries(['hugo','go','git'].map(name=>[name,{...resolveBinding(name),source:'path'}]));
  const runtime='node';
  tools[runtime]={...resolveBinding(runtime),source:'path',path:process.execPath,version:process.versions.node};
  writeBindings({schema:'swaw-banyan.bindings/v1',runtime,tools},path.join(installed,'.tools'));
});
after(()=>{
  if(work) {
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);
    assert.ok(path.basename(work).startsWith('install-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
});

test('documented starter supplies site identity and builds through a local Module without a Git repository',()=>{
  const root=consumer('local consumer',{replacement:moduleRoot});
  assert.equal(inspect(root).state,'development');
  const output=build(root,skill);checks(root,skill,output);
  directoryDefaults(output);
  assert.ok(fs.existsSync(path.join(output,'rss/index.html')));
  assert.equal(fs.existsSync(path.join(output,'zh')),false);
  assert.equal(fs.existsSync(path.join(output,'icp')),false);
  assert.equal(fs.existsSync(path.join(output,'changelog')),false);
  assert.equal(fs.existsSync(path.join(root,'.git')),false);
});

test('a Module consumer must supply its own PWA icons and manifest template',()=>{
  for(const file of ['icon-192.png','manifest.webmanifest.tmpl']) {
    const root=consumer('missing site '+file,{replacement:moduleRoot});
    fs.unlinkSync(path.join(root,'assets/site',file));
    const result=command(root,skill,['base/hugo','--minify','--noBuildLock']);
    assert.notEqual(result.status,0);
    assert.ok((result.stdout+result.stderr).includes('missing resource "site/'+file+'"'));
  }
});

test('site-owned robots templates follow the native switch and render site context',()=>{
  for(const variant of ['custom','disabled','missing','invalid']) {
    const root=consumer('robots '+variant,{replacement:moduleRoot}),template='assets/site/robots.txt.tmpl';
    const config=fs.readFileSync(path.join(root,'hugo.toml'),'utf8').replace('https://example.com/','https://example.test/base/');
    write(root,'hugo.toml',variant==='disabled'?config.replace('enableRobotsTXT = true','enableRobotsTXT = false'):config);
    if(variant==='disabled'||variant==='missing')fs.unlinkSync(path.join(root,template));
    else write(root,template,variant==='invalid'?'{{ if }}':
      '# {{ .Site.Title }}\nUser-agent: ExampleBot\nDisallow: /private/\nSitemap: {{ absURL "sitemap.xml" }}\n');
    const result=command(root,skill,['base/hugo','--minify','--noBuildLock']),log=result.stdout+result.stderr;
    if(variant==='missing'||variant==='invalid') {
      assert.notEqual(result.status,0,variant+' robots template must fail');
      assert.match(log,variant==='missing'?/missing resource "site\/robots\.txt\.tmpl"/:/missing value for if/);
    } else {
      assert.equal(result.status,0,log);
      const file=path.join(root,'public/robots.txt');
      assert.equal(fs.existsSync(file),variant==='custom');
      if(variant==='custom')assert.equal(fs.readFileSync(file,'utf8').trim(),
        '# My site\nUser-agent: ExampleBot\nDisallow: /private/\nSitemap: https://example.test/base/sitemap.xml');
      assert.equal(fs.existsSync(path.join(root,'public/site/robots.txt.tmpl')),false,'Template source stays unpublished');
    }
  }
});

test('a Module consumer must supply its own delivery and icons configuration',()=>{
  for(const file of ['delivery.toml','icons.toml']) {
    const root=consumer('missing site '+file,{replacement:moduleRoot});
    fs.unlinkSync(path.join(root,'assets/site',file));
    const result=command(root,skill,['base/hugo','--minify','--noBuildLock']);
    assert.notEqual(result.status,0);
    assert.ok((result.stdout+result.stderr).includes('missing assets/site/'+file));
  }
});

test('enabled workers require each published HTML offline page and accept site-owned paths',()=>{
  for(const [name,mode,variant,expected] of [
    ['missing-all','enable','absent',false],
    ['missing-translation','enable','missing-zh',false],
    ['render-never','enable','never',false],
    ['render-link','enable','link',false],
    ['non-HTML','enable','rss',false],
    ['off-without-pages','off','absent',true],
    ['disable-without-pages','disable','absent',true],
    ['custom-URL','enable','custom',true],
    ['unlisted-HTML','enable','unlisted',true]
  ]) {
    const root=consumer('offline '+name,{replacement:moduleRoot,multilingual:true});
    const pathname=variant==='custom'?'notice/fallback/':'_res/offline/';
    write(root,'assets/site/delivery.toml',fixtureDelivery(serviceWorkerPolicy(mode,5,pathname)));
    for(const suffix of ['','.zh','.zh-tw']) {
      const file=path.join(root,'content/_res/offline/index'+suffix+'.md');
      if(variant==='absent'||variant==='missing-zh'&&suffix==='.zh')fs.unlinkSync(file);
      else {
        const changed=suffix==='.zh';
        const fields=changed&&['never','link'].includes(variant)?'build: {render: '+variant+'}\n':
          variant==='unlisted'?'build: {list: never}\n':'';
        fs.writeFileSync(file,'---\ntitle: Offline contract\nurl: '+pathname+'\nlayout: page-article-norss\noutputs: ['+
          (changed&&variant==='rss'?'RSS':'HTML')+']\n'+fields+'---\nOffline fixture.\n');
      }
    }
    const result=command(root,skill,['base/hugo','--minify','--noBuildLock']),log=result.stdout+result.stderr;
    if(!expected) {
      assert.notEqual(result.status,0,name+' must fail');
      assert.match(log,/Service Worker requires a published HTML offline page for language/,name);
      if(variant!=='absent')assert.match(log,/language "zh"/,name);
    } else {
      assert.equal(result.status,0,name+'\n'+log);
      const output=path.join(root,'public');
      assert.equal(fs.existsSync(path.join(output,'sw.js')),mode!=='off',name);
      if(mode==='enable')for(const prefix of ['','zh','zh-tw'])
        assert.ok(fs.existsSync(path.join(output,prefix,pathname,'index.html')),name+' '+prefix);
    }
  }
});

test('favicon files select SVG before ICO and keep the fixed icon independent',()=>{
  for(const kind of ['fixed','ico','both','svg']) {
    const root=consumer('favicon '+kind,{replacement:moduleRoot}),assets=path.join(root,'assets/site');
    const ico=fs.readFileSync(path.join(assets,'favicon.ico'));
    if(kind==='fixed'||kind==='ico')fs.unlinkSync(path.join(assets,'favicon.link.svg'));
    if(kind==='ico'||kind==='both')fs.writeFileSync(path.join(assets,'favicon.link.ico'),ico);
    if(kind==='svg')fs.unlinkSync(path.join(assets,'favicon.ico'));
    const output=build(root,skill),html=fs.readFileSync(path.join(output,'index.html'),'utf8');
    const icons=extractStartTags(html,'link').filter(tag=>extractTagAttribute(tag,'rel')==='icon');
    assert.equal(icons.length,kind==='fixed'?0:1);
    if(kind!=='fixed') {
      const extension=kind==='ico'?'ico':'svg',href=extractTagAttribute(icons[0],'href');
      assert.match(href,new RegExp('^/site/favicon\\.link\\.[a-f0-9]{64}\\.'+extension+'$'));
      assert.deepEqual(fs.readFileSync(path.join(output,href)),fs.readFileSync(path.join(assets,'favicon.link.'+extension)));
      if(extension==='svg') {
        assert.equal(extractTagAttribute(icons[0],'type'),'image/svg+xml');
        assert.equal(extractTagAttribute(icons[0],'sizes'),'any');
      } else assert.match(extractTagAttribute(icons[0],'type'),/^image\/(?:vnd\.microsoft\.icon|x-icon)$/);
    }
    assert.equal(fs.existsSync(path.join(output,'favicon.ico')),kind!=='svg');
    if(kind!=='svg')assert.deepEqual(fs.readFileSync(path.join(output,'favicon.ico')),ico);
    if(kind==='both')assert.equal(fs.readdirSync(path.join(output,'site')).some(name=>/^favicon\.link\..*\.ico$/.test(name)),false);
    assert.equal(fs.existsSync(path.join(output,'favicon.svg')),false);
  }
  const root=consumer('missing favicons',{replacement:moduleRoot});
  for(const name of ['favicon.link.svg','favicon.ico'])fs.unlinkSync(path.join(root,'assets/site',name));
  const missing=command(root,skill,['base/hugo','--minify','--noBuildLock']);
  assert.notEqual(missing.status,0);
  assert.match(missing.stdout+missing.stderr,/missing favicon resource/);
});

test('packaged Skill and versioned Module build from an isolated proxy',()=>{
  const root=consumer('packaged consumer',{multilingual:true});
  assert.match(passed(root,installed,['doctor']),/site\.banyan: matched/);
  const output=build(root,installed);checks(root,installed,output);
  for(const [prefix,suffix,locale,label] of [
    ['','','en-US','English'],
    ['zh/','.zh','zh-CN','中文'],
    ['zh-tw/','.zh-tw','zh-TW','繁體']
  ]) {
    directoryDefaults(output,{prefix,suffix});
    const home=fs.readFileSync(path.join(output,prefix,'index.html'),'utf8');
    const localeTag=[...home.matchAll(/<meta\b[^>]*>/g)].find(([tag])=>extractTagAttribute(tag,'property')==='og:locale')?.[0];
    assert.equal(extractTagAttribute(localeTag||'','content'),locale.replaceAll('-','_'));
    assert.ok(fs.readFileSync(path.join(output,prefix,'index.xml'),'utf8').includes('<language>'+locale+'</language>'));
    assert.ok(fs.readFileSync(path.join(output,prefix,'llms.txt'),'utf8').startsWith('# My site - '+label));
    assert.ok(fs.existsSync(path.join(output,prefix,'rss/index.html')));
    const panel=fs.readFileSync(path.join(output,prefix,'powered-by/index.html'),'utf8');
    assert.ok(panel.includes('<code>'+version+'</code>'),'Powered by shows the installed Module version.');
    assert.ok(panel.includes('https://swaw.com/'+(prefix==='zh/'?'zh/':'')+'d/banyan/changelog/'));
    assert.ok(!panel.includes('data-site-update-action=check'),'Default SW-off panel has no check action.');
  }
  assert.equal(fs.existsSync(path.join(root,'node_modules')),false);
  assert.equal(fs.existsSync(path.join(root,'themes')),false);
  assert.ok(!fs.readFileSync(path.join(root,'go.mod'),'utf8').includes('replace'));
  assert.equal(fs.existsSync(path.join(root,'.git')),false);
});

test('the release module directory also installs and builds as a local Hugo theme',()=>{
  const root=consumer('theme-directory consumer'),directory=path.join(root,'themes/banyan');
  fs.unlinkSync(path.join(root,'go.mod'));
  write(root,'hugo.toml','theme="banyan"\n'+toml[1]);
  fs.cpSync(moduleRoot,directory,{recursive:true});
  assert.match(passed(root,installed,['doctor']),/site\.banyan: matched/);
  const template='assets/site/manifest.webmanifest.tmpl',source=fs.readFileSync(path.join(root,template),'utf8');
  fs.unlinkSync(path.join(root,template));
  const missing=command(root,installed,['base/hugo','--minify','--noBuildLock']);
  assert.notEqual(missing.status,0);
  assert.ok((missing.stdout+missing.stderr).includes('missing resource "site/manifest.webmanifest.tmpl"'));
  write(root,template,source);
  const output=build(root,installed);checks(root,installed,output);
  directoryDefaults(output);
  assert.equal(fs.existsSync(path.join(root,'go.mod')),false);
  assert.equal(fs.existsSync(path.join(root,'.git')),false);
});

test('site content, palette, translations and delivery data drive a fresh install',()=>{
  const root=consumer('overridden consumer',{multilingual:true});
  write(root,'content/rss/index.zh.md','---\ntitle: 本站订阅\nurl: rss/\ndescription: 本站订阅地址。\nlayout: page-article-norss\noutputs: [HTML]\n---\n\n{{< rss-link >}}\n');
  write(root,'assets/css/theme.css',fs.readFileSync(path.join(moduleRoot,'assets/css/theme.css'),'utf8')+'\n:root{--consumer-palette-marker:1}\n');
  write(root,'assets/i18n/zh.toml',fs.readFileSync(path.join(repository,'assets/i18n/zh.toml'),'utf8').replace('other = "名称"','other = "本站名称"'));
  const template='assets/site/manifest.webmanifest.tmpl';
  write(root,template,fs.readFileSync(path.join(root,template),'utf8')
    .replace('"theme_color" "#000000"','"theme_color" "#123456"')
    .replace('"background_color" "#ffffff"','"background_color" "#fefefe"'));
  write(root,'assets/site/external-resources.yaml','resources: []\n');
  write(root,'assets/site/delivery.toml',fixtureDelivery('[platform.cloudflare]\npages.enabled = true\n'+
    '[platform.edgeone]\nmakers.enabled = true\nmakers.installCommand = ""\nmakers.buildCommand = "hugo --minify --gc --cleanDestinationDir"\n'+
    'makers.outputDirectory = "public"\nmakers.nodeVersion = "22.11.0"\nmakers.hugoVersion = "0.156.0"\n'+
    '[[redirects]]\nsource = "/previous/"\ndestination = "/p/alpha/"\nstatus = 301\n'));
  const output=build(root,installed);checks(root,installed,output);
  const home=fs.readFileSync(path.join(output,'index.html'),'utf8');
  const manifestLink=extractStartTags(home,'link').find(tag=>extractTagAttribute(tag,'rel')==='manifest');
  const manifest=JSON.parse(fs.readFileSync(path.join(output,extractTagAttribute(manifestLink||'','href')),'utf8'));
  assert.equal(manifest.theme_color,'#123456');
  assert.equal(manifest.background_color,'#fefefe');
  assert.match(fs.readFileSync(path.join(output,'_redirects'),'utf8'),/^\/previous\/ \/p\/alpha\/ 301$/m);
  assert.deepEqual(fs.readdirSync(path.join(output,'site')).filter(file=>/\.(?:toml|ya?ml)$/.test(file)),[],
    'Configuration sources stay unpublished, including fingerprinted copies');
  directoryDefaults(output,{prefix:'zh/',suffix:'.zh'});
  assert.ok(fs.readFileSync(path.join(output,'zh/articles/index.html'),'utf8').includes('本站名称'));
  const rss=fs.readFileSync(path.join(output,'zh/rss/index.html'),'utf8');
  assert.ok(rss.includes('本站订阅'));assert.ok(rss.includes('/zh/index.xml'));
  const css=fs.readdirSync(path.join(output,'css')).filter(name=>name.endsWith('.css')).map(name=>fs.readFileSync(path.join(output,'css',name),'utf8')).join('');
  assert.ok(css.includes('--consumer-palette-marker'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(output,'edgeone.json'),'utf8')).hugoVersion,'0.156.0');
  const mismatched=fs.readFileSync(path.join(installed,'SKILL.md'),'utf8').replace('version: "'+release.version+'"','version: "9.9.9"');
  fs.writeFileSync(path.join(installed,'SKILL.md'),mismatched);
  const mod=fs.readFileSync(path.join(root,'go.mod'),'utf8'),failure=command(root,installed,['doctor']);
  assert.equal(failure.status,1);assert.match(failure.stdout,/site\.banyan: mismatch/);
  assert.equal(fs.readFileSync(path.join(root,'go.mod'),'utf8'),mod);
});
