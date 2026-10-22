import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildJavaScript} from '../.agents/skills/swaw-banyan/tasks/_shared/hugo-js.mjs';

test('Hugo JS fixtures preserve params, ESM exports and the transitive source graph', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'banyan-js-graph-'));
  try {
    const jsRoot = path.join(work, 'input');
    await fs.mkdir(path.join(jsRoot, 'nested'), {recursive:true});
    await fs.writeFile(path.join(jsRoot, 'entry.js'),
      'import {value} from "./nested/child.js"; import {offset} from "@params"; export const result = value + offset;');
    await fs.writeFile(path.join(jsRoot, 'nested/child.js'),
      'export {value} from "./grandchild.js";');
    await fs.writeFile(path.join(jsRoot, 'nested/grandchild.js'), 'export const value = 40;');
    const bundles = await buildJavaScript({jsRoot, entries:['entry.js'], params:{offset:2}, work:path.join(work, 'build')});
    const bundle = bundles.get('entry.js');
    assert.equal((await import(pathToFileURL(bundle.file).href)).result, 42);
    // A re-export has no retained code, but its dependency must remain visible.
    assert.ok(bundle.sources.includes('entry.js'));
    assert.ok(bundle.sources.includes('nested/grandchild.js'));

    await fs.writeFile(path.join(jsRoot, 'nested/forbidden.js'), 'export const forbidden = 7;');
    await fs.appendFile(path.join(jsRoot, 'entry.js'), '\nexport {forbidden} from "./nested/forbidden.js";');
    const changed = await buildJavaScript({jsRoot, entries:['entry.js'], params:{offset:3}, work:path.join(work, 'changed')});
    const changedModule = await import(pathToFileURL(changed.get('entry.js').file).href);
    assert.equal(changedModule.result, 43);
    assert.equal(changedModule.forbidden, 7);
    assert.ok(changed.get('entry.js').sources.includes('nested/forbidden.js'),
      'the bundle boundary must detect an added runtime dependency');
  } finally { await fs.rm(work, {recursive:true, force:true}); }
});

test('Hugo JS fixtures reject missing imports instead of passing an empty graph', async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'banyan-js-error-'));
  try {
    const jsRoot = path.join(work, 'input');
    await fs.mkdir(jsRoot);
    await fs.writeFile(path.join(jsRoot, 'entry.js'), 'export {missing} from "./absent.js";');
    await assert.rejects(buildJavaScript({jsRoot, entries:['entry.js'], work:path.join(work, 'build')}), /Could not resolve.*absent\.js/);
  } finally { await fs.rm(work, {recursive:true, force:true}); }
});
