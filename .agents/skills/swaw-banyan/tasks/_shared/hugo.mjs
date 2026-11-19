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
    const args = ['config','--quiet','--format','json','--printZero','--noBuildLock','--cacheDir',path.join(temporary,'cache')];
    args.push(...input);
    if (language) args.push('--lang',language);
    const result = spawnSync(toolExecutable('hugo'),args,{cwd:path.resolve(site),
      env:hugoEnvironment({...process.env,HUGO_RESOURCEDIR:path.join(temporary,'resources')}),
      shell:false,encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024,windowsHide:true});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Hugo config failed.');
    return JSON.parse(result.stdout);
  } finally { fs.rmSync(temporary,{recursive:true,force:true}); }
}
