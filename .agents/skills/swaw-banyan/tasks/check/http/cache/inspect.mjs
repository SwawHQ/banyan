import {request} from '../_shared/request.mjs';
export async function inspect(url) {
  const response = await request(url), cache = response.headers.get('cache-control') ?? '', issues = [];
  if (!cache) issues.push('Response is missing Cache-Control.');
  if (new URL(response.url).pathname.endsWith('/sw.js')) {
    const directives = cache.toLowerCase().split(',').map(value => value.trim());
    for (const directive of ['no-cache','max-age=0','must-revalidate']) {
      if (!directives.includes(directive)) issues.push('sw.js Cache-Control must contain ' + directive + '.');
    }
    if (directives.includes('immutable')) issues.push('sw.js must not be immutable.');
  }
  return {issues};
}
