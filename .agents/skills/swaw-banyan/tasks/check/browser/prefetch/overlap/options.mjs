import {browserCommand,sitePath} from '../../_shared/options.mjs';
export function command() {
  const spec=browserCommand('check/browser/prefetch/overlap',[
    {name:'page',value:'path',required:true,parse:sitePath}
  ]);

  return spec;
}
