import fs from 'node:fs';
import path from 'node:path';
import * as yauzl from './_vendor/yauzl.mjs';
import { fail, inside, payloadName, nameKey } from './filesystem.mjs';

export async function extractZip(archive, destination, tool) {
  if (typeof tool.archiveRoot !== 'string' || (tool.archiveRoot && (!payloadName(tool.archiveRoot) || tool.archiveRoot.includes('/')))) fail('invalid_archive_root');
  const zip = await yauzl.openPromise(archive, {lazyEntries:true, autoClose:false, strictFileNames:true, validateEntrySizes:true});
  const prefix = tool.archiveRoot ? tool.archiveRoot + '/' : '';
  const entries = [], names = new Map();
  let total = 0;
  try {
    if (zip.entryCount > 25000) fail('too_many_payload_files');
    for await (const entry of zip.eachEntry()) {
      if (entry.fileName === prefix) continue;
      if (!entry.fileName.startsWith(prefix)) fail('unexpected_archive_root');
      const name = entry.fileName.slice(prefix.length).replace(/\/$/, '');
      const directory = entry.fileName.endsWith('/');
      const type = (entry.externalFileAttributes >>> 16) & 0xf000;
      if (!payloadName(name) || names.has(nameKey(name))) fail('unsafe_zip_entry');
      if (![0,0x4000,0x8000].includes(type) || (type === 0x4000 && !directory) || (type === 0x8000 && directory) || (entry.generalPurposeBitFlag & 1)) fail('unsupported_zip_entry_type');
      if (entry.uncompressedSize > 256 * 1024 * 1024) fail('zip_entry_too_large');
      total += entry.uncompressedSize;
      if (total > 512 * 1024 * 1024) fail('zip_payload_too_large');
      names.set(nameKey(name), directory);
      entries.push({entry, name, directory});
    }
    // Validate every entry and parent collision before writing any payload.
    for (const {name} of entries) {
      for (let parent = path.posix.dirname(name); parent !== '.'; parent = path.posix.dirname(parent)) {
        if (names.get(nameKey(parent)) === false) fail('zip_parent_is_file');
      }
    }
    for (const {entry, name, directory} of entries) {
      if (directory) continue;
      const target = inside(destination, name);
      fs.mkdirSync(path.dirname(target), {recursive:true});
      const input = await zip.openReadStreamPromise(entry), fd = fs.openSync(target, 'wx');
      try {
        for await (const chunk of input) fs.writeFileSync(fd, chunk);
        fs.fsyncSync(fd);
      } finally { input.destroy(); fs.closeSync(fd); }
    }
  } finally { zip.close(); }
}
