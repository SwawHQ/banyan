import {test, expect} from 'bun:test';
import {help as helpText} from '../.agents/skills/swaw-banyan/tasks/help/run.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {zip} from './fixtures/zip.mjs';
import {definition, skillRoot} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/manifest.mjs';
import {stat, sha256, tree, installLock, removeTree} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/filesystem.mjs';
import {download} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/download.mjs';
import {extractZip} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/archive.mjs';
import {receipt, definitionMatches, versionMatches} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/managed.mjs';
import {ensure, recover, retireBackup} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/install.mjs';
import {probe, execute} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/process.mjs';
import {inspect, inspectBinding, compatible} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/selection.mjs';
import {readBindings} from '../.agents/skills/swaw-banyan/tasks/_shared/tools/bindings.mjs';
const work = process.env.BANYAN_TEST_WORKSPACE;
if (!work || !fs.existsSync(path.join(work, 'fixture.exe'))) throw new Error('Run tests/tools.ps1 to prepare the Windows process fixture');
const binary = fs.readFileSync(path.join(work, 'fixture.exe'));
function mkdir(name) { const dir = path.join(work, name); fs.mkdirSync(dir, {recursive:true}); return dir; }
function artifact(name, entries) { const file = path.join(work, name); fs.writeFileSync(file, zip(entries)); return file; }
function fixture(name, extra = []) {
  const tool = {...definition(name), supplements:[], url:`https://fixture.invalid/${name}.zip`};
  const entries = tool.requiredFiles.map(name => ({name:(tool.archiveRoot ? tool.archiveRoot + '/' : '') + name, bytes:name === tool.executable ? binary : Buffer.from('fixture')}));
  const archive = artifact(`${name}.zip`, [...entries, ...extra]);
  tool.sha256 = sha256(archive);
  let downloads = 0;
  const receive = async (_url, target, hash) => {
    downloads++; fs.copyFileSync(archive, target, fs.constants.COPYFILE_EXCL);
    if (sha256(target) !== hash) throw new Error('download_hash_mismatch');
  };
  return {tool, receive, get downloads() { return downloads; }};
}
function copySkill(name, withBun = false) {
  const destination = mkdir(name);
  for (const entry of fs.readdirSync(skillRoot)) if (entry !== '.tools') fs.cpSync(path.join(skillRoot, entry), path.join(destination, entry), {recursive:true});
  if (withBun) fs.cpSync(path.join(skillRoot, '.tools/bun'), path.join(destination, '.tools/bun'), {recursive:true});
  return destination;
}
function quote(value) { return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"'; }
function cli(skill, argumentsText, {cwd = work, env = process.env, input = ''} = {}) {
  const result = spawnSync(process.env.ComSpec, ['/d','/v:off','/s','/c',`""${path.join(skill, 'swban.cmd')}" ${argumentsText}"`],
    {windowsVerbatimArguments:true, cwd, env, input, encoding:'utf8', timeout:25000});
  if (result.error) throw result.error;
  return result;
}
function decodeLines(text) {
  return text.trim().split(/\r?\n/).map(line => { const index = line.indexOf(':'); return [line.slice(0,index), Buffer.from(line.slice(index+1),'base64').toString()]; });
}

test('invalid download parameters fail before creating a file', async () => {
  const target = path.join(work, 'rejected.part');
  await expect(download('http://fixture.invalid/archive', target, '0'.repeat(64))).rejects.toThrow('https_required');
  await expect(download('https://fixture.invalid/archive', target, 'bad')).rejects.toThrow('invalid_expected_hash');
  expect(stat(target)).toBeNull();
});
test('ZIP traversal, links, duplicate names and parent collisions fail before extraction', async () => {
  const tool = {...definition('hugo'), archiveRoot:''};
  const cases = [
    [{name:'../escape.txt'}], [{name:'a', mode:0xa000}], [{name:'a'},{name:'A'}],
    [{name:'a'},{name:'a/child'}], [{name:'good'},{name:'C:/escape'}], [{name:'a\\escape'}]
  ];
  for (const [index, entries] of cases.entries()) {
    const target = mkdir(`unsafe-${index}`);
    await expect(extractZip(artifact(`unsafe-${index}.zip`, entries), target, tool)).rejects.toThrow();
    expect(fs.readdirSync(target)).toEqual([]);
  }
});
const bun = fixture('bun'), owned = mkdir('owned');
test('cold install records all files; repeat reuses without downloading', async () => {
  expect(await ensure(owned, bun.tool, {receive:bun.receive})).toBe('installed');
  expect(receipt(path.join(owned,'bun'), bun.tool)).not.toBeNull();
  expect(await ensure(owned, bun.tool, {receive:bun.receive})).toBe('reused');
  expect(bun.downloads).toBe(1);
  expect(stat(path.join(owned,'.cache/bun'))).toBeNull();
});
test('checksum failure preserves the existing runtime', async () => {
  await expect(ensure(owned, {...bun.tool, sha256:'0'.repeat(64)}, {force:true, receive:bun.receive})).rejects.toThrow('download_hash_mismatch');
  expect(receipt(path.join(owned,'bun'), bun.tool)).not.toBeNull();
});
test('force repairs owned damage and refuses unrelated files', async () => {
  fs.writeFileSync(path.join(owned,'bun/bun.exe'), 'broken');
  expect(receipt(path.join(owned,'bun'), bun.tool)).toBeNull();
  await ensure(owned, bun.tool, {force:true, receive:bun.receive});
  const unknown = path.join(owned,'bun/personal.txt'); fs.writeFileSync(unknown, 'keep');
  await expect(ensure(owned, bun.tool, {force:true, receive:bun.receive})).rejects.toThrow('occupied_or_unknown_target');
  expect(fs.readFileSync(unknown,'utf8')).toBe('keep'); fs.unlinkSync(unknown);
});
test('interrupted replacement restores a missing target and retires an old backup', () => {
  const target = path.join(owned,'bun'), backup = path.join(owned,'.cache/previous-bun');
  fs.renameSync(target, backup); recover(owned,bun.tool);
  expect(receipt(target,bun.tool)).not.toBeNull(); expect(stat(backup)).toBeNull();
  fs.cpSync(target, backup, {recursive:true}); retireBackup(owned,bun.tool);
  expect(stat(backup)).toBeNull(); expect(receipt(target,bun.tool)).not.toBeNull();
});
test('lock excludes concurrent installation and can be reacquired after release', () => {
  const root = mkdir('locking'), unlock = installLock(root);
  try { expect(() => installLock(root)).toThrow('install_locked_or_unwritable'); } finally { unlock(); }
  installLock(root)(); expect(stat(path.join(root,'.cache/install.lock'))).toBeNull();
});
const go = fixture('go', [{name:'go/src/fixture/Þfoo.go',bytes:Buffer.from('unicode')}, {name:'go/src/fixture/rsc.io_!c!g!o.txt'}]);
const hugo = fixture('hugo'), sdk = mkdir('sdk');
test('Go keeps the complete nested SDK, including Unicode and escaped module names', async () => {
  await ensure(sdk, go.tool, {receive:go.receive});
  const root = path.join(sdk,'go');
  expect(await definitionMatches(root,go.tool,receipt(root,go.tool))).toBe(true);
  fs.unlinkSync(path.join(root,'pkg/tool/windows_amd64/compile.exe'));
  expect(receipt(root,go.tool)).toBeNull();
  await ensure(sdk,go.tool,{force:true,receive:go.receive});
});
test('Hugo flat archives work and ordinary Hugo cannot satisfy Extended', async () => {
  await ensure(sdk,hugo.tool,{receive:hugo.receive});
  const root = path.join(sdk,'hugo');
  expect(await definitionMatches(root,hugo.tool,receipt(root,hugo.tool))).toBe(true);
  fs.writeFileSync(path.join(root,'plain-version'),'');
  expect(await versionMatches(root,hugo.tool)).toBe(false); fs.unlinkSync(path.join(root,'plain-version'));
});

test('GitHub CLI keeps its bin directory and license; wrong versions and damaged files fail', async () => {
  const gh = fixture('gh'), root = mkdir('gh-sdk');
  await ensure(root,gh.tool,{receive:gh.receive});
  const installed = path.join(root,'gh');
  expect(await definitionMatches(installed,gh.tool,receipt(installed,gh.tool))).toBe(true);
  expect(await versionMatches(installed,{...gh.tool,version:'2.97.0'})).toBe(false);
  fs.writeFileSync(path.join(installed,'LICENSE'),'damaged');
  expect(receipt(installed,gh.tool)).toBeNull();
  await ensure(root,gh.tool,{force:true,receive:gh.receive});
  expect(await definitionMatches(installed,gh.tool,receipt(installed,gh.tool))).toBe(true);
  expect(gh.downloads).toBe(2);
});
test('a junction inside an SDK is rejected without following or deleting it', () => {
  const source = path.join(sdk,'go/src'), moved = path.join(work,'sdk-source');
  fs.renameSync(source,moved); fs.symlinkSync(moved,source,'junction');
  try {
    expect(receipt(path.join(sdk,'go'),go.tool)).toBeNull();
    expect(receipt(path.join(sdk,'go'),go.tool,{allowDamaged:true})).toBeNull();
    expect(() => removeTree(sdk,path.join(sdk,'go'))).toThrow();
    expect(fs.existsSync(path.join(moved,'go.mod'))).toBe(true);
  } finally { fs.unlinkSync(source); fs.renameSync(moved,source); }
});
const fresh = copySkill('uninitialized');
test('help and tool checks never prepare tools, including without a JS runtime', () => {
  for (const language of ['en','zh']) {
    const expected = helpText([],language,path.join(fresh,'tasks'))+'\n';
    const result = cli(fresh,`help/${language}`);
    expect(result.status).toBe(0); expect(result.stdout).toBe(expected);
  }
  const env={...process.env,PATH:''};
  for (const command of ['check/csp --help','doctor --help','base/browser/ensure --help','base/browser/ensure.webkit --help','base/hugo/ensure --help','base/bun/ensure --help']) expect(cli(fresh,command,{env}).status).toBe(0);
  for (const command of ['help en','help zh','help xx','help zh extra','base/ensure','check/module','ensure/browser','ensure/browser.webkit','doctor','base/bun/check','base/node/check','base/gh/check','base/bun/ensure --invalid','base/gh/ensure --invalid']) expect(cli(fresh,command,{env}).status).not.toBe(0);
  expect(stat(path.join(fresh,'.tools'))).toBeNull();
}, 15000);
let portable = copySkill('便携 skill ! with spaces',true);
const site = mkdir('caller site'), externalNode = mkdir('external-node');
fs.writeFileSync(path.join(externalNode,'node.exe'),binary);
const externalNpm=path.join(externalNode,'node_modules/npm/bin');fs.mkdirSync(externalNpm,{recursive:true});
for (const name of ['npm','npx']) fs.writeFileSync(path.join(externalNpm,`${name}-cli.js`),'fixture');
test('installed JS entry supports help, relocation and read-only checks', () => {
  expect(cli(portable,'base/bun --version',{env:{...process.env,PATH:externalNode}}).status).toBe(0);
  const relocated = path.join(work,'relocated skill ! with spaces');
  fs.renameSync(portable,relocated); portable = relocated;
  const before = fs.readFileSync(path.join(portable,'.tools/bun/install.json'),'utf8');
  for (const language of ['en','zh']) {
    const expected = helpText([],language,path.join(portable,'tasks'))+'\n';
    const result = cli(portable,`help/${language}`);
    expect(result.status).toBe(0); expect(result.stdout).toBe(expected);
  }
  for (const command of ['help','--help','-h','']) expect(cli(portable,command).status).toBe(0);
  const checked = cli(portable,'base/bun/check'); expect(checked.status).toBe(0);
  expect(JSON.parse(checked.stdout).path).toBe(path.join(portable,'.tools/bun/bun.exe'));
  expect(JSON.parse(cli(portable,'base/bun/ensure').stdout).action).toBe('reused');
  for (const command of ['base/bun/check --force','base/go/ensure --force --force','base/gh/ensure --force --force','invalid.ensure','help zh extra']) expect(cli(portable,command).status).not.toBe(0);
  for (const command of ['base/ensure','build','dev','release','release.check','ensure','bun','node','npm','npx','git','gh','go','hugo',...['bun','node','git','gh','go','hugo'].flatMap(name=>[name+'.check',name+'.ensure'])]) {
    const result = cli(portable, command);
    expect(result.status).toBe(1); expect(result.stderr).toContain(`unknown_command:${command}`);
  }
  for (const name of ['bun','node','hugo','go','git','gh']) {
    for (const command of [`.${name}`,`check.${name}`,`ensure.${name}`]) {
      const result = cli(portable,command);
      expect(result.status).toBe(1); expect(result.stderr).toContain(`unknown_command:${command}`);
    }
  }
  for (const command of ['.npm','.npx']) expect(cli(portable,command).stderr).toContain(`unknown_command:${command}`);
  expect(fs.readFileSync(path.join(portable,'.tools/bun/install.json'),'utf8')).toBe(before);
});
test('public execution preserves empty/quoted arguments, Unicode, streams, cwd and exit code', () => {
  const node = externalNode; fs.writeFileSync(path.join(node,'node.exe'),binary);
  const npm = path.join(node,'node_modules/npm/bin'); fs.mkdirSync(npm,{recursive:true});
  for (const name of ['npm','npx']) fs.writeFileSync(path.join(npm,`${name}-cli.js`),'fixture');
  const env = {...process.env,PATH:node};
  expect(cli(portable,'base/node/ensure',{env}).status).toBe(0);
  const values = ['value with spaces','','trailing\\','unicode-树','literal ! & | < > ^','quote"value'];
  const input = 'stdin line one\nstdin line two';
  const result = cli(portable,['base/node','--probe',...values].map(quote).join(' '),{cwd:site,input});
  if (result.status !== 17) throw new Error(result.stdout + result.stderr);
  expect(result.status).toBe(17); expect(result.stderr).toBe('stderr-from-runtime');
  const lines = decodeLines(result.stdout);
  expect(lines.find(([key])=>key === 'cwd')[1]).toBe(site);
  expect(lines.find(([key])=>key === 'path')[1]).toBe(node + ';' + process.env.PATH);
  expect(lines.filter(([key])=>key === 'arg').map(([,value])=>value)).toEqual(values);
  expect(lines.find(([key])=>key === 'input')[1]).toBe(input);
});
test('an active managed Node cannot replace itself through the direct JS entry', async () => {
  const skill=copySkill('active-node'),root=path.join(skill,'.tools'),node=fixture('node');
  const manifest=JSON.parse(fs.readFileSync(path.join(skill,'tools.json'),'utf8'));
  manifest.platforms['windows-x64'].tools=manifest.platforms['windows-x64'].tools.map(tool=>tool.name==='node'?node.tool:tool);
  fs.writeFileSync(path.join(skill,'tools.json'),JSON.stringify(manifest));
  const module=await import(pathToFileURL(path.join(skill,'tasks/_shared/tools/selection.mjs')).href);
  await module.prepareRuntime([],{root,env:{PATH:''},receive:node.receive});
  const before=fs.readFileSync(path.join(root,'bindings.json'),'utf8');
  const result=spawnSync(path.join(root,'node/node.exe'),[path.join(skill,'tasks/_cli/main.mjs'),'base/node/ensure','--force'],{encoding:'utf8',timeout:15000});
  expect(result.status).toBe(1);expect(result.stderr).toContain('active_runtime_requires_bootstrap');
  expect(result.stderr).not.toContain('Banyan download:');
  expect(fs.readFileSync(path.join(root,'bindings.json'),'utf8')).toBe(before);
});

test('npm and npx run their own CLI with the selected Node', () => {
  const directory = path.join(externalNode,'node_modules/npm/bin');
  for (const name of ['npm','npx']) {
    const file = path.join(directory,`${name}-cli.js`); fs.writeFileSync(file,'fixture');
    const result = cli(portable,`base/node/${name} --version`);
    expect(result.status).toBe(23); expect(result.stdout.trim().split(/\r?\n/)).toEqual([file,'--version']);
  }
});
test('Hugo execution prepares Git, Go and Hugo on demand and isolates SDK selection', () => {
  const env = {...process.env}; for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key];
  const git = mkdir('fake-git'); fs.writeFileSync(path.join(git,'git.exe'),binary);
  env.PATH = [git,path.join(sdk,'go/bin'),path.join(sdk,'hugo')].join(path.delimiter);
  env.GOROOT = 'unrelated'; env.GOTOOLCHAIN = 'auto';
  env.GIT_EXEC_PATH = 'unrelated/git';
  expect(cli(portable,'base/hugo version',{env}).status).toBe(0);
  const record=readBindings(path.join(portable,'.tools'));
  expect(Object.keys(record.tools).sort()).toEqual(['bun','git','go','hugo','node']);
  expect(record.tools.gh).toBeUndefined();
  env.PATH = git;
  for (const name of ['go','hugo']) {
    const result = cli(portable,`base/${name} --probe`,{env,cwd:site}); expect(result.status).toBe(17);
    const lines = Object.fromEntries(decodeLines(result.stdout));
    expect(lines.goroot).toBe(path.join(sdk,'go')); expect(lines.toolchain).toBe('local');
    expect(lines.gitexec).toBe('');
    expect(lines.path.startsWith(path.join(sdk,name,name === 'go' ? 'bin' : '') + ';')).toBe(true);
    expect(lines.path).toContain(git);
  }
});
test('native Hugo build and server preserve arguments and caller metadata, with no injected defaults', () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^HUGO_PARAMS_BUILD_/i.test(key)));
  const commands = [
    ['--minify','--gc','--cleanDestinationDir','--destination','output with spaces','unicode-树','quote"value'],
    ['server','-D','--disableFastRender','--port','13241','--minify=false']
  ];
  for (const values of commands) {
    const result = cli(portable,['base/hugo','--probe',...values].map(quote).join(' '),{cwd:site,env});
    expect(result.status).toBe(17); expect(result.stderr).toBe('stderr-from-runtime');
    const lines = decodeLines(result.stdout);
    expect(lines.filter(([key]) => key === 'arg').map(([,value]) => value)).toEqual(values);
    const metadata = Object.fromEntries(lines);
    expect(metadata.cwd).toBe(site);
    expect(metadata.goroot).toBe(path.join(sdk,'go'));
    expect(metadata.REVISION).toBe(''); expect(metadata.THEME_REVISION).toBe(''); expect(metadata.THEME_DIRTY).toBe('');
  }
  const result = cli(portable,'base/hugo --probe',{cwd:site,env:{...env,HUGO_PARAMS_BUILD_REVISION:'explicit',HUGO_PARAMS_BUILD_THEME_DIRTY:'false'}});
  const metadata = Object.fromEntries(decodeLines(result.stdout));
  expect(metadata.REVISION).toBe('explicit'); expect(metadata.THEME_DIRTY).toBe('false');
});
test('probe has a deadline while ordinary execution can exceed five seconds', async () => {
  const binaryPath = path.join(work,'fixture.exe');
  expect((await probe(binaryPath,['--wait'],{timeout:50})).ok).toBe(false);
  expect(await execute(binaryPath,['--wait'])).toBe(0);
}, 10000);

test('a system Node initializes for native execution without installing other tools', () => {
  const skill = copySkill('node-only'), node = path.join(path.dirname(process.env.BANYAN_SYSTEM_NODE),'node.exe');
  const env = {...process.env,PATH:path.dirname(node)};
  const result = cli(skill,'base/node --version',{env});
  if (result.status !== 0) throw new Error(result.stderr);
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toMatch(/^v\d+\.\d+\.\d+$/);
  expect(readBindings(path.join(skill,'.tools')).runtime).toBe('node');
  expect(stat(path.join(skill,'.tools/bun'))).toBeNull();
  expect(stat(path.join(skill,'.tools/node'))).toBeNull();
  expect(cli(skill,'base/node --version',{env}).status).toBe(0);
  if (readBindings(path.join(skill,'.tools')).tools.node.npmDirectory) {
    expect(cli(skill,'base/node/npm --version',{env}).status).toBe(0);
    expect(cli(skill,'base/node/npx --version',{env}).status).toBe(0);
  } else {
    for (const name of ['npm','npx']) expect(cli(skill,'base/node/' + name + ' --version',{env}).stderr).toContain('base/node/ensure --force');
  }
  expect(cli(skill,'help/zh',{env}).stdout).toBe(helpText([],'zh',path.join(skill,'tasks'))+'\n');
  for (const name of ['git','go','hugo','gh']) expect(readBindings(path.join(skill,'.tools')).tools[name]).toBeUndefined();
  expect(stat(path.join(skill,'.tools/bun'))).toBeNull();
});
test('qualification rejects old versions, plain Hugo and incomplete SDK; bare Node remains a CLI engine', async () => {
  expect(compatible('24.19.0',definition('node').compatibility)).toBe(true);
  expect(compatible('24.18.0',definition('node').compatibility)).toBe(false);
  for (const [name,version] of [['bun','1.3.9'],['node','v22.0.0'],['git','git version 2.30.0'],['gh','gh version 2.97.0 (2026-08-01)'],['hugo','hugo v0.168.0 windows/amd64'],['go','go version go1.20.0 windows/amd64']]) {
    const dir = mkdir('old-' + name), exe = path.join(dir,name + '.exe');
    fs.writeFileSync(exe,binary);fs.writeFileSync(path.join(dir,'version-output'),version);
    expect(await inspect(name,exe)).toBeNull();
  }
  const dir = mkdir('incomplete'), node = path.join(dir,'node.exe');fs.writeFileSync(node,binary);
  expect(await inspect('node',node,{PATH:''})).toMatchObject({path:node,version:'24.20.0'});
  const go = path.join(mkdir('incomplete-go/bin'),'go.exe');fs.writeFileSync(go,binary);
  expect(await inspect('go',go,{PATH:''})).toBeNull();
});

test('GitHub CLI accepts native multiline versions within the supported major version', async () => {
  const dir = mkdir('gh-versions'), executable = path.join(dir,'gh.exe');
  fs.writeFileSync(executable,binary);
  for (const version of ['2.98.0','2.100.0']) {
    fs.writeFileSync(path.join(dir,'version-output'),`gh version ${version} (2026-09-03)\nhttps://github.com/cli/cli/releases/tag/v${version}`);
    expect(await inspect('gh',executable)).toMatchObject({path:executable,version});
  }
  for (const text of ['gh version 3.0.0','gh version 2.98.0garbage','gh version 2.98.0-rc1','unrecognized']) {
    fs.writeFileSync(path.join(dir,'version-output'),text);
    expect(await inspect('gh',executable)).toBeNull();
  }
});

test('explicit Git execution prepares Git and shares its selected environment with Hugo and Go', () => {
  const git=path.join(work,'fake-git'),env={...process.env,PATH:git,GIT_EXEC_PATH:'unrelated/git'};
  expect(cli(portable,'base/git --version',{env}).status).toBe(0);
  expect(readBindings(path.join(portable,'.tools')).tools.git.path).toBe(path.join(git,'git.exe'));
  for (const name of ['go','hugo']) {
    const result=cli(portable,`base/${name} --probe`,{env:{...env,PATH:''}});
    expect(result.status).toBe(17);
    const lines=Object.fromEntries(decodeLines(result.stdout));
    expect(lines.gitexec).toBe('');
    expect(lines.path).toContain(git);
  }
});

test('automatic tool preparation downloads missing tools once and preserves existing bindings', async () => {
  const skill=copySkill('automatic-tools'),root=path.join(skill,'.tools'),git=fixture('git');
  const fixtures={git,go,hugo},manifest=JSON.parse(fs.readFileSync(path.join(skill,'tools.json'),'utf8'));
  manifest.platforms['windows-x64'].tools=manifest.platforms['windows-x64'].tools.map(tool=>fixtures[tool.name]?.tool??tool);
  fs.writeFileSync(path.join(skill,'tools.json'),JSON.stringify(manifest));
  const module=await import(pathToFileURL(path.join(skill,'tasks/_shared/tools/selection.mjs')).href);
  const receive=(url,target,hash)=>fixtures[path.basename(new URL(url).pathname,'.zip')].receive(url,target,hash);
  const counts=Object.fromEntries(Object.entries(fixtures).map(([name,item])=>[name,item.downloads]));
  await module.prepareTools(['git','go','hugo'],{root,env:{PATH:''},receive});
  const before=fs.readFileSync(path.join(root,'bindings.json'),'utf8');
  expect(Object.keys(readBindings(root).tools).sort()).toEqual(['git','go','hugo']);
  await module.prepareTools(['git','go','hugo'],{root,env:{PATH:'changed'},receive});
  expect(fs.readFileSync(path.join(root,'bindings.json'),'utf8')).toBe(before);
  for (const [name,item] of Object.entries(fixtures)) expect(item.downloads).toBe(counts[name]+1);
});

test('GitHub CLI reuses PATH without a login; check is read-only and native execution uses selected Git', () => {
  const gh = mkdir('external-gh'); fs.writeFileSync(path.join(gh,'gh.exe'),binary);
  expect(cli(portable,'base/gh/check').stderr).toContain('base/gh/ensure');
  expect(cli(portable,'base/gh/ensure',{env:{...process.env,PATH:gh}}).status).toBe(0);
  const before = fs.readFileSync(path.join(portable,'.tools/bindings.json'),'utf8');
  const env = {...process.env,PATH:'unrelated',GIT_EXEC_PATH:'unrelated/git',GH_CONFIG_DIR:path.join(site,'GitHub profile'),GH_TOKEN:'fixture-token'};
  const checked = cli(portable,'base/gh/check',{env}); expect(checked.status).toBe(0);
  expect(JSON.parse(checked.stdout)).toMatchObject({source:'path',version:'2.98.0',path:path.join(gh,'gh.exe')});
  expect(cli(portable,'base/gh/check --force').stderr).toContain('check_is_read_only');
  const values = ['release','create','v0.1.0','asset with spaces.zip','','unicode-树','trailing\\','literal ! & | < > ^','quote"value'];
  const input = 'native stdin';
  const result = cli(portable,['base/gh','--probe',...values].map(quote).join(' '),{cwd:site,env,input});
  if (result.status !== 17) throw new Error(result.stdout + result.stderr);
  expect(result.status).toBe(17); expect(result.stderr).toBe('stderr-from-runtime');
  const lines = decodeLines(result.stdout), metadata = Object.fromEntries(lines);
  const selectedGit = path.dirname(readBindings(path.join(portable,'.tools')).tools.git.path);
  expect(metadata.cwd).toBe(site); expect(metadata.path).toBe(`${gh};${selectedGit};unrelated`);
  expect(metadata.gitexec).toBe(''); expect(metadata.ghconfig).toBe(env.GH_CONFIG_DIR); expect(metadata.token).toBe('preserved');
  expect(metadata.input).toBe(input);
  expect(lines.filter(([key])=>key === 'arg').map(([,value])=>value)).toEqual(values);
  expect(env.GIT_EXEC_PATH).toBe('unrelated/git'); expect(env.PATH).toBe('unrelated');
  expect(fs.readFileSync(path.join(portable,'.tools/bindings.json'),'utf8')).toBe(before);
  expect(stat(path.join(portable,'.tools/gh'))).toBeNull();
  const git = path.join(selectedGit,'git.exe'); fs.renameSync(git,git + '.moved');
  try {
    expect(cli(portable,'base/gh --version').stderr).toContain('tool_binding_unusable:git');
    expect(cli(portable,'base/gh/check').status).toBe(0);
  } finally { fs.renameSync(git + '.moved',git); }
});

test('a Node CLI runs GitHub CLI without a Git binding and never installs optional tools', () => {
  const skill = copySkill('node-gh'), root = path.join(skill,'.tools');
  const env = {...process.env,PATH:path.dirname(process.env.BANYAN_SYSTEM_NODE)};
  expect(cli(skill,'base/node --version',{env}).status).toBe(0);
  expect(readBindings(root).runtime).toBe('node');
  expect(readBindings(root).tools.gh).toBeUndefined();
  const gh = mkdir('node-gh-bin'); fs.writeFileSync(path.join(gh,'gh.exe'),binary);
  env.PATH = gh;
  expect(cli(skill,'base/gh/ensure',{env}).status).toBe(0);
  expect(cli(skill,'base/gh/check',{env}).status).toBe(0);
  expect(cli(skill,'base/gh --version',{env}).stdout).toContain('gh version 2.98.0');
  const result = cli(skill,'base/gh --probe auth status',{env,cwd:site});
  expect(result.status).toBe(17);
  expect(Object.fromEntries(decodeLines(result.stdout)).path).toBe(`${gh};${gh}`);
  expect(readBindings(root).tools.git).toBeUndefined();
  for (const name of ['bun','node','git','gh']) expect(stat(path.join(root,name))).toBeNull();
});
test('normal execution keeps its binding when PATH changes and never repairs a missing tool', async () => {
  const before = fs.readFileSync(path.join(portable,'.tools/bindings.json'),'utf8');
  expect(cli(portable,'base/node --version',{env:{...process.env,PATH:''}}).status).toBe(0);
  const file = path.join(externalNode,'node.exe');fs.renameSync(file,file + '.moved');
  try {
    expect(cli(portable,'base/node --version').stderr).toContain('runtime_binding_unusable; run swban base/node/ensure');
    await expect(inspectBinding('node',{root:path.join(portable,'.tools')})).rejects.toThrow('tool_binding_unusable');
    expect(fs.readFileSync(path.join(portable,'.tools/bindings.json'),'utf8')).toBe(before);
    expect(stat(path.join(portable,'.tools/node'))).toBeNull();
  } finally { fs.renameSync(file + '.moved',file); }
});
test('check detects a changed system version; explicit ensure records that version again', () => {
  const file = path.join(externalNode,'version-output'), env = {...process.env,PATH:externalNode};
  fs.writeFileSync(file,'v24.19.0');
  try {
    expect(cli(portable,'base/node/check',{env}).stderr).toContain('tool_binding_changed:node');
    const result = cli(portable,'base/node/ensure',{env});expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({version:'24.19.0',source:'path',action:'reused'});
    expect(cli(portable,'base/node/check',{env}).status).toBe(0);
  } finally { fs.unlinkSync(file); }
  expect(cli(portable,'base/node/ensure',{env}).status).toBe(0);
});
test('force replaces a system binding with an owned portable copy without changing the system tool', async () => {
  const skill = copySkill('force-node'), root = path.join(skill,'.tools'), node = fixture('node');
  const manifest = JSON.parse(fs.readFileSync(path.join(skill,'tools.json'),'utf8'));
  manifest.platforms['windows-x64'].tools = manifest.platforms['windows-x64'].tools.map(tool => tool.name === 'node' ? node.tool : tool);
  fs.writeFileSync(path.join(skill,'tools.json'),JSON.stringify(manifest));
  const module = await import(pathToFileURL(path.join(skill,'tasks/_shared/tools/selection.mjs')).href);
  const externalBefore = sha256(path.join(externalNode,'node.exe'));
  const reused = await module.prepareTool('node',[],{root,env:{...process.env,PATH:externalNode}});
  expect(reused.source).toBe('path');expect(node.downloads).toBe(0);
  expect((await module.prepareRuntime([],{root,env:{PATH:externalNode}})).runtime).toBe('node');
  const installed = await module.prepareRuntime(['--force'],{root,receive:node.receive});
  expect(installed.runtime).toBe('node');expect(stat(path.join(root,'bun'))).toBeNull();
  expect(installed.source).toBe('managed');expect(installed.action).toBe('installed');
  expect(installed.path).toBe(path.join(root,'node/node.exe'));
  expect(node.downloads).toBe(1);expect(sha256(path.join(externalNode,'node.exe'))).toBe(externalBefore);
  expect((await module.inspectBinding('node',{root})).source).toBe('managed');
});

test('Bun remains an explicit tool and never becomes the CLI runtime', async () => {
  const skill=copySkill('bun-tool-only',true),root=path.join(skill,'.tools'),node=fixture('node');
  const manifest=JSON.parse(fs.readFileSync(path.join(skill,'tools.json'),'utf8'));
  manifest.platforms['windows-x64'].tools=manifest.platforms['windows-x64'].tools.map(tool=>tool.name==='node'?node.tool:tool);
  fs.writeFileSync(path.join(skill,'tools.json'),JSON.stringify(manifest));
  const module=await import(pathToFileURL(path.join(skill,'tasks/_shared/tools/selection.mjs')).href);
  await module.prepareTool('bun',[],{root,env:{PATH:''}});
  expect(readBindings(root).runtime).toBeUndefined();
  const before=fs.readFileSync(path.join(root,'bun/install.json'),'utf8');
  const result=await module.prepareRuntime([],{root,env:{PATH:path.join(root,'bun')},receive:node.receive});
  expect(result.runtime).toBe('node');expect(result.source).toBe('managed');expect(node.downloads).toBe(1);
  expect(cli(skill,'base/bun/ensure',{env:{...process.env,PATH:''}}).status).toBe(0);
  expect(cli(skill,'base/bun --version',{env:{...process.env,PATH:''}}).status).toBe(0);
  expect(readBindings(root).runtime).toBe('node');
  expect(fs.readFileSync(path.join(root,'bun/install.json'),'utf8')).toBe(before);
  const missing=copySkill('bun-only-read-only',true);
  const checked=cli(missing,'doctor',{env:{...process.env,PATH:path.join(missing,'.tools/bun')}});
  expect(checked.status).toBe(1);expect(checked.stderr).toContain('runtime_not_ready; run swban base/node/ensure');
  expect(stat(path.join(missing,'.tools/bindings.json'))).toBeNull();
});

test('temporary Node installs and force repairs from the one verified bootstrap archive', () => {
  const skill=copySkill('node-bootstrap'),root=path.join(skill,'.tools'),node=fixture('node');
  const manifest=JSON.parse(fs.readFileSync(path.join(skill,'tools.json'),'utf8'));
  manifest.platforms['windows-x64'].tools=manifest.platforms['windows-x64'].tools.map(tool=>tool.name==='node'?node.tool:tool);
  fs.writeFileSync(path.join(skill,'tools.json'),JSON.stringify(manifest));
  const temporary=mkdir('bootstrap-temporary'),executable=path.join(temporary,'node.exe');
  fs.writeFileSync(executable,binary);
  const run=(args)=>spawnSync(executable,[path.join(skill,'tasks/_cli/bootstrap-node.mjs'),path.join(work,'node.zip'),'base/node/ensure',...args],
    {env:{...process.env,PATH:''},encoding:'utf8',timeout:15000});
  const installed=run([]);
  expect(installed.status).toBe(0);expect(installed.stderr).not.toContain('Banyan download:');
  expect(JSON.parse(installed.stdout)).toMatchObject({tool:'node',source:'managed',action:'installed'});
  expect(readBindings(root).runtime).toBe('node');expect(node.downloads).toBe(0);
  fs.writeFileSync(path.join(root,'node/node.exe'),'damaged');
  const repaired=run(['--force']);
  expect(repaired.status).toBe(0);expect(repaired.stderr).not.toContain('Banyan download:');
  expect(receipt(path.join(root,'node'),node.tool)).not.toBeNull();
  expect(stat(path.join(root,'bun'))).toBeNull();expect(node.downloads).toBe(0);
  fs.appendFileSync(path.join(work,'node.zip'),'damaged');
  const rejected=run(['--force']);
  expect(rejected.status).toBe(1);expect(rejected.stderr).toContain('download_hash_mismatch');
  expect(receipt(path.join(root,'node'),node.tool)).not.toBeNull();
});

test('force installs portable GitHub CLI while preserving the external tool', async () => {
  const skill = copySkill('force-gh'), root = path.join(skill,'.tools'), gh = fixture('gh');
  const manifest = JSON.parse(fs.readFileSync(path.join(skill,'tools.json'),'utf8'));
  manifest.platforms['windows-x64'].tools = manifest.platforms['windows-x64'].tools.map(tool => tool.name === 'gh' ? gh.tool : tool);
  fs.writeFileSync(path.join(skill,'tools.json'),JSON.stringify(manifest));
  const module = await import(pathToFileURL(path.join(skill,'tasks/_shared/tools/selection.mjs')).href);
  const external = mkdir('force-gh-external'), executable = path.join(external,'gh.exe');
  fs.writeFileSync(executable,binary); const before = sha256(executable);
  expect((await module.prepareTool('gh',[],{root,env:{PATH:external}})).source).toBe('path');
  expect(gh.downloads).toBe(0);
  const installed = await module.prepareTool('gh',['--force'],{root,receive:gh.receive});
  expect(installed).toMatchObject({source:'managed',action:'installed',path:path.join(root,'gh/bin/gh.exe')});
  expect(gh.downloads).toBe(1); expect(sha256(executable)).toBe(before);
  expect((await module.inspectBinding('gh',{root})).source).toBe('managed');
  fs.writeFileSync(path.join(root,'gh/LICENSE'),'damaged');
  await expect(module.inspectBinding('gh',{root})).rejects.toThrow('tool_binding_changed:gh');
});
