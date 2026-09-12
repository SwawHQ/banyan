import { webkit } from 'playwright';
import { runBrowserRegression } from './run.mjs';
import { canvasScenarios } from './canvas.mjs';
import { paletteContractScenarios } from './palette-contracts.mjs';

await runBrowserRegression({
    browserType: webkit,
    modeName: 'browser-webkit',
    scenarios: [
        ...paletteContractScenarios,
        ...canvasScenarios.filter(scenario => [
            'canvas-source-navigation',
            'canvas-document-aside',
            'document-aside-navigation',
            'document-aside-mobile-toggle',
            'document-aside-desktop-toggle',
            'canvas-first-frame-slow-runtime',
            'canvas-history-scroll-restoration',
            'canvas-anchors'
        ].includes(scenario.id)).map(scenario => ({
            ...scenario,
            isMobile: scenario.isMobile || scenario.id === 'canvas-source-navigation'
        }))
    ]
});
