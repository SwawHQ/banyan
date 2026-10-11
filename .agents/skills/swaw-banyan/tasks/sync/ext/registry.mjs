import fs from 'node:fs/promises';
import path from 'node:path';
import {parse} from '../../_shared/_vendor/yaml.mjs';
import {siteFile} from '../../_shared/files.mjs';
import {prepareValidators} from './validators.mjs';

export const registryFile = 'data/external-resources.yaml';

export async function readResources(siteRoot, requestedIds) {
  const registry = parse(await fs.readFile(path.join(siteRoot,registryFile),'utf8'));
  if (!Array.isArray(registry?.resources)) throw new Error(registryFile + ' must contain a resources list');
  const byId = new Map();
  for (const entry of registry.resources) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        typeof entry.id !== 'string' || !entry.id.trim() || entry.id.startsWith('-')) {
      throw new Error('Each resource must have a nonempty id');
    }
    if (byId.has(entry.id)) throw new Error('Duplicate resource id: ' + entry.id);
    const unknown = Object.keys(entry).filter(key => !['id','source','target','validators'].includes(key));
    if (unknown.length) throw new Error(entry.id + ': unsupported fields: ' + unknown.join(', '));
    if (typeof entry.source !== 'string' || !/^https?:$/.test(new URL(entry.source).protocol)) {
      throw new Error(entry.id + ': source must be an HTTP or HTTPS URL');
    }
    byId.set(entry.id,entry);
  }
  const ids = requestedIds.length ? [...new Set(requestedIds)] : [...byId.keys()];
  const resources = [];
  const targets = new Set();
  for (const id of ids) {
    const entry = byId.get(id);
    if (!entry) throw new Error('Unknown resource id: ' + id);
    const file = await siteFile(siteRoot,entry.target);
    const key = process.platform === 'win32' ? file.toLowerCase() : file;
    if (targets.has(key)) throw new Error('Duplicate resource target: ' + entry.target);
    targets.add(key);
    resources.push({...entry,validate:prepareValidators(id,entry.validators)});
  }
  return resources;
}
