import { fail, gotoAndWait, pollUntil, waitForServiceWorkerActive } from './helpers.mjs';
import { paletteContractScenarios } from './palette-contracts.mjs';
import { presentationContractScenarios } from './presentation-contracts.mjs';
import { updatesNavigationScenarios } from './updates-navigation.mjs';

const EXPECTED_HOME_TITLE = process.env.BANYAN_BROWSER_HOME_TITLE || '';

export const scenarios = [
    ...paletteContractScenarios,
    ...presentationContractScenarios,
    ...updatesNavigationScenarios,
    {
        id: 'home-shell-smoke',
        kind: 'single',
        title: 'Home Shell Smoke',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/`);
            const title = await page.title();
            if (EXPECTED_HOME_TITLE && !title.includes(EXPECTED_HOME_TITLE)) {
                fail('Home page title did not contain the expected configured text.', {
                    expected: EXPECTED_HOME_TITLE,
                    title
                });
            }
            if (!EXPECTED_HOME_TITLE && !title) {
                fail('Home page title was empty.', { title });
            }
            const breadcrumbRuntimeCount = await page.locator('script[src*="browse/path-entry"]').count();
            if (breadcrumbRuntimeCount !== 0) {
                fail('Home page should not load the path entry bundle.', { breadcrumbRuntimeCount });
            }
            return {
                breadcrumbRuntimeCount,
                title
            };
        }
    },
    {
        id: 'sw-home-register',
        kind: 'single',
        title: 'SW Register Smoke (Home)',
        viewport: { width: 1440, height: 960 },
        async run({ page, context, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/`);
            await waitForServiceWorkerActive(page);
            // The first page is warmed by the manager; HTML scanning must cache its CSS/JS too.
            await pollUntil(() => page.evaluate(async () => {
                if (!navigator.serviceWorker.controller) return false;
                const keys = await caches.keys();
                const navKey = keys.find(key => key.startsWith('nav-html-'));
                if (!navKey || !keys.includes('asset-fingerprint')) return false;
                if (!(await (await caches.open(navKey)).match(location.href))) return false;
                const assetCache = await caches.open('asset-fingerprint');
                const urls = [...document.querySelectorAll('link[rel="stylesheet"][href], script[src]')]
                    .map(node => node.href || node.src);
                return urls.length > 0 && (await Promise.all(urls.map(url => assetCache.match(url)))).every(Boolean);
            }), { label: 'First navigation and its fingerprinted CSS/JS are cached' });
            const cachedSw = await page.evaluate(async () => {
                const keys = await caches.keys();
                for (const key of keys) {
                    const requests = await (await caches.open(key)).keys();
                    if (requests.some(request => new URL(request.url).pathname === '/sw.js')) return key;
                }
                return '';
            });
            if (cachedSw) fail('sw.js must never enter Cache Storage.', { cachedSw });
            const swResponse = await context.request.get(`${baseUrl}/sw.js`);
            if (swResponse.headers()['cache-control'] !== 'no-cache, max-age=0, must-revalidate') {
                fail('sw.js must revalidate on every request.', { headers: swResponse.headers() });
            }
            await context.setOffline(true);
            const offlineResponse = await page.reload({ waitUntil: 'load' });
            if (!offlineResponse?.ok() || !offlineResponse.fromServiceWorker()) {
                fail('The first navigation must remain available offline through the service worker.');
            }
            await context.setOffline(false);
            const state = await page.evaluate(async () => {
                const registration = await navigator.serviceWorker.getRegistration('/');
                return {
                    active: !!registration?.active,
                    installing: !!registration?.installing,
                    waiting: !!registration?.waiting
                };
            });
            if (!state.active) {
                fail('Home page did not get an active service worker registration.', state);
            }
            return state;
        }
    },
];

export const upgradeScenarios = scenarios.filter(scenario => scenario.kind === 'upgrade');
export { securityScenarios } from './security.mjs';
