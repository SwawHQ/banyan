import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fail, plainPath } from './filesystem.mjs';

export async function download(url, destination, expectedHash) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) fail('invalid_expected_hash');
  if (new URL(url).protocol !== 'https:') fail('https_required');
  plainPath(destination);
  const signal = AbortSignal.timeout(120000);
  let response;
  for (let redirects = 0; redirects <= 5; redirects++) {
    response = await fetch(url, {redirect:'manual', signal, headers:{'User-Agent':'swaw-banyan'}});
    if (![301,302,303,307,308].includes(response.status)) break;
    await response.body?.cancel();
    url = new URL(response.headers.get('location'), url).href;
    if (new URL(url).protocol !== 'https:') fail('https_redirect_required');
  }
  if (!response.ok || !response.body) { await response.body?.cancel(); fail(`download_http_status:${response.status}`); }
  const fd = fs.openSync(destination, 'wx'), hash = createHash('sha256');
  let total = 0;
  try {
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > 256 * 1024 * 1024) fail('download_too_large');
      fs.writeFileSync(fd, chunk); hash.update(chunk);
    }
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  if (hash.digest('hex') !== expectedHash) fail('download_hash_mismatch');
}
