import { fail, gotoAndWait, readSecurityPolicyViolations } from './helpers.mjs';

function readCspHeader(response) {
    return readResponseHeader(response, 'content-security-policy');
}

function readResponseHeader(response, headerName) {
    if (!response) {
        return '';
    }
    const headers = response.headers();
    return headers[headerName.toLowerCase()] || '';
}

function filterCspConsoleMessages(entries) {
    return entries.filter((entry) => {
        const text = `${entry.text || ''}`.toLowerCase();
        return text.includes('content security policy') || text.includes('csp');
    });
}

function filterPreloadCredentialConsoleMessages(entries) {
    return entries.filter((entry) => {
        const text = `${entry.text || ''}`.toLowerCase();
        return text.includes('preload')
            && text.includes('request credentials mode does not match');
    });
}

export function createConsoleRecorder(page, entries) {
    page.on('console', (message) => {
        entries.push({
            text: message.text(),
            type: message.type()
        });
    });
}

function assertCspPolicy(headerValue, details = {}) {
    if (!headerValue) {
        fail('Response did not include Content-Security-Policy.', details);
    }
    if (!headerValue.includes("script-src 'self' 'report-sample'")) {
        fail('CSP is missing the expected script-src baseline.', {
            ...details,
            headerValue
        });
    }
}

function assertAdjacentSecurityHeaders(response, details = {}) {
    const permissionsPolicy = readResponseHeader(response, 'permissions-policy');
    if (!permissionsPolicy) {
        fail('Response did not include Permissions-Policy.', details);
    }
    for (const directive of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()']) {
        if (!permissionsPolicy.includes(directive)) {
            fail('Permissions-Policy is missing an expected denied capability.', {
                ...details,
                directive,
                permissionsPolicy
            });
        }
    }

    const hsts = readResponseHeader(response, 'strict-transport-security');
    if (!hsts) {
        fail('Response did not include Strict-Transport-Security.', details);
    }
    if (!/^max-age=300(?:\s*;|$)/i.test(hsts.trim())) {
        fail('Strict-Transport-Security should remain in the initial ramp-up stage.', {
            ...details,
            hsts
        });
    }
    if (/includeSubDomains|preload/i.test(hsts)) {
        fail('Strict-Transport-Security should not enable includeSubDomains or preload during ramp-up.', {
            ...details,
            hsts
        });
    }

    return {
        hsts,
        permissionsPolicy
    };
}

async function assertServiceWorkerNavigationPreloadDisabled(page) {
    const result = await page.evaluate(async () => {
        const response = await fetch('/sw.js', {
            cache: 'no-store',
            credentials: 'same-origin'
        }).catch(() => null);
        if (!response) {
            return { ok: false, status: 0, text: '' };
        }
        return {
            ok: response.ok,
            status: response.status,
            text: await response.text().catch(() => '')
        };
    });

    if (!result.ok) {
        fail('Unable to read generated sw.js for navigation preload guardrail.', {
            status: result.status
        });
    }
    if (/navigationPreload\s*\.\s*enable\s*\(/.test(result.text)) {
        fail('sw.js should not enable navigation preload while navigation caching is cache-first.');
    }
    if (!/navigationPreload[\s\S]{0,200}\.\s*disable\s*\(/.test(result.text)) {
        fail('sw.js should explicitly disable navigation preload to clean up older active registrations.');
    }
}

export async function collectSecurityOutcome(page, response, consoleEntries, extraDetails = {}) {
    const csp = readCspHeader(response);
    assertCspPolicy(csp, extraDetails);
    const adjacentHeaders = assertAdjacentSecurityHeaders(response, extraDetails);

    await page.waitForTimeout(250);
    const violations = await readSecurityPolicyViolations(page);
    const cspConsoleMessages = filterCspConsoleMessages(consoleEntries);
    const preloadCredentialConsoleMessages = filterPreloadCredentialConsoleMessages(consoleEntries);
    if (violations.length > 0) {
        fail('Page triggered SecurityPolicyViolationEvent entries under enforced CSP.', {
            ...extraDetails,
            csp,
            violations
        });
    }
    if (cspConsoleMessages.length > 0) {
        fail('Page emitted CSP-related console messages under enforced CSP.', {
            ...extraDetails,
            consoleMessages: cspConsoleMessages,
            csp
        });
    }
    if (preloadCredentialConsoleMessages.length > 0) {
        fail('Page emitted preload credential mismatch console messages.', {
            ...extraDetails,
            consoleMessages: preloadCredentialConsoleMessages
        });
    }

    return {
        consoleMessageCount: consoleEntries.length,
        cspConsoleMessages,
        csp,
        ...adjacentHeaders,
        preloadCredentialConsoleMessages,
        violations
    };
}

export const securityScenarios = [
    {
        id: 'security-csp-enforce-home',
        kind: 'single',
        title: 'Security: CSP Enforce Home',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl }) {
            const consoleEntries = [];
            createConsoleRecorder(page, consoleEntries);
            const response = await gotoAndWait(page, `${baseUrl}/`);
            await page.waitForSelector('.slot-main');

            return collectSecurityOutcome(page, response, consoleEntries, {
                path: '/'
            });
        }
    },
    {
        id: 'security-sw-navigation-preload-disabled',
        kind: 'single',
        title: 'Security: SW Navigation Preload Disabled',
        viewport: { width: 1440, height: 960 },
        async run({ page, baseUrl }) {
            await gotoAndWait(page, `${baseUrl}/`);
            await assertServiceWorkerNavigationPreloadDisabled(page);

            return {
                message: 'sw.js disables navigation preload for cache-first navigations.'
            };
        }
    },
];
