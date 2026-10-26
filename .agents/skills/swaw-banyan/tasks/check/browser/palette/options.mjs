import {browserCommand,sitePath} from '../_shared/options.mjs';

export function paletteCommand(command,extraOptions=[]) {
  return browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    ...extraOptions
  ]);
}
