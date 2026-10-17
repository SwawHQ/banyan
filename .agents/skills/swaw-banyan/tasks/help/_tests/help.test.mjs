import {test,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {catalog,help,taskHelp,systemLanguage} from '../run.mjs';

const parent=fs.realpathSync.native(os.tmpdir());
let work,root;
function document(command,{entry=false,en=command,zh='中文 '+command}={}) {
  const dir=path.join(root,command);
  fs.mkdirSync(dir,{recursive:true});
  if (entry) fs.writeFileSync(path.join(dir,'entry.mjs'),'throw new Error("Help must not execute entries");');
  fs.writeFileSync(path.join(dir,'help.json'),JSON.stringify({
    en:{summary:en,usage:'swban '+command,details:['English details']},
    zh:{summary:zh,usage:'swban '+command,details:['完整中文说明']}
  }));
}
const names=text=>text.split('\n').map(line=>line.split(/\s+#/)[0].trim());
function coldHelp(args,language) {
  const script=path.join(root,'help/cold.ps1');
  fs.copyFileSync(fileURLToPath(new URL('../cold.ps1',import.meta.url)),script);
  const powershell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const env={...process.env,PATH:'',PSModulePath:path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/Modules')};
  const result=spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,language,...args],
    {cwd:work,env,encoding:'utf8',timeout:10000,windowsHide:true});
  assert.ifError(result.error);return result;
}
const invalidFields=[
  ['zh',value=>delete value.zh],
  ['en',value=>{value.en=false;}],
  ['en.summary',value=>{value.en.summary=' ';}],
  ['zh.summary',value=>{value.zh.summary='two\nlines';}],
  ['zh.usage',value=>{value.zh.usage='two\nlines';}],
  ['en.details',value=>{value.en.details='not an array';}],
  ['zh.details[0]',value=>{value.zh.details[0]=null;}],
  ['en.details[0]',value=>{value.en.details[0]='two\nlines';}]
];
beforeEach(()=>{
  work=fs.mkdtempSync(path.join(parent,'banyan-help-'));
  root=path.join(work,'tasks');
  document('alpha');document('alpha/first',{entry:true});
  document('alpha/nested');document('alpha/nested/deep',{entry:true});
  document('help',{entry:true});document('solo',{entry:true});
  fs.mkdirSync(path.join(root,'_shared'),{recursive:true});
  fs.writeFileSync(path.join(root,'_shared/helper.mjs'),'throw new Error("Support module must not load");');
  fs.mkdirSync(path.join(root,'unused/entry.mjs'),{recursive:true});
});
afterEach(()=>{
  assert.equal(path.dirname(work),parent);
  assert.ok(path.basename(work).startsWith('banyan-help-'));
  fs.rmSync(work,{recursive:true,force:true});
});

test('lists include command ancestors, use cumulative depth and align flat paths',()=>{
  assert.deepEqual(names(help(['1'],'en',root)),['alpha/','help','solo']);
  const two=help(['2'],'en',root);
  assert.deepEqual(names(two),['alpha/','alpha/first','alpha/nested/','help','solo']);
  assert.equal(new Set(two.split('\n').map(line=>line.indexOf('#'))).size,1);
  assert.ok(names(help(['3'],'en',root)).includes('alpha/nested/deep'));
  assert.deepEqual(names(help(['9'],'en',root)),['alpha/','alpha/first','alpha/nested/','alpha/nested/deep','help','solo']);
  assert.equal(help(['1'],undefined,root),help(['1'],systemLanguage(),root));
});

test('path depth is relative, keeps full paths and excludes siblings and the path itself',()=>{
  document('alpha/nested/deep/last',{entry:true});document('alphabet',{entry:true});
  for(const language of ['en','zh']) {
    assert.deepEqual(names(help(['alpha','1'],language,root)),['alpha/first','alpha/nested/']);
    const two=help(['alpha','2'],language,root);
    assert.deepEqual(names(two),['alpha/first','alpha/nested/','alpha/nested/deep']);
    assert.equal(new Set(two.split('\n').map(line=>line.indexOf('#'))).size,1);
    assert.ok(two.includes(language==='zh'?'中文 alpha/first':'#alpha/first'));
    assert.deepEqual(names(help(['alpha/nested','1'],language,root)),['alpha/nested/deep']);
    assert.deepEqual(names(help(['alpha/nested','3'],language,root)),['alpha/nested/deep','alpha/nested/deep/last']);
    assert.equal(help(['solo','2'],language,root),'');
  }
});

test('categories have a slash, executable parents do not, and listed paths can be queried',()=>{
  document('solo/child',{entry:true});
  for(const language of ['en','zh']) {
    const listed=names(help(['2'],language,root));
    assert.ok(listed.includes('alpha/'));assert.ok(listed.includes('solo'));
    assert.ok(listed.includes('solo/child'));assert.ok(!listed.includes('solo/'));
    for(const command of listed) assert.equal(help([command],language,root),taskHelp(command.replace(/\/$/,''),language,root));
    assert.equal(help(['alpha/','2'],language,root),help(['alpha','2'],language,root));
    assert.equal(help(['alpha/nested/','3'],language,root),help(['alpha/nested','3'],language,root));
    assert.equal(help(['solo/','1'],language,root),help(['solo','1'],language,root));
  }
});

test('bare help shows the selected home page without scanning other commands',()=>{
  fs.unlinkSync(path.join(root,'solo/help.json'));
  for (const language of ['en','zh']) {
    assert.equal(help([],language,root),taskHelp('help',language,root));
    assert.doesNotMatch(help([],language,root),/alpha|solo/);
  }
  assert.match(help([],'en',root),/English details/);
  assert.match(help([],'zh',root),/完整中文说明/);
  assert.equal(help([],undefined,root),help([],systemLanguage(),root));
  assert.throws(()=>help(['9'],'en',root),/missing_help:solo/);
});

test('detailed help reads the requested language and category children without running code',()=>{
  assert.match(help(['alpha/first'],'zh',root),/完整中文说明/);
  assert.doesNotMatch(help(['alpha/first'],'zh',root),/English details/);
  const group=help(['alpha'],'en',root);
  assert.match(group,/alpha\/first/);assert.match(group,/alpha\/nested/);
  assert.doesNotMatch(group,/alpha\/nested\/deep/);
  assert.match(help(['--help'],'zh',root),/swban help/);
  assert.match(taskHelp('solo','en',root),/English details/);
});

test('bad arguments and missing help files fail explicitly',()=>{
  for (const args of [['0'],['9007199254740992'],['1','2'],['-L2'],['../outside'],['alpha\\first'],['/alpha'],['absent'],[''],
    ['alpha','0'],['alpha','-1'],['alpha','2.5'],['alpha','9007199254740992'],['alpha',''],['alpha','two'],
    ['alpha','2','3'],['--help','2'],['../outside','2'],['absent','2'],['unused','2'],
    ['alpha//'],['alpha//','2'],['alpha//nested/','2'],['/','1'],['1/'],['1/','2']]) {
    assert.throws(()=>help(args,'en',root));
  }
  fs.unlinkSync(path.join(root,'solo/help.json'));assert.throws(()=>catalog(root),/missing_help:solo/);
});

test('invalid JSON reports its file and preserves the parser reason in the requested language',()=>{
  const file=path.join(root,'help/help.json');fs.writeFileSync(file,'{');
  for(const language of ['en','zh']) {
    assert.throws(()=>help([],language,root),error=>{
      assert.ok(error.message.includes(file));
      assert.ok(error.message.includes(language==='zh'?'JSON 语法错误：':'Invalid JSON: '));
      assert.doesNotMatch(error.message,/invalid_help:/);
      return true;
    });
  }
});

test('field errors identify the file and exact field for bare and depth help',()=>{
  const file=path.join(root,'help/help.json'),valid=fs.readFileSync(file,'utf8');
  for(const [field,change] of invalidFields) {
    const value=JSON.parse(valid);change(value);fs.writeFileSync(file,JSON.stringify(value));
    for(const language of ['en','zh'])for(const args of [[],['2']]) {
      assert.throws(()=>help(args,language,root),error=>{
        assert.ok(error.message.includes(file));assert.ok(error.message.includes(field));
        assert.ok(error.message.startsWith(language==='zh'?'帮助文件格式错误：':'Invalid help file: '));
        return true;
      });
    }
  }
});

test('directory links cannot expose help outside the task root',()=>{
  const outside=path.join(work,'outside');fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside,'entry.mjs'),'throw new Error("outside");');
  fs.symlinkSync(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');
  assert.ok(!catalog(root).some(item=>item.path==='linked'));
  assert.throws(()=>taskHelp('linked','en',root),/unknown_help:linked/);
  assert.throws(()=>help(['linked','2'],'en',root),/unknown_help:linked/);
  assert.throws(()=>help(['linked/','2'],'en',root),/unknown_help:linked/);
});

test('shipped metadata covers every command and every ancestor in both languages',()=>{
  const installed=fileURLToPath(new URL('../../',import.meta.url));
  const items=catalog(installed),actual=new Set(items.map(item=>item.path)),expected=new Set();
  function visit(dir,parts=[]) {
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      if(entry.name==='node_modules'||entry.isSymbolicLink())continue;
      if(entry.isDirectory())visit(path.join(dir,entry.name),[...parts,entry.name]);
      else if(entry.name==='entry.mjs')for(let depth=1;depth<=parts.length;depth++)expected.add(parts.slice(0,depth).join('/'));
    }
  }
  visit(installed);
  assert.deepEqual([...actual].sort(),[...expected].sort());
  for(const item of items)for(const language of ['en','zh'])assert.ok(item.document[language].summary.length);
});

test('language entry points accept scoped depth and only translate a single help flag',()=>{
  for(const language of ['en','zh']) {
    const entry=fileURLToPath(new URL('../'+language+'/entry.mjs',import.meta.url));
    const run=args=>spawnSync(process.execPath,[entry,...args],{cwd:work,encoding:'utf8',timeout:10000,windowsHide:true});
    const scoped=run(['check/','2']);assert.equal(scoped.status,0,scoped.stderr);
    assert.ok(names(scoped.stdout.trimEnd()).includes('check/http/cache'));
    assert.ok(names(scoped.stdout.trimEnd()).every(name=>name.startsWith('check/')&&name.replace(/\/$/,'').split('/').length<=3));
    const flag=run(['--help']);assert.equal(flag.status,0,flag.stderr);
    assert.ok(flag.stdout.startsWith('swban help/'+language+' '));
    const invalid=run(['--help','2']);assert.equal(invalid.status,1);
    assert.match(invalid.stderr,/invalid_help_arguments/);
  }
});

test('PowerShell cold help matches JS with no runtime on PATH',{skip:process.platform!=='win32',timeout:30000},()=>{
  for(const language of ['en','zh'])for(const args of [[],['1'],['2'],['3'],['alpha'],['alpha/first'],['--help'],
    ['alpha','1'],['alpha','2'],['alpha/nested','3'],['solo','2'],
    ['alpha/'],['alpha/first/'],['alpha/','1'],['alpha/nested/','3']]) {
    const result=coldHelp(args,language);assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout,help(args,language,root)+'\n');
  }
  for(const args of [['0'],['9007199254740992'],['1','2'],['../outside'],['alpha','0'],['alpha','two'],
    ['alpha','2','3'],['--help','2'],['../outside','2'],['absent','2'],['alpha//','2']]) {
    assert.equal(coldHelp(args,'en').status,1);
  }
  assert.equal(fs.existsSync(path.join(work,'.tools')),false);
});

test('cold help reports the same localized field errors and retains JSON parse reasons',{skip:process.platform!=='win32',timeout:20000},()=>{
  const file=path.join(root,'help/help.json'),valid=fs.readFileSync(file,'utf8');
  for(const [field,change] of invalidFields) {
    const value=JSON.parse(valid);change(value);fs.writeFileSync(file,JSON.stringify(value));
    for(const language of ['en','zh']) {
      let message;
      assert.throws(()=>help([],language,root),error=>{message=error.message;return true;});
      const result=coldHelp([],language);assert.equal(result.status,1);
      assert.equal(result.stderr.replaceAll('\r\n','\n'),'[swban] '+message+'\n',field);
    }
  }
  fs.writeFileSync(file,'{');
  for(const language of ['en','zh']) {
    const result=coldHelp([],language);assert.equal(result.status,1);
    assert.ok(result.stderr.includes(file));
    assert.ok(result.stderr.includes(language==='zh'?'JSON 语法错误：':'Invalid JSON: '));
  }
  assert.equal(fs.existsSync(path.join(work,'.tools')),false);
});
