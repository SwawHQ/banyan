import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {extractTagAttribute} from '../../.agents/skills/swaw-banyan/tasks/_shared/html/markup.mjs';

export async function verifyRetiredOutput(directory) {
  const root = path.resolve(directory);
  for (const name of await fs.readdir(root,{recursive:true})) {
    const file = path.join(root,name);
    if (!(await fs.stat(file)).isFile()) continue;
    assert.ok(!/\.(?:md|markdown)$/i.test(name),'Retired Markdown output: ' + name);
    if (!name.endsWith('.html')) continue;
    const html = await fs.readFile(file,'utf8');
    for(const [tag] of html.matchAll(/<[a-z][^>]*>/gi)) assert.ok(!extractTagAttribute(tag,'class').split(/\s+/).includes('site-nav-utilities'),'Retired settings controls: ' + name);
    assert.ok(!/<link\b[^>]*\btype=["']?text\/markdown/i.test(html),'Retired Markdown alternate: ' + name);
    assert.ok(!/\b(?:data-asset-manifest-url|data-fragment-root|data-site-build-version)\s*=/i.test(html),'Retired runtime attributes: ' + name);
  }
  for (const name of ['runtime','__fragments']) assert.ok(!existsSync(path.join(root,name)),'Retired runtime directory: ' + name);
  const headers = await fs.readFile(path.join(root,'_headers'),'utf8');
  assert.ok(!headers.split(/\r?\n/).some(line => line.trim() === '/*.md'),'Retired Markdown headers route.');
  const edge = JSON.parse(await fs.readFile(path.join(root,'edgeone.json'),'utf8'));
  assert.ok(!edge.headers.some(rule => rule.source === '/*.md'),'Retired Markdown EdgeOne route.');
}
