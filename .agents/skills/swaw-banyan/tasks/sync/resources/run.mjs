import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {existingTarget,writeSiteFile} from '../../_shared/files.mjs';
import {readResources,registryFile} from './registry.mjs';
import {downloadResource} from './download.mjs';

export async function syncResources(siteRoot,{ids=[],force=false}={}) {
  const resources = await readResources(siteRoot,ids);
  if (!resources.length) console.log('No resources declared in ' + registryFile);
  if (!force) {
    const existing = resources.find(resource=>existsSync(resource.file));
    if (existing) throw existingTarget(existing.target);
  }
  for (const resource of resources) {
    const bytes = await downloadResource(resource.source,resource.id);
    const summary = resource.validate(bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    await writeSiteFile(siteRoot,resource.target,bytes,{force});
    console.log(`${resource.id}: synced ${resource.target}`);
    console.log(`${resource.id}: ${summary}, sha256=${hash}`);
  }
}
