import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {toolExecutable} from './tools/operations.mjs';
import {hugoEnvironment,prepareHugo} from '../base/hugo/run.mjs';

export async function readHugoConfig(site = process.cwd(),language = '',input = []) {
  await prepareHugo();
  const parent = path.join(os.tmpdir(),'swaw/banyan/config');
  fs.mkdirSync(parent,{recursive:true});
  const temporary = fs.mkdtempSync(path.join(parent,'read-'));
  try {
    const args = ['--format','json','--printZero','--noBuildLock'];
    args.push(...input);
    if (language) args.push('--lang',language);
    const config = (...logging) => spawnSync(toolExecutable('hugo'),['config',...logging,...args],{cwd:path.resolve(site),
      env:hugoEnvironment({...process.env,HUGO_RESOURCEDIR:path.join(temporary,'resources')}),
      shell:false,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,windowsHide:true});
    // Module downloads can print progress on stdout. Request diagnostics only after a failure.
    const result = config('--quiet');
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const details = config('--logLevel','error');
      if (details.error) throw details.error;
      if (details.status === 0) throw new Error('Hugo config failed during the initial read. Retry the command.');
      const diagnostic = [details.stderr.trim(),details.stdout.trim()].filter(Boolean).join('\n');
      if (process.env.HUGO_MODULE_WORKSPACE === 'hugo.work' && /module workspace "[^"\n]*hugo\.work" does not exist/i.test(diagnostic))
        throw new Error(diagnostic + '\nswban dev and dev/build require hugo.work for local theme development.\nPreview this site: swban server\nBuild this site:   swban build');
      throw new Error(diagnostic || 'Hugo config failed.');
    }
    return JSON.parse(result.stdout);
  } finally { fs.rmSync(temporary,{recursive:true,force:true}); }
}
