import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// Source files may be read from any selected build; writes stay in the site.
export async function siteFile(siteRoot, target) {
  if (typeof target !== 'string' || !target || path.isAbsolute(target) || /^[a-z]:/i.test(target)) {
    throw new Error('Target must be a relative site file: ' + target);
  }
  const root = await fs.realpath(siteRoot);
  const file = path.resolve(root,target.replaceAll('\\','/'));
  const relative = path.relative(root,file);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Target escapes the site root: ' + target);
  }
  const segments = relative.split(path.sep);
  if (segments.some(segment => /[:<>"|?*\x00-\x1f]|[ .]$/.test(segment) ||
      ['public','.git','.agents','node_modules'].includes(segment.toLowerCase()))) {
    throw new Error('Target is not a writable site resource: ' + target);
  }
  let current = root;
  for (const [index,segment] of segments.entries()) {
    current = path.join(current,segment);
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink() || (index < segments.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
      throw new Error('Target contains a link or incompatible path: ' + target);
    }
  }
  return file;
}

export async function writeSiteFile(siteRoot, target, bytes) {
  const file = await siteFile(siteRoot,target);
  try {
    if ((await fs.readFile(file)).equals(bytes)) return false;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(path.dirname(file),{recursive:true});
  await siteFile(siteRoot,target);
  const temporary = path.join(path.dirname(file),'.swban-' + randomUUID() + '.tmp');
  try {
    await fs.writeFile(temporary,bytes,{flag:'wx'});
    await siteFile(siteRoot,target);
    await fs.rename(temporary,file);
  } finally {
    try { await fs.unlink(temporary); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return true;
}
