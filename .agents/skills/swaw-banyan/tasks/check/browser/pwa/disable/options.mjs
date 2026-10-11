import {browserCommand,sitePath} from '../../../../_shared/browser/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/pwa/disable','Check enable-to-disable worker cleanup and preserved unrelated site state in Chromium.',[
    {name:'next',value:'dir',required:true,description:'Build with service_worker.mode = disable'},
    {name:'page',value:'path',default:'/',description:'Page to visit and reload during cleanup',parse:sitePath}
  ]);
  spec.buildDirectories=['dir','next'];
  spec.examples=['check/browser/pwa/disable ./enabled --next ./disabled',
    'check/browser/pwa/disable ./enabled --next ./disabled --page /zh/about/ --trace --out ./browser-report'];
  return spec;
}
