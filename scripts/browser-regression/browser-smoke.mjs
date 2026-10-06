import { runBrowserRegression } from './run.mjs';
import { scenarios } from './scenarios.mjs';

await runBrowserRegression({
    modeName: 'browser-smoke',
    scenarios: scenarios.filter(scenario => scenario.id === 'home-shell-smoke')
});
