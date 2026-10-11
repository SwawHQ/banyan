import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeSiteFile} from '../../_shared/files.mjs';
import {readResources,registryFile} from './registry.mjs';
import {downloadResource} from './download.mjs';

try {
  const ids = process.argv.slice(2);
  if (ids.length === 1 && ['--help','-h'].includes(ids[0])) {
    console.log('swban sync/ext [id...]  #Fetch declared resources; default: all declared ids');
  } else {
    if (ids.some(id => !id || id.startsWith('-'))) throw new Error('Expected resource ids; use --help for usage');
    const siteRoot = path.resolve(process.cwd());
    const resources = await readResources(siteRoot,ids);
    if (!resources.length) console.log('No resources declared in ' + registryFile);
    for (const resource of resources) {
      const bytes = await downloadResource(resource.source,resource.id);
      const summary = resource.validate(bytes);
      const hash = createHash('sha256').update(bytes).digest('hex');
      const changed = await writeSiteFile(siteRoot,resource.target,bytes);
      console.log(`${resource.id}: ${changed ? 'synced' : 'already up to date'} ${resource.target}`);
      console.log(`${resource.id}: ${summary}, sha256=${hash}`);
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
