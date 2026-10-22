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
import {extractTagAttribute} from '../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
const skill=path.join(repository,'.agents/skills/swaw-banyan'),moduleRoot=path.join(repository,'module');
const release=readRelease(),version='v'+release.version,parent=fs.realpathSync.native(os.tmpdir());
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
    '\n[languages.zh]\nlabel = "中文"\nlocale = "zh-CN"\nweight = 2\n[languages.zh.params]\nicon = { text = "简" }\n'+
    '\n[languages.zh-tw]\nlabel = "繁體"\nlocale = "zh-TW"\nweight = 3\n[languages.zh-tw.params]\nicon = { text = "繁" }\n';
  write(root,'hugo.toml',config);
  write(root,'go.mod',`module example.test/consumer\n\ngo 1.18\n\nrequire ${release.module} ${version}\n`+
    (replacement?`\nreplace ${release.module} => ${JSON.stringify(replacement.replaceAll('\\','/'))}\n`:''));
  for(const suffix of multilingual?['','.zh','.zh-tw']:['']) {
    write(root,'content/_index'+suffix+'.md',markdown[0]);
    write(root,'content/discover/sample/_index'+suffix+'.md','---\ntitle: Sample'+suffix+'\ndescription: Sample topic'+suffix+'.\n---\n');
    write(root,'content/discover/related/_index'+suffix+'.md','---\ntitle: Related'+suffix+'\ndescription: Related sample articles'+suffix+'.\n---\n');
    for(const [name,title,date] of [['alpha','Alpha','2026-01-01'],['beta','Beta','2026-01-02']])
      write(root,'content/discover/sample/'+name+'/index'+suffix+'.md',`---\ntitle: ${title}${suffix}\nurl: p/${name}/\nlayout: page-article\ndescription: Independent ${title}${suffix} article.\ndate: ${date}\nshare_image: false\n---\n\nIndependent article content.\n`);
  }
  write(root,'content/discover/related/_map.toml','refs = ["/discover/sample/alpha"]\n');
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
function directoryDefaults(output,{prefix='',suffix='',title='Discover - Categories',allTitle='Discover - All'}={}) {
  const directory=fs.readFileSync(path.join(output,prefix,'discover/index.html'),'utf8');
  assert.ok(directory.includes('<title>'+title));
  assert.match(directory,/data-sort-variant="?section\b/);
  assert.ok(directory.includes('Sample'+suffix));
  const section=fs.readFileSync(path.join(output,prefix,'discover/sample/index.html'),'utf8');
  assert.match(section,/data-sort-variant="?section\b/);
  for(const name of ['alpha','beta'])assert.match(section,new RegExp('href=["\']?/'+prefix+'p/'+name+'/'));
  const related=fs.readFileSync(path.join(output,prefix,'discover/related/index.html'),'utf8');
  assert.ok(related.includes('/'+prefix+'p/alpha/#from=discover/related'));
  assert.ok(fs.readFileSync(path.join(output,prefix,'p/alpha/index.html'),'utf8').includes('data-directory-reference'));
  assert.equal(fs.existsSync(path.join(output,prefix,'discover/related/_map.toml')),false);
  assert.ok(fs.readFileSync(path.join(output,prefix,'all/index.html'),'utf8').includes('<title>'+allTitle));
}
before(async()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-install-'));
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
    'Expand-Archive -LiteralPath '+quote(archive)+' -DestinationPath '+quote(unpacked)],{encoding:'utf8',timeout:30000,windowsHide:true});
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
    assert.ok(path.basename(work).startsWith('banyan-install-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
});

test('documented starter builds through a local Module without demo files or a Git repository',()=>{
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

test('packaged Skill and versioned Module build from an isolated proxy',()=>{
  const root=consumer('packaged consumer',{multilingual:true});
  assert.match(passed(root,installed,['doctor']),/site\.banyan: matched/);
  const output=build(root,installed);checks(root,installed,output);
  for(const [prefix,suffix,title,allTitle,locale,label] of [
    ['','','Discover - Categories','Discover - All','en-US','English'],
    ['zh/','.zh','发现 - 分类','发现 - 全部','zh-CN','中文'],
    ['zh-tw/','.zh-tw','發現 - 分類','發現 - 全部','zh-TW','繁體']
  ]) {
    directoryDefaults(output,{prefix,suffix,title,allTitle});
    const home=fs.readFileSync(path.join(output,prefix,'index.html'),'utf8');
    const localeTag=[...home.matchAll(/<meta\b[^>]*>/g)].find(([tag])=>extractTagAttribute(tag,'property')==='og:locale')?.[0];
    assert.equal(extractTagAttribute(localeTag||'','content'),locale.replaceAll('-','_'));
    assert.ok(fs.readFileSync(path.join(output,prefix,'index.xml'),'utf8').includes('<language>'+locale+'</language>'));
    assert.ok(fs.readFileSync(path.join(output,prefix,'llms.txt'),'utf8').startsWith('# My site - '+label));
    assert.ok(fs.existsSync(path.join(output,prefix,'rss/index.html')));
    const panel=fs.readFileSync(path.join(output,prefix,'powered-by/index.html'),'utf8');
    assert.ok(panel.includes('<code>'+version+'</code>'),'Powered by shows the installed Module version.');
    assert.ok(panel.includes('/tree/HEAD/content/changelog'));
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
  const output=build(root,installed);checks(root,installed,output);
  directoryDefaults(output);
  assert.equal(fs.existsSync(path.join(root,'go.mod')),false);
  assert.equal(fs.existsSync(path.join(root,'.git')),false);
});

test('site content, palette and delivery data override defaults in a fresh install',()=>{
  const root=consumer('overridden consumer',{multilingual:true});
  write(root,'content/rss/index.zh.md','---\nroot_nav: true\ntitle: 本站订阅\nurl: rss/\ndescription: 本站订阅地址。\nlayout: page-article\noutputs: [HTML]\nbuild: {list: local}\n---\n\n{{< rss-link >}}\n');
  write(root,'content/discover/_index.zh.md',fs.readFileSync(path.join(moduleRoot,'content/discover/_index.zh.md'),'utf8').replace('title: 发现 - 分类','title: 本站分类'));
  write(root,'assets/css/theme.css',fs.readFileSync(path.join(moduleRoot,'assets/css/theme.css'),'utf8')+'\n:root{--consumer-palette-marker:1}\n');
  write(root,'data/delivery.toml','[platform.cloudflare.pages]\nenabled = true\n'+
    '[platform.edgeone.makers]\nenabled = true\ninstallCommand = ""\nbuildCommand = "hugo --minify --gc --cleanDestinationDir"\n'+
    'outputDirectory = "public"\nnodeVersion = "22.11.0"\nhugoVersion = "0.156.0"\n');
  const output=build(root,installed);checks(root,installed,output);
  directoryDefaults(output,{prefix:'zh/',suffix:'.zh',title:'本站分类',allTitle:'发现 - 全部'});
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
