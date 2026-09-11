import { runBrowserRegression } from './run.mjs';
import { scenarios } from './scenarios.mjs';

const smokeScenarioIds = new Set([
    'home-shell-smoke',
    'breadcrumb-collection-wide-stability',
    'breadcrumb-tags-wide-stability'
]);

const smokeScenarios = scenarios.filter((scenario) => smokeScenarioIds.has(scenario.id));
const foundScenarioIds = new Set(smokeScenarios.map((scenario) => scenario.id));
const missingScenarioIds = [...smokeScenarioIds].filter((id) => !foundScenarioIds.has(id));
if (missingScenarioIds.length > 0) {
    throw new Error(`Unknown browser smoke scenario(s): ${missingScenarioIds.join(', ')}`);
}

await runBrowserRegression({
    headless: true,
    modeName: 'browser-smoke',
    scenarios: smokeScenarios
});
