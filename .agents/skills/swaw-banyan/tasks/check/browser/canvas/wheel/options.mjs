import {browserCommand,sitePath} from '../../_shared/options.mjs';
import {parseWidths} from '../../_shared/viewport.mjs';

export function wheelCommand(command) {
  return browserCommand(command,[
    {name:'page',value:'path',required:true,parse:sitePath},
    {name:'short',value:'path',required:true,parse:sitePath},
    {name:'widths',value:'list',default:'390,1440',parse:parseWidths}
  ]);
}
