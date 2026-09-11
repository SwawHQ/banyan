import assert from 'node:assert/strict';
import path from 'node:path';
import { gotoAndWait, waitForBreadcrumbSettled } from './helpers.mjs';

export const documentAsideScenarios = [{
    id: 'document-aside-navigation',
    kind: 'single',
    serviceWorkers: 'block',
    title: 'Metadata Paths and Chapter Navigation Share the Document Aside',
    async run({ page, baseUrl, artifactDir }) {
        const results = [];
        for (const prefix of ['', '/zh', '/zh-tw']) {
            await page.setViewportSize({ width: 1800, height: 900 });
            await gotoAndWait(page, `${baseUrl}${prefix}/p/swaw-kit-git/?from=all`);
            await waitForBreadcrumbSettled(page);
            const structure = await page.evaluate(() => ({
                headings: [...document.querySelectorAll('.prose :is(h2,h3,h4,h5,h6)')].map(h => ({ id: h.id, text: h.textContent.trim() })),
                entries: [...document.querySelectorAll('.document-toc a')].map(a => ({ id: decodeURIComponent(a.hash.slice(1)), text: a.textContent.trim() })),
                taxonomy: [...document.querySelectorAll('.document-meta__row--taxonomy-path a')].map(a => new URL(a.href).pathname),
                times: [...document.querySelectorAll('.document-meta time')].map(t => t.parentElement.querySelectorAll('time').length),
                platformIcons: [...document.querySelectorAll('.document-meta__row--resources use')].map(u => u.getAttribute('href')),
            }));
            assert.deepEqual(structure.entries, structure.headings, 'Hugo headings and outline entries must have identical IDs, text and order.');
            assert(structure.entries.length > 10);
            assert(structure.taxonomy.includes(prefix + '/tags/tooling/devtools/windows/'));
            assert(structure.taxonomy.includes(prefix + '/tags/tooling/devtools/'));
            assert(structure.times.length > 0 && structure.times.every(count => count === 1));
            assert(structure.platformIcons.includes('#icon-github'));
            if (prefix === '/zh') {
                assert(structure.platformIcons.includes('#icon-wechat'));
                await page.screenshot({ path: path.join(artifactDir, 'desktop.png') });
            }
            results.push({ prefix, ...structure });
        }
        for (const width of [390, 1024, 1800]) {
            await page.setViewportSize({ width, height: 800 });
            await gotoAndWait(page, `${baseUrl}/zh/p/swaw-kit-git/?from=all`);
            await waitForBreadcrumbSettled(page);
            const link = page.locator('.document-toc a').nth(3);
            const fragment = await link.getAttribute('href');
            const assertTarget = async (stage) => {
                try {
                    await page.waitForFunction(() => {
                        const id = decodeURIComponent(location.hash.slice(1));
                        const target = document.getElementById(id);
                        if (!target) return false;
                        const box = target.getBoundingClientRect();
                        const main = document.querySelector('.page-content').getBoundingClientRect();
                        const active = document.querySelector('.document-toc [aria-current="location"]');
                        return box.top >= main.top - 1 && box.top <= main.top + 24
                            && main.left >= -1 && main.right <= innerWidth + 1
                            && active && decodeURIComponent(active.hash.slice(1)) === id;
                    }, null, { timeout: 5000 });
                } catch (error) {
                    const state = await page.evaluate(() => ({
                        url: location.href,
                        y: document.querySelector('.page-content')?.scrollTop,
                        active: document.querySelector('.document-toc [aria-current]')?.outerHTML
                    }));
                    throw new Error(`${stage}: ${JSON.stringify(state)}`, { cause: error });
                }
            };
            await link.click();
            await assertTarget('click');
            assert.equal(new URL(page.url()).search, '?from=all');
            await page.reload();
            await waitForBreadcrumbSettled(page);
            await assertTarget('reload');
            // Reading changes the highlight, never the URL or sidebar scroll.
            const before = await page.evaluate(() => ({ hash: location.hash, aside: document.querySelector('.document-aside').scrollTop }));
            await page.evaluate(() => { document.querySelector('.page-content').scrollTop = 100000; });
            await page.waitForFunction(() => {
                const links = [...document.querySelectorAll('.document-toc a')];
                return links.at(-1).getAttribute('aria-current') === 'location';
            });
            assert.deepEqual(await page.evaluate(() => ({ hash: location.hash, aside: document.querySelector('.document-aside').scrollTop })), before);
            const reading = await page.locator('.page-content').evaluate(e => e.scrollTop);
            await gotoAndWait(page, baseUrl + '/zh/language/');
            await page.goBack();
            await waitForBreadcrumbSettled(page);
            await assertTarget('back to chapter URL');
            // Direct links may use different percent-escape casing.
            await gotoAndWait(page, `${baseUrl}/zh/p/swaw-kit-git/?from=all#${encodeURIComponent(decodeURIComponent(fragment.slice(1)))}`);
            await waitForBreadcrumbSettled(page);
            await assertTarget('direct');
            await page.locator('.document-aside').scrollIntoViewIfNeeded();
            const overflow = await page.locator('.document-aside').evaluate(e => e.scrollWidth - e.clientWidth);
            assert(overflow <= 1, 'Long headings must wrap inside the aside.');
            await page.screenshot({ path: path.join(artifactDir, `aside-${width}.png`) });
            results.push({ width, reading, overflow });
        }
        await page.emulateMedia({ media: 'print' });
        assert.equal(await page.locator('.document-toc').isVisible(), false, 'The screen navigation should not duplicate the article when printed.');
        await page.emulateMedia({ media: 'screen' });
        await gotoAndWait(page, baseUrl + '/zh/icp/');
        assert.equal(await page.locator('.document-toc').count(), 0, 'No heading means no empty outline or outline script.');
        assert.equal(await page.locator('script[src*="document/toc"]').count(), 0);
        const noScript = await page.context().browser().newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
        try {
            const plain = await noScript.newPage();
            await plain.goto(baseUrl + '/zh/p/swaw-kit-git/?from=all');
            await plain.locator('.document-toc a').nth(3).click();
            assert(await plain.locator('.page-content').evaluate(e => e.scrollTop > 0), 'Outline links work without JavaScript.');
        } finally { await noScript.close(); }
        return { results };
    }
}];
