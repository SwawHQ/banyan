import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {writeSiteFile} from '../../_shared/files.mjs';
import {readResources,registryFile} from './registry.mjs';
import {downloadResource} from './download.mjs';

export async function syncResources(siteRoot,{ids=[],missingOnly=false}={}) {
  const resources = await readResources(siteRoot,ids);
  if (!missingOnly && !resources.length) console.log('No resources declared in ' + registryFile);
  for (const resource of resources) {
    if (missingOnly && fs.existsSync(resource.file)) continue;
    const bytes = await downloadResource(resource.source,resource.id);
    const summary = resource.validate(bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const changed = await writeSiteFile(siteRoot,resource.target,bytes,{missingOnly});
    console.log(`${resource.id}: ${changed ? 'synced' : 'already up to date'} ${resource.target}`);
    console.log(`${resource.id}: ${summary}, sha256=${hash}`);
  }
}
