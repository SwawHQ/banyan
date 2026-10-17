import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/pwa/disable',[
    {name:'next',value:'dir',required:true},
    {name:'page',value:'path',default:'/',parse:sitePath}
  ]);
  spec.buildDirectories=['dir','next'];

  return spec;
}
