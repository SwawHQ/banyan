import path from 'node:path';
import fs from 'node:fs/promises';
import {dependencyRoot,browserEnvironment,loadChromium,loadWebkit} from './runtime.mjs';
import {execute,withPath} from '../../../scripts.js/_toolchain/process.mjs';
import {readBindings} from '../../../scripts.js/_toolchain/bindings.mjs';
import {toolBinding,toolExecutable} from '../../../scripts.js/_toolchain/operations.mjs';

async function installBrowser(args) {
  const engine = readBindings().runtime, executable = toolExecutable(engine);
  const env = withPath([path.dirname(executable)],browserEnvironment());
  let install;
  if (engine === 'bun') install = ['install','--frozen-lockfile','--no-save','--ignore-scripts'];
  else {
    const npm = toolBinding('node').npmDirectory;
    if (!npm) throw new Error('npm is required for preparation with Node; run swban node.ensure --force');
    install = [path.join(npm,'npm-cli.js'),'ci','--ignore-scripts','--no-audit','--no-fund'];
  }
  // Both installers use the published package-lock.json as their source.
  // Discard Bun's derived lock so it cannot compete with that lock on updates.
  const derivedLock = path.join(dependencyRoot,'bun.lock');
  if (engine === 'bun') await fs.rm(derivedLock,{force:true});
  try {
    if (await execute(executable,install,{cwd:dependencyRoot,env}) !== 0) throw new Error('Browser dependency installation failed.');
  } finally { if (engine === 'bun') await fs.rm(derivedLock,{force:true}); }
  const cli = path.join(dependencyRoot,'node_modules/playwright/cli.js');
  if (await execute(executable,[cli,'install',...args],{cwd:dependencyRoot,env}) !== 0) throw new Error('Browser installation failed.');
}

export async function ensureChromium() {
  await installBrowser(['chromium','--no-shell']);
  console.log('Chromium ready: '+loadChromium().executablePath());
}

export async function ensureWebkit() {
  await installBrowser(['webkit']);
  console.log('WebKit ready: '+loadWebkit().executablePath());
}
