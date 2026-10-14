import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {buildJavaScript} from '../../.agents/skills/swaw-banyan/tasks/_shared/hugo-js.mjs';

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'banyan-prefetch-policy-'));
try {
    const bundles = await buildJavaScript({
        jsRoot:path.join(process.cwd(), 'module/assets/js'),
        entries:['prefetch/policy.js'], work
    });
    const policy = await import(pathToFileURL(bundles.get('prefetch/policy.js').file).href);

    for (const mode of ['off', 'conservative', 'moderate', 'eager', 'immediate'])
        assert.equal(policy.normalizeEagerness(mode), mode);
    for (const mode of [null, undefined, 'link_xf', 'sw_mf_g', 'EAGER', 'unknown'])
        assert.equal(policy.normalizeEagerness(mode), 'off', 'invalid or removed modes stay off');

    const available = {nativeAvailable:true, swAvailable:true, linkAvailable:true};
    assert.deepEqual(policy.resolvePrefetchBackend({...available}), {
        requested:'auto', backend:'native', reason:'auto-native'
    }, 'Auto selects native before either custom backend');
    assert.deepEqual(policy.resolvePrefetchBackend({...available, nativeAvailable:false}), {
        requested:'auto', backend:'sw', reason:'auto-sw'
    }, 'Auto uses an actual matching active worker before link');
    assert.deepEqual(policy.resolvePrefetchBackend({linkAvailable:true}), {
        requested:'auto', backend:'link', reason:'auto-link'
    });
    assert.deepEqual(policy.resolvePrefetchBackend(), {
        requested:'auto', backend:'off', reason:'no-backend'
    });
    assert.deepEqual(policy.resolvePrefetchBackend({...available, enabled:false}), {
        requested:'auto', backend:'off', reason:'disabled'
    }, 'Auto respects the global switch even with every backend available');
    assert.deepEqual(policy.resolvePrefetchBackend({...available, requested:'invalid', enabled:false}), {
        requested:'auto', backend:'off', reason:'disabled'
    }, 'an invalid request uses Auto');
    for (const backend of ['native', 'sw', 'link']) {
        assert.deepEqual(policy.resolvePrefetchBackend({...available, requested:backend, enabled:false}), {
            requested:backend, backend, reason:'forced-' + backend
        }, 'diagnostic selection can test a backend while global prefetch is off');
        assert.deepEqual(policy.resolvePrefetchBackend({
            ...available, requested:backend, [backend + 'Available']:false
        }), {requested:backend, backend:'off', reason:backend + '-unavailable'},
        'a forced unavailable backend does not fall back');
    }
    assert.deepEqual(policy.resolvePrefetchBackend({...available, requested:'off'}), {
        requested:'off', backend:'off', reason:'requested-off'
    });

    assert.equal(policy.normalizeNavigationUrl('../next/#section', 'https://example.test/base/zh/current/'),
        'https://example.test/base/zh/next/', 'relative language/base paths keep their origin and remove fragments');
    assert.equal(policy.normalizeNavigationUrl('http://[invalid', 'https://example.test/'), '');
    for (const href of ['https://other.test/page/', 'mailto:reader@example.test', '/asset.svg', '/asset.js', '/archive.zip'])
        assert.equal(policy.normalizeNavigationUrl(href, 'https://example.test/'), '', href + ' is not a local page');
    assert.equal(policy.normalizeNavigationUrl('/page.html?sort=name#section', 'https://example.test/'),
        'https://example.test/page.html?sort=name', 'query variants remain distinct navigation targets');
    assert.equal(policy.normalizeNavigationUrl('/page.htm', 'https://example.test/'), 'https://example.test/page.htm');

    const pageUrl = 'https://example.test/base/zh/current/?sort=name#top';
    const candidates = [
        {rule:'folder/tail', href:'/shared/#one'},
        {rule:'folder/tail', href:'/shared/#repeat'},
        {rule:'folder/tail', href:pageUrl},
        {rule:'folder/tail-1', href:'/shared/#ancestor'},
        {rule:'folder/root', href:'/root/'},
        {rule:'file', href:'/post/'},
        {rule:'file', href:'/post/?sort=date'},
        {rule:'disabled', href:'/disabled/'},
        {rule:'removed', href:'/removed/'},
        {rule:'missing', href:'/missing/'},
        {rule:'file', href:'/asset.js'},
        {rule:'file', href:'https://other.test/page/'},
        null
    ];
    const modes = {
        'folder/tail':'conservative', 'folder/tail-1':'immediate',
        'folder/root':'eager', file:'moderate', disabled:'off', removed:'link_xf'
    };
    assert.deepEqual(policy.buildRuntimeActions(modes, candidates, pageUrl), {
        conservative:['https://example.test/shared/'],
        immediate:['https://example.test/shared/'],
        eager:['https://example.test/root/'],
        moderate:['https://example.test/post/', 'https://example.test/post/?sort=date']
    }, 'potential groups keep the same URL at different intensities; dispatch owns document-level deduplication');
    assert.deepEqual(policy.buildRuntimeActions(null, candidates, pageUrl), {});
    assert.deepEqual(policy.buildRuntimeActions(modes, null, pageUrl), {});
    assert.deepEqual(policy.buildRuntimeActions({}, candidates, pageUrl), {});
    console.log('Prefetch policy checks passed.');
} finally {
    await fs.rm(work, {recursive:true, force:true});
}
