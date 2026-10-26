import path from 'node:path';
import {readOptional} from '../../_shared/output.mjs';
export async function inspect(directory) {
  const text = await readOptional(path.join(path.resolve(directory),'robots.txt')), issues = [];
  if (!text.trim()) return {issues,warnings:['robots.txt not checked: output is absent or empty.']};
  for (const line of text.split(/\r\n?|\n/)) {
    const match = line.split('#',1)[0].match(/^\s*Sitemap\s*:(.*)$/i);
    if (!match) continue;
    const value = match[1].trim();
    try {
      if (!['http:','https:'].includes(new URL(value).protocol)) throw new Error();
    } catch {
      issues.push('robots.txt Sitemap is not a valid absolute HTTP(S) URL: '+value);
    }
  }
  return {issues};
}
