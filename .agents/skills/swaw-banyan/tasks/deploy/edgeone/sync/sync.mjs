import fs from 'node:fs/promises';
import path from 'node:path';
import {writeSiteFile} from '../../../_shared/files.mjs';

export async function syncEdgeone(directory, siteRoot = process.cwd()) {
  const source = path.resolve(siteRoot,directory,'edgeone.json');
  let bytes;
  try { bytes = await fs.readFile(source); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('Missing ' + source + '; build with Hugo first');
    throw error;
  }
  const config = JSON.parse(bytes.toString('utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('edgeone.json must contain a JSON object');
  }
  const changed = await writeSiteFile(siteRoot,'edgeone.json',bytes);
  console.log(changed ? 'Synced ' + source + ' -> edgeone.json' : 'edgeone.json already in sync');
}
