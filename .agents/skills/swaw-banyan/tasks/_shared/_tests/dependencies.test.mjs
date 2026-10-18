import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const source = fileURLToPath(new URL('../../../',import.meta.url));
const parent = fs.realpathSync(os.tmpdir());
function write(root,name,text) {
  const file = path.join(root,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,text);
}
function project(root,name='fixture') {
  const dependencies = {[name]:'1.0.0'};
  write(root,'package.json',JSON.stringify({private:true,dependencies}));
  write(root,'package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'':{dependencies},['node_modules/'+name]:{version:'1.0.0'}}}));
}
const fakeNpm = `import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
fs.appendFileSync('.installs.jsonl',JSON.stringify(process.argv.slice(2))+'\\n');
if(fs.existsSync('.hold')){fs.writeFileSync('.started','');await new Promise(resolve=>setTimeout(resolve,1500));}
const dependencies=JSON.parse(fs.readFileSync('package.json')).dependencies;
for(const [name,version]of Object.entries(dependencies)){
  const directory=path.join(root,'node_modules',name);fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name,version,main:'index.cjs'}));
  fs.writeFileSync(path.join(directory,'index.cjs'),'module.exports={installed:true,generation:'+fs.readFileSync('.installs.jsonl','utf8').trim().split('\\n').length+'};');
  if(name==='playwright'){
    fs.writeFileSync(path.join(directory,'browser.exe'),'fixture');
    fs.writeFileSync(path.join(directory,'index.cjs'),"const type={executablePath:()=>require('node:path').join(__dirname,'browser.exe')};module.exports={chromium:type,webkit:type};");
    fs.writeFileSync(path.join(directory,'cli.js'),'process.exit(0);');
  }
}
if(fs.existsSync('.fail'))process.exit(7);
`;
async function fixture(run) {
  const work = fs.mkdtempSync(path.join(parent,'swban-packages-'));
  try {
    const root = path.join(work,'skill with spaces 树');
    fs.cpSync(source,root,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>['.tools','node_modules'].includes(part))});
    project(root);
    const npm = path.join(root,'fake-npm');
    write(npm,'npm-cli.js',fakeNpm);
    write(npm,'package.json','{"type":"module"}');
    write(root,'.tools/bindings.json',JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime:'node',tools:{
      node:{source:'path',path:process.execPath,version:process.versions.node,npmDirectory:npm}
    }}));
    const api = await import(pathToFileURL(path.join(root,'tasks/_shared/dependencies.mjs')).href);
    const count = (directory=root)=>fs.existsSync(path.join(directory,'.installs.jsonl'))?fs.readFileSync(path.join(directory,'.installs.jsonl'),'utf8').trim().split('\n').length:0;
    await run({root,api,count});
  } finally {
    assert.equal(path.dirname(work),parent);
    assert.ok(path.basename(work).startsWith('swban-packages-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
}

test('first use installs one locked group; ready dependencies skip installation; lock change and force prepare again',()=>fixture(async({root,api,count})=>{
  assert.equal(api.dependencyState(root).state,'missing');
  await api.ensureDependencies(root);
  assert.equal(api.dependencyState(root).state,'ready');
  assert.equal(api.loadDependency('fixture',root).installed,true);
  assert.equal(count(),1);
  await api.ensureDependencies(root);
  assert.equal(count(),1);
  const marker=path.join(root,'node_modules/.swban-packages.json'),saved=fs.readFileSync(marker);
  fs.writeFileSync(marker,'null');assert.equal(api.dependencyState(root).state,'outdated');fs.writeFileSync(marker,saved);
  const lock=path.join(root,'package-lock.json');fs.appendFileSync(lock,'\n');
  assert.equal(api.dependencyState(root).state,'outdated');
  await api.ensureDependencies(root);
  await api.ensureDependencies(root,{force:true});
  assert.equal(count(),3);
  assert.equal(api.loadDependency('fixture',root).generation,3);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'.installs.jsonl'),'utf8').split('\n')[0]),['ci','--prefix='+root,'--workspaces=false','--ignore-scripts','--no-audit','--no-fund']);
  assert.equal(fs.existsSync(path.join(root,'bun.lock')),false);
}));

test('failed installation leaves no success marker and retry repairs the group',()=>fixture(async({root,api,count})=>{
  write(root,'.fail','');
  await assert.rejects(api.ensureDependencies(root),/Dependency installation failed/);
  assert.notEqual(api.dependencyState(root).state,'ready');
  assert.equal(fs.existsSync(path.join(root,'node_modules/.swban-packages.json')),false);
  fs.unlinkSync(path.join(root,'.fail'));
  await api.ensureDependencies(root);
  assert.equal(api.dependencyState(root).state,'ready');
  assert.equal(count(),2);
}));

test('a nested capability prepares its own packages without installing the core group',()=>fixture(async({root,api,count})=>{
  const browser=path.join(root,'tasks/_shared/browser');project(browser,'browser-fixture');
  await api.ensureDependencies(browser);
  assert.equal(api.dependencyState(browser).state,'ready');
  assert.equal(api.dependencyState(root).state,'missing');
  assert.equal(count(browser),1);assert.equal(count(),0);
}));

test('help, doctor, unrelated commands and invalid arguments do not install packages',()=>fixture(async({root,count})=>{
  for(const args of [['help/en'],['base/packages/ensure','--help'],['sync/ext','--help'],['check/content/share-image','--help'],['check/content/share-image','missing','extra'],['report/size/assets','missing'],['doctor']]){
    const result=spawnSync(process.execPath,[path.join(root,'tasks/_cli/main.mjs'),...args],{cwd:root,encoding:'utf8',timeout:15000});
    assert.ifError(result.error);
    if(args[0]==='doctor'){assert.equal(result.status,1);assert.match(result.stdout,/packages.core: missing/);assert.match(result.stderr,/base\/packages\/ensure/);}
    assert.equal(count(),0,result.stdout+result.stderr);
    assert.equal(fs.existsSync(path.join(root,'node_modules')),false);
  }
}));

test('another installer cannot modify the group while an installation is in progress',()=>fixture(async({root,api,count})=>{
  write(root,'.hold','');
  write(root,'prepare.mjs',"import {ensureDependencies} from './tasks/_shared/dependencies.mjs';await ensureDependencies();");
  const child=spawn(process.execPath,[path.join(root,'prepare.mjs')],{cwd:root,stdio:['ignore','pipe','pipe']});
  let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});child.stdout.resume();
  const completed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  try {
    const deadline=Date.now()+10000;
    while(!fs.existsSync(path.join(root,'.started'))&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
    assert.ok(fs.existsSync(path.join(root,'.started')),errors);
    await assert.rejects(api.ensureDependencies(root),/install_locked_or_unwritable/);
    assert.equal(await completed,0,errors);
    assert.equal(api.dependencyState(root).state,'ready');assert.equal(count(),1);
  } finally {if(child.exitCode===null)child.kill();await completed;}
}));

test('mismatched dependency pins fail before running the installer',()=>fixture(async({root,api,count})=>{
  write(root,'package.json',JSON.stringify({dependencies:{fixture:'2.0.0'}}));
  await assert.rejects(api.ensureDependencies(root),/must pin the same versions/);
  assert.equal(count(),0);
}));


test('explicit browser preparation uses Node and repairs missing package files even with a current marker',()=>fixture(async({root,count})=>{
  const file=path.join(root,'.tools/bindings.json'),record=JSON.parse(fs.readFileSync(file,'utf8'));
  delete record.runtime;fs.writeFileSync(file,JSON.stringify(record));
  const browser=path.join(root,'tasks/_shared/browser');project(browser,'playwright');
  const {ensureChromium,ensureWebkit}=await import(pathToFileURL(path.join(root,'tasks/base/browser/prepare.mjs')).href);
  await ensureChromium();
  fs.unlinkSync(path.join(browser,'node_modules/playwright/cli.js'));
  await ensureWebkit();
  assert.equal(count(browser),2);
  assert.equal(fs.existsSync(path.join(browser,'node_modules/playwright/cli.js')),true);
  assert.equal(fs.existsSync(path.join(root,'node_modules')),false);
}));


test('a missing package entry is detected and repaired on the next use',()=>fixture(async({root,api,count})=>{
  await api.ensureDependencies(root);
  fs.unlinkSync(path.join(root,'node_modules/fixture/index.cjs'));
  assert.equal(api.dependencyState(root).state,'missing');
  await api.ensureDependencies(root);
  assert.equal(api.dependencyState(root).state,'ready');
  assert.equal(api.loadDependency('fixture',root).generation,2);assert.equal(count(),2);
}));


test('ready dependencies are reused without preparing or reading a Node binding',()=>fixture(async({root,api,count})=>{
  await api.ensureDependencies(root);
  fs.rmSync(path.join(root,'.tools'),{recursive:true,force:true});
  await api.ensureDependencies(root);
  assert.equal(count(),1);
  assert.equal(fs.existsSync(path.join(root,'.tools')),false);
}));

test('a Node binding without npm gives the explicit repair command',()=>fixture(async({root,api,count})=>{
  const file=path.join(root,'.tools/bindings.json'),record=JSON.parse(fs.readFileSync(file,'utf8'));
  delete record.tools.node.npmDirectory;fs.writeFileSync(file,JSON.stringify(record));
  await assert.rejects(api.ensureDependencies(root),/npm is required; run swban base\/node\/ensure --force/);
  assert.equal(count(),0);
}));

test('real offline npm installs only the selected group inside a parent workspace',()=>fixture(async({root,api})=>{
  const {resolveBinding}=await import('../tools/bindings.mjs');
  const node=resolveBinding('node'),work=path.dirname(root),name='swban-workspace-fixture';
  assert.ok(node.npmDirectory,'Prepare Node/npm before running the real npm regression.');
  const npm=path.join(node.npmDirectory,'npm-cli.js');
  const env={...process.env,npm_config_cache:path.join(work,'npm-cache'),npm_config_offline:'true'};
  const run=(args,cwd=work)=>{
    const result=spawnSync(node.path,args,{cwd,env,encoding:'utf8',timeout:30000});
    assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
    return result.stdout;
  };
  const packed=path.join(work,'packed');
  write(packed,'package.json',JSON.stringify({name,version:'1.0.0',main:'index.cjs'}));
  write(packed,'index.cjs','module.exports={installed:true};');
  run([npm,'pack','--ignore-scripts','--pack-destination='+work],packed);
  const tarball=path.join(work,name+'-1.0.0.tgz');
  const resolved='file:'+tarball.split(path.sep).join('/'),integrity='sha512-'+createHash('sha512').update(fs.readFileSync(tarball)).digest('base64');
  const dependencies={[name]:'1.0.0'};
  const lock=JSON.stringify({name:'skill-fixture',lockfileVersion:3,packages:{'':{name:'skill-fixture',dependencies},['node_modules/'+name]:{version:'1.0.0',resolved,integrity}}});
  write(root,'package.json',JSON.stringify({name:'skill-fixture',private:true,dependencies}));
  write(root,'package-lock.json',lock);
  write(root,'.tools/bindings.json',JSON.stringify({schema:'swaw-banyan.bindings/v1',runtime:'node',tools:{node:{...node,source:'path'}}}));
  write(work,'package.json',JSON.stringify({name:'parent-fixture',private:true,workspaces:[path.basename(root)],dependencies:{[name]:resolved}}));
  run([npm,'install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund']);
  write(work,'node_modules/keep.txt','parent dependencies');
  const parentLock=fs.readFileSync(path.join(work,'package-lock.json'));
  run([path.join(root,'tasks/_cli/main.mjs'),'base/packages/ensure'],root);
  assert.equal(api.dependencyState(root).state,'ready');
  const browser=path.join(root,'tasks/_shared/browser');
  write(browser,'package.json',JSON.stringify({private:true,dependencies}));write(browser,'package-lock.json',lock);
  write(root,'prepare-group.mjs',"import {ensureDependencies} from './tasks/_shared/dependencies.mjs';await ensureDependencies('tasks/_shared/browser');");
  run([path.join(root,'prepare-group.mjs')],root);
  assert.equal(api.dependencyState(browser).state,'ready');
  assert.equal(fs.readFileSync(path.join(work,'node_modules/keep.txt'),'utf8'),'parent dependencies');
  assert.deepEqual(fs.readFileSync(path.join(work,'package-lock.json')),parentLock);
  assert.equal(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'),lock);
  assert.equal(fs.readFileSync(path.join(browser,'package-lock.json'),'utf8'),lock);
  assert.deepEqual(fs.readdirSync(path.join(work,'node_modules')),['keep.txt']);
  assert.equal(fs.existsSync(path.join(work,'bun.lock')),false);
  assert.equal(fs.existsSync(path.join(root,'bun.lock')),false);
}));
