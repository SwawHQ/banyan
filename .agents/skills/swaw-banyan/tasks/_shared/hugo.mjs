import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {toolExecutable} from './toolchain/operations.mjs';
import {hugoEnvironment,prepareHugo} from '../base/hugo/run.mjs';

export async function readHugoConfig(site = process.cwd(),language = '') {
  await prepareHugo();
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'swban-config-'));
  try {
    const args = ['config','--format','json','--printZero','--noBuildLock','--cacheDir',path.join(temporary,'cache')];
    if (language) args.push('--lang',language);
    const result = spawnSync(toolExecutable('hugo'),args,{cwd:path.resolve(site),
      env:hugoEnvironment({...process.env,HUGO_RESOURCEDIR:path.join(temporary,'resources')}),
      shell:false,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,windowsHide:true});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Hugo config failed.');
    return JSON.parse(result.stdout);
  } finally { fs.rmSync(temporary,{recursive:true,force:true}); }
}
