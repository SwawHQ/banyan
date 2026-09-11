import { webkit } from 'playwright';
import { runBrowserRegression } from './run.mjs';
import { canvasScenarios } from './canvas.mjs';

await runBrowserRegression({
    browserType: webkit,
    modeName: 'browser-webkit',
    scenarios: canvasScenarios.filter(scenario => [
        'canvas-source-navigation',
        'canvas-document-aside',
        'canvas-first-frame-slow-runtime',
        'canvas-history-scroll-restoration',
        'canvas-anchors'
    ].includes(scenario.id)).map(scenario => ({
        ...scenario,
        isMobile: scenario.id === 'canvas-source-navigation'
    }))
});
