import {browserCommand,sitePath} from '../../_shared/options.mjs';

export function command() {
  const spec=browserCommand('check/browser/canvas/touch',[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'next',value:'path',required:true,parse:sitePath}
  ]);

  return spec;
}
