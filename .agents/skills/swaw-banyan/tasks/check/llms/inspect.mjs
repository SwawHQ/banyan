import fs from 'node:fs/promises';
import path from 'node:path';
import {filesUnder,insideOutput,isFile,localReference,relativeName} from '../../_shared/output.mjs';
import {decodeHtmlAttribute} from '../../_shared/html/markup.mjs';

function absoluteURL(value) {
  const url = new URL(decodeHtmlAttribute(value));
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Expected an absolute HTTP(S) URL.');
  return url.href;
}

function markdownLinks(text) {
  return [...text.matchAll(/(?<![\\!])\[(?:\\.|[^\]\\\r\n])*\]\(\s*(<[^>\r\n]+>|[^\s<>)\r\n]+)\s*\)/g)]
    .map(match => match[1].startsWith('<') ? match[1].slice(1,-1) : match[1].trim());
}

export async function inspect(directory) {
  const root = path.resolve(directory), issues = [];
  const files = await filesUnder(root), documents = new Map(), sitemaps = new Map();
  const llmsFiles = files.filter(file => path.basename(file).toLowerCase() === 'llms.txt');
  if (!llmsFiles.length) return {issues:['Missing llms.txt.']};

  function parseURL(value,label) {
    try { return absoluteURL(value); }
    catch { issues.push(`${label} is not a valid absolute HTTP(S) URL: ${value}`); return ''; }
  }
  function outputPath(url,siteURL,label) {
    try {
      const target = new URL(url), site = new URL(siteURL);
      if (target.origin !== site.origin || !target.pathname.startsWith(site.pathname)) {
        issues.push(`${label} is outside Canonical site: ${url}`);
        return '';
      }
      const relative = localReference(url,{siteURL});
      insideOutput(root,relative);
      return relative;
    } catch { issues.push(`${label} contains an invalid output reference: ${url}`); return ''; }
  }
  async function requireFile(relative,label) {
    if (relative && !await isFile(insideOutput(root,relative))) issues.push(`${label} points to a missing local file: ${relative}`);
  }
  async function readSitemap(relative,siteURL) {
    if (sitemaps.has(relative)) return sitemaps.get(relative);
    if (!await isFile(insideOutput(root,relative))) {
      issues.push(`Missing sitemap file: ${relative}`);
      return null;
    }
    const text = (await fs.readFile(insideOutput(root,relative),'utf8')).replace(/<\?xml[\s\S]*?\?>/g,'').replace(/<!--[\s\S]*?-->/g,'').trim();
    const kind = text.match(/^<(urlset|sitemapindex)(?:\s|>)/)?.[1];
    if (!kind || !text.endsWith(`</${kind}>`)) {
      issues.push(`Invalid sitemap XML: ${relative}`);
      return null;
    }
    const entry = kind === 'urlset' ? 'url' : 'sitemap';
    const entries = [...text.matchAll(new RegExp(`<${entry}\\b[^>]*>([\\s\\S]*?)<\\/${entry}>`,'g'))];
    const locs = [];
    if (entries.length !== (text.match(new RegExp(`<${entry}(?:\\s|>)`,'g')) || []).length) issues.push(`Invalid sitemap entries: ${relative}`);
    for (const item of entries) {
      const matches = [...item[1].matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)];
      if (matches.length !== 1) { issues.push(`${relative} contains an entry without one loc.`); continue; }
      const url = parseURL(matches[0][1],`${relative} loc`);
      if (url) locs.push(url);
    }
    const result = {kind,locs,siteURL};
    sitemaps.set(relative,result);
    return result;
  }
  function compare(actual,expected,label) {
    const found = new Set();
    for (const url of actual) {
      found.add(url);
      if (!expected.has(url)) issues.push(`${label} contains an extra link absent from its sitemap: ${url}`);
    }
    for (const url of expected) if (!found.has(url)) issues.push(`${label} is missing a sitemap link: ${url}`);
  }

  let siteURL = '';
  for (const file of llmsFiles) {
    const relative = relativeName(root,file), text = await fs.readFile(file,'utf8');
    const canonicalMatch = text.match(/^Canonical site:\s*(\S+)/m);
    const canonical = canonicalMatch ? parseURL(canonicalMatch[1],`${relative} Canonical site`) : '';
    if (!canonicalMatch) issues.push(`${relative} is missing a Canonical site URL.`);
    if (canonical && siteURL && canonical !== siteURL) issues.push(`${relative} Canonical site differs from other llms.txt files: ${canonical}`);
    siteURL ||= canonical;
    const sitemapMatch = text.match(/^Sitemap:\s*(\S+)/m);
    const sitemapURL = sitemapMatch ? parseURL(sitemapMatch[1],`${relative} Sitemap`) : '';
    if (!sitemapMatch) issues.push(`${relative} is missing a Sitemap line.`);
    const links = [], seen = new Set();
    for (const line of text.split(/\r?\n/)) {
      if (/^\s*-\s*\[/.test(line) && !markdownLinks(line).length) issues.push(`${relative} contains a malformed Markdown link: ${line.trim()}`);
    }
    for (const target of markdownLinks(text)) {
      const url = parseURL(target,`${relative} link`);
      if (!url) continue;
      if (seen.has(url)) issues.push(`${relative} contains a duplicate link: ${url}`);
      seen.add(url);
      links.push(url);
      if (canonical) await requireFile(outputPath(url,canonical,`${relative} link`),relative);
    }
    documents.set(relative,{siteURL:canonical,sitemapURL,links});
  }

  const documentURL = (relative,document) => document.siteURL ? new URL(relative,document.siteURL).href : '';
  const indexURLs = new Set([...documents].map(([relative,document]) => documentURL(relative,document)).filter(Boolean));
  const catalogs = sitemapURL => [...documents].filter(([,document]) => document.sitemapURL === sitemapURL);
  for (const [relative,document] of documents) {
    if (!document.siteURL || !document.sitemapURL) continue;
    const sitemapPath = outputPath(document.sitemapURL,document.siteURL,`${relative} Sitemap`);
    if (!sitemapPath) continue;
    const sitemap = await readSitemap(sitemapPath,document.siteURL);
    if (!sitemap) continue;
    if (sitemap.kind === 'urlset') {
      compare(document.links.filter(url => !indexURLs.has(url)),new Set(sitemap.locs),relative);
    } else {
      const expected = sitemap.locs.flatMap(url => catalogs(url).map(([relative,document]) => documentURL(relative,document)));
      compare(document.links,new Set(expected),relative);
    }
  }
  // A language catalog can live at the root or in its language directory.
  if (siteURL) for (const file of files.filter(file => path.basename(file).toLowerCase() === 'sitemap.xml')) {
    const relative = relativeName(root,file), sitemap = await readSitemap(relative,siteURL);
    if (sitemap?.kind !== 'sitemapindex') continue;
    for (const url of sitemap.locs) {
      const childPath = outputPath(url,siteURL,`${relative} loc`);
      if (!childPath) continue;
      const child = await readSitemap(childPath,siteURL);
      if (child && child.kind !== 'urlset') issues.push(`${relative} must reference a sitemap urlset: ${url}`);
      const matches = catalogs(url);
      if (!matches.length) issues.push(`${relative} is missing its language llms.txt for sitemap: ${url}`);
      else if (matches.length > 1) issues.push(`${relative} has multiple llms.txt files for one language sitemap: ${url} (${matches.map(([name]) => name).join(', ')})`);
    }
  }
  return {issues};
}
