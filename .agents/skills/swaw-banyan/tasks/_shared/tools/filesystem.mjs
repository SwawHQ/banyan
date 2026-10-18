import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const fail = message => { throw new Error(message); };
export function stat(file) {
  try { return fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export function plainPath(file) {
  for (let current = path.resolve(file); ; current = path.dirname(current)) {
    if (stat(current)?.isSymbolicLink()) fail('linked_path');
    if (path.dirname(current) === current) break;
  }
  return file;
}
export function inside(root, ...parts) {
  const target = path.resolve(root, ...parts), relative = path.relative(path.resolve(root), target);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) fail('path_outside_root');
  return plainPath(target);
}
export function payloadName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 240 && name.split('/').every(part =>
    /^[\p{L}\p{N}_.+@!-]+$/u.test(part) && !['.','..','install.json','skill.md','config.toml','.git'].includes(part.toLowerCase()) &&
    !/[. ]$|^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part));
}
export const nameKey = name => process.platform === 'win32' ? name.toLowerCase() : name;
export function tree(root) {
  plainPath(root);
  const entries = [];
  const pending = [''];
  while (pending.length) {
    const directory = pending.pop();
    for (const name of fs.readdirSync(path.join(root, directory))) {
      const relative = directory ? directory + '/' + name : name;
      const item = fs.lstatSync(path.join(root, relative));
      if (!item.isDirectory() && !item.isFile()) fail('linked_or_special_file');
      entries.push({name: relative, directory: item.isDirectory(), length: item.size});
      if (item.isDirectory()) pending.push(relative);
    }
  }
  return entries;
}
export function sha256(file) {
  const hash = createHash('sha256'), buffer = Buffer.alloc(64 * 1024), fd = fs.openSync(file, 'r');
  try { let count; while ((count = fs.readSync(fd, buffer))) hash.update(buffer.subarray(0, count)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
export function durableWrite(file, content) {
  plainPath(file);
  const fd = fs.openSync(file, 'wx');
  try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export function removeTree(root, target) {
  inside(root, path.relative(root, target));
  if (!stat(target)) return;
  tree(target); // Reject links before any recursive removal.
  fs.rmSync(target, {recursive: true});
}
function releaseMarker(directory, marker) {
  const file = plainPath(path.join(directory, marker));
  if (stat(file)) fs.unlinkSync(file);
  try { fs.rmdirSync(directory); } catch (error) { if (!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code)) throw error; }
}
export function installLock(root) {
  const cache = inside(root, '.cache');
  fs.mkdirSync(cache, {recursive: true});
  const directory = inside(root, '.cache/install.lock');
  const token = randomUUID(), marker = `owner-${token}.json`;
  const prepared = inside(root, `.cache/lock-${token}`);
  fs.mkdirSync(prepared);
  durableWrite(path.join(prepared, marker), JSON.stringify({schema:'swaw-banyan.lock/v1', pid:process.pid, token}));
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      plainPath(directory);
      if (stat(directory)) {
        if (!stat(directory).isDirectory()) fail('install_locked_or_unwritable');
        const files = fs.readdirSync(directory);
        // An empty/unknown lock is never assumed to be abandoned.
        if (files.length !== 1 || !/^owner-[a-f0-9-]{36}\.json$/.test(files[0])) fail('install_locked_or_unwritable');
        const file = plainPath(path.join(directory, files[0]));
        if (!stat(file)?.isFile() || stat(file).size > 1024) fail('install_locked_or_unwritable');
        const owner = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (owner.schema !== 'swaw-banyan.lock/v1' || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || files[0] !== `owner-${owner.token}.json`) fail('install_locked_or_unwritable');
        let dead = false;
        try { process.kill(owner.pid, 0); } catch (error) { dead = error.code === 'ESRCH'; }
        if (!dead) fail('install_locked_or_unwritable');
        releaseMarker(directory, files[0]);
        continue;
      }
      try { fs.renameSync(prepared, directory); }
      catch (error) { if (stat(directory)) continue; throw error; }
      return () => releaseMarker(directory, marker);
    }
    fail('install_locked_or_unwritable');
  } finally { if (stat(prepared)) releaseMarker(prepared, marker); }
}
