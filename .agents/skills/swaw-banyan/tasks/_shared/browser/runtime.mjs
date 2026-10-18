import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {toolsRoot} from '../tools/manifest.mjs';

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
  const {chromium} = loadPlaywright('base/browser/ensure');
  if (!fs.existsSync(chromium.executablePath())) throw new Error('Chromium is missing; run swban base/browser/ensure');
  return chromium;
}

export function loadWebkit() {
  const {webkit} = loadPlaywright('base/browser/ensure.webkit');
  if (!fs.existsSync(webkit.executablePath())) throw new Error('WebKit is missing; run swban base/browser/ensure.webkit');
  return webkit;
}
