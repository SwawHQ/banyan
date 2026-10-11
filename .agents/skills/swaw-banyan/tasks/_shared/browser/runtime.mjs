import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {toolsRoot} from '../../../scripts.js/_toolchain/manifest.mjs';

export const dependencyRoot = fileURLToPath(new URL('.',import.meta.url));
const browserCache = path.join(toolsRoot,'browser');
export const browserEnvironment = () => ({...process.env,PLAYWRIGHT_BROWSERS_PATH:browserCache});
const require = createRequire(import.meta.url);
function loadPlaywright(command) {
  const wanted = JSON.parse(fs.readFileSync(path.join(dependencyRoot,'package.json'),'utf8')).dependencies.playwright;
  const installed = path.join(dependencyRoot,'node_modules/playwright/package.json');
  if (!fs.existsSync(installed) || JSON.parse(fs.readFileSync(installed,'utf8')).version !== wanted) {
    throw new Error('Browser dependencies are missing or outdated; run swban '+command);
  }
  // Set before importing Playwright, which reads its cache location on load.
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
  return require(path.join(dependencyRoot,'node_modules/playwright'));
}

export function loadChromium() {
  const {chromium} = loadPlaywright('ensure/browser');
  if (!fs.existsSync(chromium.executablePath())) throw new Error('Chromium is missing; run swban ensure/browser');
  return chromium;
}

export function loadWebkit() {
  const {webkit} = loadPlaywright('ensure/browser.webkit');
  if (!fs.existsSync(webkit.executablePath())) throw new Error('WebKit is missing; run swban ensure/browser.webkit');
  return webkit;
}
