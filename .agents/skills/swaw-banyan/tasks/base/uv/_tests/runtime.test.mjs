import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess, {spawnSync} from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {pathToFileURL} from 'node:url';
import {skillRoot} from '../../../_shared/tools/manifest.mjs';
import {prepareTool, inspectBinding} from '../../../_shared/tools/selection.mjs';
import {readBindings, writeBindings} from '../../../_shared/tools/bindings.mjs';
import {zip} from '../../../_shared/tools/_tests/fixtures/zip.mjs';
import {sha256} from '../../../_shared/tools/filesystem.mjs';
import {inspectPython} from '../python/runtime.mjs';
import {uvEnvironment, pythonHome, pythonExecutable} from '../environment.mjs';

test('uv environment owns storage and removes inherited Python and uv selection', () => {
  const root = path.join(os.tmpdir(), 'skill tools');
  const source = {Path:'original',UV_PROJECT:'external',UV_PYTHON:'external',UV_CONFIG_FILE:'external',
    UV_SYSTEM_PYTHON:'true',UV_PYTHON_INSTALL_REGISTRY:'1',UV_PYTHON_INSTALL_BIN:'1',
    PYTHONHOME:'external',pythonpath:'external',VIRTUAL_ENV:'external',CONDA_PREFIX:'external',
    CONDA_PREFIX_1:'external',PIP_TARGET:'external',CLOUD_TOKEN:'preserved'};
  const before = {...source}, env = uvEnvironment(source, root);
  assert.deepEqual(source, before);
  assert.equal(env.Path, source.Path);
  assert.equal(env.CLOUD_TOKEN, source.CLOUD_TOKEN);
  for (const key of ['UV_PROJECT','UV_CONFIG_FILE','UV_SYSTEM_PYTHON','PYTHONHOME','pythonpath','CONDA_PREFIX','CONDA_PREFIX_1','PIP_TARGET'])
    assert.equal(env[key], undefined, key);
  for (const key of ['UV_NO_CONFIG','UV_NO_PROJECT','UV_NO_ENV_FILE','UV_MANAGED_PYTHON','PYTHONNOUSERSITE','PYTHONSAFEPATH','PYTHONUTF8'])
    assert.equal(env[key], '1', key);
  for (const key of ['UV_PYTHON_INSTALL_REGISTRY','UV_PYTHON_INSTALL_BIN']) assert.equal(env[key], '0');
  for (const key of ['UV_CACHE_DIR','UV_PYTHON_CACHE_DIR','UV_PYTHON_INSTALL_DIR','UV_PYTHON_BIN_DIR','UV_TOOL_DIR','UV_TOOL_BIN_DIR','UV_PROJECT_ENVIRONMENT','VIRTUAL_ENV'])
    assert.ok(path.relative(root,env[key]) && !path.relative(root,env[key]).startsWith('..'), key);
});

test('Python check fails without creating or repairing an environment', async () => {
  const work = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'swban-python-check-'));
  try {
    const root = path.join(work, 'missing');
    await assert.rejects(inspectPython({root}), /python_environment_unusable/);
    assert.deepEqual(fs.readdirSync(work), []);
  } finally { fs.rmSync(work, {recursive:true, force:true}); }
});

test('nested Python help and checks stay read-only and old routes are absent', {skip:process.platform!=='win32'}, () => {
  const parent = fs.realpathSync.native(os.tmpdir());
  const work = fs.mkdtempSync(path.join(parent, 'swban-python-routes-'));
  try {
    const skill = path.join(work,'skill'), root = path.join(skill,'.tools');
    fs.cpSync(skillRoot, skill, {recursive:true, filter:file => !['.tools','node_modules'].includes(path.basename(file))});
    const powershell = path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
    const env = {...process.env,PATH:'',PSModulePath:path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/Modules')};
    const cli = (cold,command,args=[]) => {
      const executable = cold ? powershell : process.execPath;
      const entry = cold
        ? ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(skill,'bootstrap/windows.ps1')]
        : [path.join(skill,'tasks/_cli/main.mjs')];
      const result = spawnSync(executable,[...entry,command,...args],{cwd:work,env,encoding:'utf8',timeout:10000,windowsHide:true});
      assert.ifError(result.error);return result;
    };
    for (const cold of [false,true]) {
      for (const command of ['base/uv/python/check','base/uv/python/ensure']) {
        const result = cli(cold,command,['--help']);
        assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.includes('swban '+command));
      }
      const checked = cli(cold,'base/uv/python/check');
      assert.equal(checked.status,1);
      assert.ok(checked.stderr.includes(cold ? 'runtime_not_ready' : 'base/uv/python/ensure'),checked.stderr);
      const invalid = cli(cold,'base/uv/python/ensure',['--force']);
      assert.equal(invalid.status,1);assert.match(invalid.stderr,/invalid_ensure_arguments/);
      for (const command of ['base/python','base/python/check','base/python/ensure']) {
        const removed = cli(cold,command,['--help']);
        assert.equal(removed.status,1);assert.ok(removed.stderr.includes('unknown_command:'+command),removed.stderr);
      }
      const help = cli(cold,'help/en',['base/uv','2']);
      assert.equal(help.status,0,help.stderr);assert.ok(help.stdout.includes('base/uv/python/ensure'));
      assert.equal(fs.existsSync(root),false);
    }
  } finally {
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);
    assert.ok(path.basename(work).startsWith('swban-python-routes-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
});

test('ready Python environments support concurrent reuse and still reject damage', async t => {
  const parent = fs.realpathSync.native(os.tmpdir());
  const work = fs.mkdtempSync(path.join(parent, 'swban-python-reuse-'));
  const skill = path.join(work, 'skill'), root = path.join(skill, '.tools');
  const home = pythonHome(root), executable = pythonExecutable(root), base = path.join(root, 'python/cpython-3.13');
  let mocked;
  try {
    fs.cpSync(skillRoot, skill, {recursive:true, filter:file => !['.tools','node_modules'].includes(path.basename(file))});
    fs.mkdirSync(path.dirname(executable), {recursive:true});
    fs.mkdirSync(base, {recursive:true});
    fs.writeFileSync(executable, 'process fixture');
    writeBindings({schema:'swaw-banyan.bindings/v1', tools:{
      uv:{source:'path', path:process.execPath, version:'0.10.2'}
    }}, root);
    const bindings = fs.readFileSync(path.join(root, 'bindings.json'));
    const spawn = childProcess.spawn;
    let probes = 0;
    mocked = t.mock.method(childProcess, 'spawn', (file, args, options) => {
      if (file !== executable) return spawn(file, args, options);
      probes++;
      return spawn(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', JSON.stringify(['3.13.1', home, base])], options);
    });
    syncBuiltinESMExports();
    const {preparePython} = await import(pathToFileURL(path.join(skill, 'tasks/base/uv/python/runtime.mjs')));
    const results = await Promise.allSettled([preparePython(), preparePython()]);
    assert.deepEqual(results.map(result => result.status), ['fulfilled','fulfilled']);
    assert.deepEqual(results.map(result => result.value.action), ['reused','reused']);
    assert.equal(probes, 2);
    assert.equal(fs.existsSync(path.join(root, '.cache')), false);
    fs.unlinkSync(executable);
    await assert.rejects(preparePython(), /python_environment_unusable/);
    assert.deepEqual(fs.readFileSync(path.join(root, 'bindings.json')), bindings);
    assert.equal(fs.existsSync(home), true);
    assert.equal(fs.existsSync(path.join(root, '.cache')), false);
  } finally {
    mocked?.mock.restore();
    syncBuiltinESMExports();
    assert.equal(path.dirname(fs.realpathSync.native(work)), parent);
    assert.ok(path.basename(work).startsWith('swban-python-reuse-'));
    fs.rmSync(work, {recursive:true, force:true});
  }
});

const uv = process.env.BANYAN_TEST_UV, python = process.env.BANYAN_TEST_PYTHON_DIR;
const archive = process.env.BANYAN_TEST_UV_ARCHIVE;
test('portable uv is verified and reused without changing the external uv', {skip:!uv || !archive}, async () => {
  const work = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'swban-uv-install-'));
  try {
    const before = sha256(uv), received = [];
    const receive = async (url, target, hash) => {
      const name = path.basename(new URL(url).pathname);
      fs.copyFileSync(name.endsWith('.zip') ? archive : path.join(path.dirname(archive),name),target);
      assert.equal(sha256(target),hash); received.push(name);
    };
    const installed = await prepareTool('uv', [], {root:work, env:{PATH:''}, receive});
    assert.equal(installed.source,'managed'); assert.equal(installed.action,'installed');
    assert.equal(received.length,3);
    assert.equal((await prepareTool('uv', [], {root:work, env:{PATH:''}, receive})).action,'reused');
    assert.equal(received.length,3);
    assert.equal((await inspectBinding('uv', {root:work})).version,'0.10.2');
    assert.equal(sha256(uv),before);
  } finally { fs.rmSync(work,{recursive:true,force:true}); }
});

test('real uv and Python isolate an existing uv repository, pip and tool dependencies',
  {skip:!uv || !python, timeout:60000}, async () => {
  const parent = fs.realpathSync.native(os.tmpdir());
  const work = fs.mkdtempSync(path.join(parent, 'swban-python-'));
  try {
    const repo = path.join(work, 'repo 树'), skill = path.join(repo, '.agents/skills/swaw-banyan');
    fs.cpSync(skillRoot, skill, {recursive:true, filter:file => !['.tools','node_modules'].includes(path.basename(file))});
    const root = path.join(skill, '.tools'), runtime = 'node';
    writeBindings({schema:'swaw-banyan.bindings/v1', runtime, tools:{
      [runtime]:{source:'path', path:process.execPath, version:process.versions.node}
    }}, root);
    assert.equal((await prepareTool('uv', [], {root, env:{PATH:path.dirname(uv)}})).source, 'path');
    assert.equal(fs.realpathSync.native((await inspectBinding('uv', {root})).path), fs.realpathSync.native(uv));
    assert.equal(fs.existsSync(path.join(root, 'uv')), false);
    fs.cpSync(python, path.join(root, 'python'), {recursive:true});

    function write(name, text) {
      const file = path.join(repo,name); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,text);
    }
    const protectedFiles = {
      'pyproject.toml':'[project]\nname="unrelated"\nversion="1.0.0"\nrequires-python="==3.9.*"\ndependencies=["nonexistent-project-dependency"]\n',
      'uv.toml':'invalid config = [', 'uv.lock':'repository lock', '.python-version':'3.9',
      '.venv/keep':'repository environment', 'repo_only.py':'raise RuntimeError("repository import")',
      'user/uv/uv.toml':'invalid user config = [', 'user/uv/.python-version':'3.9'
    };
    for (const [name,text] of Object.entries(protectedFiles)) write(name,text);
    const env = {...process.env,APPDATA:path.join(repo,'user'),UV_PROJECT:repo,UV_CONFIG_FILE:path.join(repo,'uv.toml'),
      UV_PYTHON:'3.9',UV_PROJECT_ENVIRONMENT:path.join(repo,'.venv'),UV_TOOL_DIR:path.join(repo,'user-tools'),
      UV_PYTHON_INSTALL_DIR:path.join(repo,'user-python'),UV_ENV_FILE:path.join(repo,'missing.env'),
      PYTHONHOME:repo,PYTHONPATH:repo,VIRTUAL_ENV:path.join(repo,'.venv'),CONDA_PREFIX:path.join(repo,'.venv')};
    const originalPath = env.PATH ?? env.Path;
    function cli(command, args = [], status = 0) {
      const result = spawnSync(process.execPath, [path.join(skill,'tasks/_cli/main.mjs'),command,...args],
        {cwd:repo, env, encoding:'utf8', timeout:30000, windowsHide:true});
      assert.ifError(result.error); assert.equal(result.status,status,result.stdout+result.stderr);
      return result;
    }
    assert.match(cli('base/uv',['--version']).stdout,/^uv /);
    cli('base/uv',['--offline','run','python'],1);
    const found = cli('base/uv', ['python','find','3.13']).stdout.trim();
    const foundRelative = path.relative(path.join(root,'python'), found);
    assert.ok(foundRelative && foundRelative !== '..' && !foundRelative.startsWith('..'+path.sep) && !path.isAbsolute(foundRelative));
    cli('base/uv/python/check', [], 1);
    assert.equal(fs.existsSync(pythonHome(root)),false);
    const installed = JSON.parse(cli('base/uv/python/ensure').stdout);
    assert.equal(installed.action,'installed');
    assert.equal(JSON.parse(cli('base/uv/python/ensure').stdout).action,'reused');
    assert.match(cli('base/uv/python',['--help']).stdout,/usage: .*python\.exe \[option\]/i);
    const coldHelp = spawnSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),
      ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(skill,'bootstrap/windows.ps1'),'base/uv/python','--help'],
      {cwd:repo,env:{...env,PSModulePath:path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/Modules')},encoding:'utf8',timeout:30000,windowsHide:true});
    assert.ifError(coldHelp.error);assert.equal(coldHelp.status,0,coldHelp.stderr);
    assert.match(coldHelp.stdout,/usage: .*python\.exe \[option\]/i);
    assert.equal(cli('base/uv/python',['-c','print("树")']).stdout.trim(),'树');
    const script = 'import json,os,sys,importlib.util; print(json.dumps(dict(prefix=sys.prefix,base=sys.base_prefix,cwd=os.getcwd(),repo=importlib.util.find_spec("repo_only") is not None,args=sys.argv[1:])))';
    for (const [command,args] of [['base/uv/python',['-c',script,'树','']],['base/uv',['run','--','python','-c',script,'树','']]]) {
      const info = JSON.parse(cli(command,args).stdout);
      assert.equal(fs.realpathSync.native(info.prefix),fs.realpathSync.native(pythonHome(root)));
      assert.ok(path.relative(path.join(root,'python'),info.base) && !path.relative(path.join(root,'python'),info.base).startsWith('..'));
      assert.equal(info.cwd,fs.realpathSync.native(repo)); assert.equal(info.repo,false); assert.deepEqual(info.args,['树','']);
    }
    function wheel(name, module, entry = '') {
      const dist = name+'-1.0.0.dist-info';
      const files = {[name+'.py']:module,[dist+'/METADATA']:`Metadata-Version: 2.1\nName: ${name}\nVersion: 1.0.0\n`,
        [dist+'/WHEEL']:'Wheel-Version: 1.0\nGenerator: swban-test\nRoot-Is-Purelib: true\nTag: py3-none-any\n',
        [dist+'/RECORD']:''};
      if(entry) files[dist+'/entry_points.txt']=entry;
      const target = path.join(work,name+'-1.0.0-py3-none-any.whl');
      fs.writeFileSync(target,zip(Object.entries(files).map(([name,text])=>({name,bytes:Buffer.from(text)}))));
      return target;
    }
    const dependency = wheel('swban_env_only','VALUE="skill"\n');
    cli('base/uv',['pip','install','--no-index',dependency]);
    assert.equal(cli('base/uv/python',['-c','import swban_env_only; print(swban_env_only.VALUE)']).stdout.trim(),'skill');
    const tool = wheel('swban_probe_cli','import json,sys,os,importlib.util\ndef main():\n print(json.dumps(dict(prefix=sys.prefix,cwd=os.getcwd(),repo=importlib.util.find_spec("repo_only") is not None,shared=importlib.util.find_spec("swban_env_only") is not None,args=sys.argv[1:])))\n',
      '[console_scripts]\nswban-probe = swban_probe_cli:main\n');
    const info = JSON.parse(cli('base/uv',['tool','run','--no-index','--from',tool,'swban-probe','树']).stdout);
    assert.notEqual(fs.realpathSync.native(info.prefix),fs.realpathSync.native(pythonHome(root)));
    const cacheRelative = path.relative(fs.realpathSync.native(path.join(root,'.cache/uv')),fs.realpathSync.native(info.prefix));
    assert.ok(cacheRelative && !cacheRelative.startsWith('..'), info.prefix);
    assert.equal(info.shared,false); assert.equal(info.repo,false); assert.deepEqual(info.args,['树']);
    assert.equal(info.cwd,fs.realpathSync.native(repo));
    const before = fs.readFileSync(path.join(root,'bindings.json'));
    assert.equal(JSON.parse(cli('base/uv/python/check').stdout).version,installed.version);
    cli('base/uv/check');
    assert.deepEqual(fs.readFileSync(path.join(root,'bindings.json')),before);
    cli('base/uv/python',['-c','raise SystemExit(17)'],17);
    cli('base/uv/python/ensure',['--force'],1);
    for (const [name,text] of Object.entries(protectedFiles)) assert.equal(fs.readFileSync(path.join(repo,name),'utf8'),text);
    assert.deepEqual(fs.readdirSync(path.join(repo,'.venv')),['keep']);
    for (const name of ['user-tools','user-python']) assert.equal(fs.existsSync(path.join(repo,name)),false);
    assert.equal(env.PATH ?? env.Path,originalPath);
    assert.equal(readBindings(root).tools.uv.source,'path');
    // A relocated or replaced environment must fail rather than be silently cleared.
    const config = path.join(pythonHome(root),'pyvenv.cfg'), configText = fs.readFileSync(config,'utf8');
    fs.renameSync(pythonExecutable(root),pythonExecutable(root)+'.saved');
    cli('base/uv/python/ensure',[],1);
    assert.equal(fs.readFileSync(config,'utf8'),configText);
  } finally {
    assert.equal(path.dirname(fs.realpathSync.native(work)),parent);
    assert.ok(path.basename(work).startsWith('swban-python-'));
    fs.rmSync(work,{recursive:true,force:true});
  }
});
