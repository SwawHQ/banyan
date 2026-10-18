// Installation/ownership policy ported from SwawHQ/gidd (MIT).
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, inside, stat, tree, sha256, durableWrite, removeTree, installLock } from './filesystem.mjs';
import { receipt, definitionMatches, versionMatches } from './managed.mjs';
import { download } from './download.mjs';
import { extractZip } from './archive.mjs';

export function retireBackup(root, tool) {
  const backup = inside(root, `.cache/previous-${tool.name}`);
  if (!stat(backup)) return;
  if (!receipt(backup, tool, {allowDamaged:true})) fail(`unknown_runtime_backup:${tool.name}`);
  const retired = inside(root, `.cache/retired-${tool.name}-${randomUUID()}`);
  fs.renameSync(backup, retired); // A partially deleted backup must never be restored.
  removeTree(root, retired);
}
function restoreBackup(root, tool) {
  const backup = inside(root, `.cache/previous-${tool.name}`), target = inside(root, tool.name);
  if (!stat(backup)) return;
  if (!receipt(backup, tool, {allowDamaged:true})) fail(`unknown_runtime_backup:${tool.name}`);
  if (stat(target)) {
    if (!receipt(target, tool, {allowDamaged:true})) fail(`runtime_recovery_target_conflict:${tool.name}`);
    removeTree(root, target);
  }
  fs.renameSync(backup, target);
}
export function recover(root, tool) {
  if (!stat(inside(root, `.cache/previous-${tool.name}`))) return;
  if (receipt(inside(root, tool.name), tool)) retireBackup(root, tool);
  else restoreBackup(root, tool);
}
export async function install(root, tool, {force = false, archivePath, receive = download} = {}) {
  if (!['bun','node','hugo','go','git','gh','uv'].includes(tool.name)) fail('invalid_runtime_name');
  const target = inside(root, tool.name), stage = inside(root, `.cache/${tool.name}`);
  if (force && fs.existsSync(path.join(target,tool.executable)) &&
      fs.realpathSync(process.execPath) === fs.realpathSync(path.join(target,tool.executable))) {
    fail(`active_runtime_requires_bootstrap; run swban base/${tool.name}/ensure --force`);
  }
  const backup = inside(root, `.cache/previous-${tool.name}`);
  if (stat(backup)) fail(`pending_runtime_recovery:${tool.name}`);
  if (stat(target)) {
    const record = receipt(target, tool, {allowDamaged:force});
    if (!record) fail(`occupied_or_unknown_target:${tool.name}`);
    if (!force) {
      if (!await definitionMatches(target, tool, record)) fail(`installed_definition_conflict:${tool.name}; run swban base/${tool.name}/ensure --force`);
      removeTree(root, stage);
      return 'reused';
    }
  }
  removeTree(root, stage);
  const payload = inside(stage, 'payload'), archive = inside(stage, 'download.part');
  fs.mkdirSync(payload, {recursive:true});
  if (archivePath) {
    // Only the native Node bootstrap supplies a local, already downloaded archive.
    if (tool.name !== 'node' || sha256(archivePath) !== tool.sha256) fail('download_hash_mismatch');
    fs.copyFileSync(archivePath, archive, fs.constants.COPYFILE_EXCL);
  } else {
    process.stderr.write(`Banyan download: ${tool.name} ${tool.version} ${tool.url}\n`);
    await receive(tool.url, archive, tool.sha256);
  }
  await extractZip(archive, payload, tool);
  for (const extra of tool.supplements || []) {
    if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(extra.name)) fail('invalid_supplement_name');
    await receive(extra.url, inside(payload, extra.name), extra.sha256);
  }
  for (const file of tool.requiredFiles) if (!stat(inside(payload, file))?.isFile()) fail(`required_file_missing:${file}`);
  if (!await versionMatches(payload, tool)) fail('installed_version_mismatch');
  const files = tree(payload).filter(file => !file.directory).map(file => ({name:file.name, length:file.length, sha256:sha256(path.join(payload, file.name))}));
  const record = {schema:'swaw-banyan.install/v1', name:tool.name, platform:tool.platform, version:tool.version, source:tool.url, archive_sha256:tool.sha256, files};
  durableWrite(path.join(payload, 'install.json'), JSON.stringify(record));
  if (!receipt(payload, tool) || !await definitionMatches(payload, tool, record)) fail('staged_integrity_failed');
  try {
    if (stat(target)) {
      if (!force || !receipt(target, tool, {allowDamaged:true})) fail(`occupied_or_unknown_target:${tool.name}`);
      fs.renameSync(target, backup);
    }
    fs.renameSync(payload, target);
    if (!receipt(target, tool)) fail('published_integrity_failed');
  } catch (error) { restoreBackup(root, tool); throw error; }
  removeTree(root, stage);
  return 'installed';
}
export async function ensure(root, tool, options = {}) {
  const unlock = installLock(root);
  try {
    recover(root, tool);
    const action = await install(root, tool, options);
    retireBackup(root, tool);
    return action;
  } finally { unlock(); }
}
