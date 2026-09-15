import assert from 'node:assert/strict';
import path from 'node:path';
import { forceServiceWorkerUpdate, gotoAndWait, waitForServiceWorkerActive, waitForUpdateReady } from './helpers.mjs';

const updatesEntry = '[data-root-navigation] a[data-root-href="/zh/updates/"]';

function requireUpgradePair(upgradePair) {
    assert.ok(upgradePair?.fromDir && upgradePair?.toDir, 'Two builds containing the flattened navigation are required.');
}

export const updatesNavigationScenarios = [
    ...[
        { name: 'home', href: '/zh/' },
        { name: 'collection', href: '/zh/all/?sort=name-asc' }
    ].map(({ name, href }) => ({
        id: `sw-update-entry-${name}`,
        kind: 'upgrade',
        title: `Ready Update Activates Before Link Navigation (${name})`,
        dialogPolicy: 'dismiss',
        async run({ page, context, baseUrl, server, upgradePair, dialogs, artifactDir }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/updates/check/`);
            await waitForServiceWorkerActive(page);
            const versionBefore = await page.locator('[data-site-update-version]').getAttribute('title');
            await gotoAndWait(page, baseUrl + href);
            await waitForServiceWorkerActive(page);
            assert.equal(await page.locator(updatesEntry).count(), 1);
            assert.equal(await page.locator('[data-site-update-link]').count(), 0, 'The root site link has no special update role.');

            const reader = await context.newPage();
            await gotoAndWait(reader, `${baseUrl}/zh/about/`);
            await waitForServiceWorkerActive(reader);
            await reader.evaluate(() => {
                window.__readingContext = 'preserved';
                window.__oldController = navigator.serviceWorker.controller;
                const input = document.createElement('textarea');
                input.id = 'unsaved-draft';
                input.value = 'An unsaved draft';
                document.body.append(input);
            });
            const cachesBefore = await page.evaluate(() => caches.keys());

            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await forceServiceWorkerUpdate(page);
            assert.equal(dialogs.length, 0, 'Discovering an update, including repeated checks, must not prompt.');
            assert.equal(page.url(), baseUrl + href, 'An available update does not navigate or reload the reading page.');
            assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting), true);
            await page.screenshot({ path: path.join(artifactDir, 'site-entry-ready.png') });

            await page.locator(updatesEntry).click();
            await page.waitForURL(url => url.pathname === '/zh/updates/');
            await waitForServiceWorkerActive(page);
            assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting), false,
                'The ready worker activates before loading the link destination.');
            await reader.waitForFunction(() => navigator.serviceWorker.controller !== window.__oldController);
            assert.equal(await reader.evaluate(() => window.__readingContext), 'preserved');
            assert.equal(await reader.locator('#unsaved-draft').inputValue(), 'An unsaved draft');
            assert.equal(await page.locator('[data-site-update-panel]').count(), 0);
            let targetLoads = 0;
            page.on('load', () => { targetLoads++; });
            await page.locator('.slot-main .collection-item-link[href*="/updates/check/"]').click();
            await page.waitForURL(url => url.pathname === '/zh/updates/check/');
            await page.waitForLoadState('load');
            assert.notEqual(await page.locator('[data-site-update-version]').getAttribute('title'), versionBefore,
                'Even a previously cached destination displays the new build.');
            assert.equal(new URL(page.url()).searchParams.has('return'), false);
            assert.equal(await page.locator(`${updatesEntry}.is-current`).count(), 1);
            assert.equal(await page.locator('.slot-breadcrumb .collection-item-link').count(), 2);
            await page.waitForTimeout(4500);
            assert.equal(targetLoads, 1, 'No delayed reload follows navigation.');
            const cachesAfter = await page.evaluate(() => caches.keys());
            for (const key of cachesBefore.filter(key => key.startsWith('nav-html-'))) {
                assert.ok(!cachesAfter.includes(key), `Old navigation cache remains: ${key}`);
            }
            assert.equal(dialogs.length, 0);
            await reader.close();
            return { message: 'Link navigation upgrades once, clears old navigation caches and preserves another tab and its draft.' };
        }
    })),
    {
        id: 'sw-update-hidden-control-stays-quiet',
        kind: 'upgrade',
        title: 'Hidden PWA Control Keeps the Update Waiting Without a Dialog',
        dialogPolicy: 'dismiss',
        async run({ page, baseUrl, server, upgradePair, dialogs }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/updates/check/`);
            await waitForServiceWorkerActive(page);
            await page.locator('[data-site-update-action]').evaluate(node => { node.style.visibility = 'hidden'; });
            assert.equal(await page.locator('[data-site-update-link]').count(), 0);
            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await page.waitForSelector('[data-site-update-panel][data-site-update-state="ready"]');
            await forceServiceWorkerUpdate(page);
            assert.equal(dialogs.length, 0, 'A hidden control must not enable a fallback confirmation.');
            assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))?.waiting), true,
                'The update waits for an explicit page action.');
            return { message: 'A hidden PWA action leaves the update available without prompting or applying it.' };
        }
    },
    {
        id: 'sw-update-native-navigation',
        kind: 'upgrade',
        title: 'Refresh, History, Anchors and New Tabs Do Not Apply Waiting Updates',
        async run({ page, context, baseUrl, server, upgradePair }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/about/`);
            await waitForServiceWorkerActive(page);
            await gotoAndWait(page, `${baseUrl}/zh/updates/check/`);
            const version = await page.locator('[data-site-update-version]').getAttribute('title');
            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            let loads = 0;
            page.on('load', () => { loads++; });
            await page.reload({ waitUntil: 'load' });
            await page.waitForTimeout(4500);
            assert.equal(loads, 1, 'Refresh is not followed by an application reload.');
            assert.equal(await page.locator('[data-site-update-version]').getAttribute('title'), version);
            await waitForUpdateReady(page);
            await page.goBack({ waitUntil: 'load' });
            await waitForUpdateReady(page);
            await page.goForward({ waitUntil: 'load' });
            await waitForUpdateReady(page);
            await page.evaluate(() => {
                const anchor = document.createElement('a');
                anchor.id = 'native-anchor'; anchor.href = '#main'; anchor.textContent = 'Anchor';
                document.body.prepend(anchor);
            });
            await page.locator('#native-anchor').click();
            await waitForUpdateReady(page);
            const popupPromise = context.waitForEvent('page');
            await page.locator(updatesEntry).click({ modifiers: ['Control'] });
            const popup = await popupPromise;
            await popup.waitForLoadState('load');
            await waitForUpdateReady(page);
            await popup.close();
            return { message: 'Native refresh/history/anchor/modifier-click preserve a waiting update without delayed reloads.' };
        }
    },
    {
        id: 'sw-update-navigation-cancel',
        kind: 'upgrade',
        title: 'Changing Anchor While Activation Waits Cancels the Pending Link',
        async run({ page, baseUrl, server, upgradePair }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/about/`);
            await waitForServiceWorkerActive(page);
            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await page.evaluate(() => {
                const post = ServiceWorker.prototype.postMessage;
                ServiceWorker.prototype.postMessage = function(message, ...args) {
                    if (message?.type !== 'SKIP_WAITING') return post.call(this, message, ...args);
                };
                const anchor = document.createElement('a');
                anchor.id = 'cancel-with-anchor'; anchor.href = '#main'; anchor.textContent = 'Stay here';
                document.body.prepend(anchor);
                window.__readingContext = 'preserved';
            });
            await page.locator(updatesEntry).click();
            await page.locator('#cancel-with-anchor').click();
            await page.waitForTimeout(4500);
            assert.equal(new URL(page.url()).pathname, '/zh/about/');
            assert.equal(new URL(page.url()).hash, '#main');
            assert.equal(await page.evaluate(() => window.__readingContext), 'preserved');
            await waitForUpdateReady(page);
            return { message: 'An activation completion cannot override a later native anchor navigation.' };
        }
    },
    ...['timeout', 'throw'].map(failure => ({
        id: `sw-update-navigation-${failure}`,
        kind: 'upgrade',
        title: `Activation ${failure} Does Not Block Navigation or Clear Storage`,
        async run({ page, baseUrl, server, upgradePair }) {
            requireUpgradePair(upgradePair);
            server.setRoot(upgradePair.fromDir);
            await gotoAndWait(page, `${baseUrl}/zh/updates/`);
            await waitForServiceWorkerActive(page);
            await gotoAndWait(page, `${baseUrl}/zh/about/`);
            const cacheKeys = await page.evaluate(() => caches.keys());
            server.setRoot(upgradePair.toDir);
            await forceServiceWorkerUpdate(page);
            await waitForUpdateReady(page);
            await page.evaluate(failure => {
                const post = ServiceWorker.prototype.postMessage;
                ServiceWorker.prototype.postMessage = function(message, ...args) {
                    if (message?.type === 'SKIP_WAITING') {
                        if (failure === 'throw') throw new Error('Simulated activation failure');
                        return;
                    }
                    return post.call(this, message, ...args);
                };
            }, failure);
            let loads = 0;
            page.on('load', () => { loads++; });
            await page.locator(updatesEntry).click();
            await page.waitForURL(url => url.pathname === '/zh/updates/');
            await page.waitForLoadState('load');
            await page.waitForTimeout(4500);
            assert.equal(loads, 1);
            await waitForUpdateReady(page);
            const after = await page.evaluate(() => caches.keys());
            for (const key of cacheKeys) assert.ok(after.includes(key), `Activation failure deleted ${key}`);
            return { message: 'Failed activation leaves registration/caches intact and performs only the requested navigation.' };
        }
    }))
];
