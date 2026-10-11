import path from 'node:path';
import {readOptional} from '../../_shared/output.mjs';
export async function inspect(directory) {
  const text = await readOptional(path.join(path.resolve(directory),'robots.txt')), issues = [];
  if (!text) issues.push('Missing robots.txt.');
  else {
    if (!/^Sitemap:\s*\S+/im.test(text)) issues.push('robots.txt is missing a Sitemap directive.');
    if (!/^User-agent:\s*\*/im.test(text)) issues.push('robots.txt is missing the wildcard User-agent block.');
  }
  return {issues};
}
